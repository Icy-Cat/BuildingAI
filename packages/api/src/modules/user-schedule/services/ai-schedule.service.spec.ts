import { SecretService } from "@buildingai/core/modules/secret/services/secret.service";
import { AiModel } from "@buildingai/db/entities/ai-model.entity";
import { Repository } from "@buildingai/db/typeorm";
import type { DictService } from "@buildingai/dict";

import { ExecuteScheduleDto, ParseScheduleDto } from "../dto/ai-schedule.dto";
import { AiScheduleService } from "./ai-schedule.service";
import { UserScheduleService } from "./user-schedule.service";

jest.mock("callsites", () => {
    return () => [];
});

jest.mock("@buildingai/utils", () => ({
    getProviderSecret: (_key: string, source: Record<string, string>) => {
        return source.apiKey || source.baseUrl || "";
    },
}));

jest.mock("@buildingai/dict", () => ({
    DictService: class {},
}));

describe("AiScheduleService", () => {
    let service: AiScheduleService;
    let secretService: jest.Mocked<SecretService>;
    let scheduleService: jest.Mocked<UserScheduleService>;
    let dictService: jest.Mocked<DictService>;
    let aiModelRepository: jest.Mocked<Repository<AiModel>>;

    beforeEach(() => {
        secretService = {
            getConfigKeyValuePairs: jest.fn().mockResolvedValue({ apiKey: "key", baseUrl: "" }),
        } as any;

        scheduleService = {
            findUpcomingSchedules: jest.fn().mockResolvedValue([]),
            createSchedule: jest.fn().mockResolvedValue({ id: "new" }),
            updateSchedule: jest.fn().mockResolvedValue({ id: "updated" }),
            deleteSchedule: jest.fn().mockResolvedValue(undefined),
            findOwnedSchedule: jest.fn().mockResolvedValue({ id: "old", title: "demo" }),
            findSchedulesInRange: jest.fn().mockResolvedValue([]),
        } as any;

        dictService = {
            get: jest.fn().mockResolvedValue(undefined),
            set: jest.fn().mockResolvedValue(undefined),
        } as any;

        aiModelRepository = {
            findOne: jest.fn().mockResolvedValue({
                id: "model",
                model: "gpt",
                name: "Test Model",
                provider: { provider: "openai", bindSecretId: "sec" },
                features: ["structured-output"],
            }),
        } as any;

        service = new AiScheduleService(
            secretService,
            scheduleService,
            dictService,
            aiModelRepository,
        );
    });

    it("parses AI response into structured proposal with enforced schema", async () => {
        const mockGenerator = {
            chat: {
                create: jest.fn().mockResolvedValue({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    reply: "安排好啦",
                                    intent: "create",
                                    proposal: {
                                        title: "会议",
                                        startTime: "2024-01-01T00:00:00.000Z",
                                        endTime: "2024-01-01T01:00:00.000Z",
                                    },
                                }),
                            },
                        },
                    ],
                }),
            },
        };

        jest.spyOn<any, any>(service as any, "createGenerator").mockResolvedValue(mockGenerator);

        const dto: ParseScheduleDto = {
            message: "安排一个会议",
        };

        const result = await service.parse("user", dto);
        expect(result.proposal?.intent).toBe("create");
        expect(result.proposal?.data.title).toBe("会议");
        expect(mockGenerator.chat.create).toHaveBeenCalledWith(
            expect.objectContaining({
                response_format: expect.objectContaining({
                    type: "json_schema",
                    json_schema: expect.objectContaining({
                        schema: expect.any(Object),
                    }),
                }),
            }),
        );
    });

    it("falls back to message parsing when schema disabled in config", async () => {
        dictService.get.mockResolvedValue({
            schemaOutputEnabled: false,
        });

        const mockGenerator = {
            chat: {
                create: jest.fn().mockResolvedValue({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    reply: "ok",
                                }),
                            },
                        },
                    ],
                }),
            },
        };

        jest.spyOn<any, any>(service as any, "createGenerator").mockResolvedValue(mockGenerator);

        const dto: ParseScheduleDto = {
            message: "hi",
        };

        await service.parse("user", dto);
        expect(mockGenerator.chat.create).toHaveBeenCalledWith(
            expect.not.objectContaining({
                response_format: expect.anything(),
            }),
        );
    });

    it("returns schema definitions with timezone defaults", () => {
        const schema = service.getResponseSchema("UTC");
        expect(schema.name).toBe("buildingai_schedule_response");
        expect(schema.schema.properties.proposal.properties.timezone.default).toBe("UTC");
    });

    it("only surfaces title as a missing field", () => {
        const payload = {
            reply: "ok",
            intent: "create",
            missing_fields: ["title", "startTime", "location"],
            proposal: {
                title: "",
            },
        };

        const response = (service as any).buildResponseFromPayload(payload, "Asia/Shanghai");
        expect(response.proposal?.missingFields).toEqual(["title"]);
    });

    it("executes create intent", async () => {
        const dto: ExecuteScheduleDto = {
            intent: "create",
            data: {
                title: "会议",
                startTime: "2024-01-01T00:00:00.000Z",
            },
        };

        const result = await service.executeIntent("user", dto);
        expect(scheduleService.createSchedule).toHaveBeenCalled();
        expect(result.intent).toBe("create");
    });
});
