import { SecretService } from "@buildingai/core/modules/secret/services/secret.service";
import { AiModel } from "@buildingai/db/entities/ai-model.entity";
import { Repository } from "@buildingai/db/typeorm";

import { DictService } from "@buildingai/dict";

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

describe("AiScheduleService", () => {
    let service: AiScheduleService;
    let secretService: jest.Mocked<SecretService>;
    let scheduleService: jest.Mocked<UserScheduleService>;
    let dictService: jest.Mocked<DictService>;
    let aiModelRepository: jest.Mocked<Repository<AiModel>>;

    beforeEach(() => {
        secretService = {
            getSecret: jest.fn().mockResolvedValue({ apiKey: "test-key" }),
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
            getDictValue: jest.fn().mockResolvedValue("some-value"),
        } as any;

        aiModelRepository = {
            findOne: jest.fn().mockResolvedValue({
                id: "model",
                model: "gpt",
                provider: { provider: "openai", bindSecretId: "sec" },
            }),
        } as any;

        service = new AiScheduleService(secretService, scheduleService, dictService, aiModelRepository);
    });

    it("parses AI response into structured proposal", async () => {
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
