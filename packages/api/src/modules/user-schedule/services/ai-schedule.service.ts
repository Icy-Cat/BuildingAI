import { getProvider, TextGenerator } from "@buildingai/ai-sdk";
import { MODEL_FEATURES } from "@buildingai/ai-sdk/interfaces/model-features";
import { AI_DEFAULT_MODEL } from "@buildingai/constants";
import { SecretService } from "@buildingai/core/modules/secret/services/secret.service";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AiModel } from "@buildingai/db/entities/ai-model.entity";
import { UserSchedule } from "@buildingai/db/entities/user-schedule.entity";
import { Repository } from "@buildingai/db/typeorm";
import { DictService } from "@buildingai/dict";
import { HttpErrorFactory } from "@buildingai/errors";
import { getProviderSecret } from "@buildingai/utils";
import { Injectable, Logger } from "@nestjs/common";

import { ExecuteScheduleDto, ParseScheduleDto } from "../dto/ai-schedule.dto";
import { CreateUserScheduleDto } from "../dto/create-user-schedule.dto";
import { ScheduleConfigDto } from "../dto/schedule-config.dto";
import type {
    AiScheduleProposal,
    AiScheduleResponse,
    ScheduleExecutionResult,
    ScheduleIntent,
    ScheduleProposalPayload,
} from "../interfaces/ai-schedule.interface";
import { buildScheduleResponseSchema, type ScheduleSchemaDefinition } from "./schedule-schema.builder";
import { UserScheduleService } from "./user-schedule.service";

/**
 * AI 日程助手服务
 *
 * 负责与大模型交互并生成结构化意图
 */
@Injectable()
export class AiScheduleService {
    private readonly logger = new Logger(AiScheduleService.name);

    constructor(
        private readonly secretService: SecretService,
        private readonly userScheduleService: UserScheduleService,
        private readonly dictService: DictService,
        @InjectRepository(AiModel)
        private readonly aiModelRepository: Repository<AiModel>,
    ) {}

    /**
     * 获取日程助手配置
     */
    async getConfig(): Promise<ScheduleConfigDto> {
        const config = await this.dictService.get<ScheduleConfigDto>(
            "schedule_config",
            undefined,
            "ai",
        );
        return {
            modelId: config?.modelId ?? "",
            temperature: config?.temperature ?? 0.2,
            systemPrompt: config?.systemPrompt ?? "",
            contextLimit: config?.contextLimit ?? 5,
            schemaOutputEnabled: config?.schemaOutputEnabled ?? true,
        };
    }

    /**
     * 更新日程助手配置
     */
    async updateConfig(dto: ScheduleConfigDto): Promise<void> {
        await this.dictService.set("schedule_config", dto, {
            group: "ai",
            description: "日程助手配置",
        });
    }

    /**
     * 解析用户输入
     */
    async parse(userId: string, dto: ParseScheduleDto): Promise<AiScheduleResponse> {
        this.logger.debug(`[Parse] Request Body: ${JSON.stringify(dto)}`);
        const config = await this.getConfig();
        const modelId = config.modelId || dto.modelId;
        const model = await this.resolveModel(modelId);
        this.logger.debug(`[Parse] Using Model: ${model.name} (${model.model})`);
        const generator = await this.createGenerator(model);
        const timezone = dto.timezone || "Asia/Shanghai";
        const now = dto.now ? new Date(dto.now) : new Date();

        const upcoming = await this.userScheduleService.findUpcomingSchedules(userId, config.contextLimit || 5);
        const schemaDefinition = this.getResponseSchema(timezone);
        const systemPrompt = this.buildSystemPrompt(
            now,
            timezone,
            upcoming,
            schemaDefinition,
            config.systemPrompt,
        );
        const shouldUseSchema = this.shouldUseSchema(model, config);
        const requestPayload: Parameters<TextGenerator["chat"]["create"]>[0] = {
            model: model.model,
            temperature: config.temperature ?? 0.2,
            messages: [
                {
                    role: "system",
                    content: systemPrompt,
                },
                {
                    role: "user",
                    content: dto.message.trim(),
                },
            ],
        };

        if (shouldUseSchema) {
            requestPayload.response_format = {
                type: "json_schema",
                json_schema: {
                    name: schemaDefinition.name,
                    schema: schemaDefinition.schema,
                    strict: schemaDefinition.strict,
                },
            };
            this.logger.log(
                `[Parse] Schema enforcement enabled (provider=${model.provider?.provider}, features=${
                    model.features?.join(",") || "none"
                })`,
            );
        } else {
            const toggle = config.schemaOutputEnabled ?? true;
            const reason = toggle ? "missing-structured-output" : "toggle-disabled";
            this.logger.log(
                `[Parse] Schema enforcement skipped (${reason}) for provider=${model.provider?.provider}, features=${
                    model.features?.join(",") || "none"
                }`,
            );
        }

        try {
            const completion = await generator.chat.create(requestPayload);

            const content = completion.choices[0]?.message?.content ?? "";
            const normalized = this.parseAssistantContent(content);
            return this.buildResponseFromPayload(normalized, timezone);
        } catch (error) {
            this.logger.error(`AI解析失败: ${error.message}`, error.stack);
            return {
                reply: "抱歉，我暂时无法理解这条指令，请换一种说法或稍后再试。",
                requiresClarification: true,
            };
        }
    }

    getResponseSchema(timezone?: string): ScheduleSchemaDefinition {
        const resolvedTimezone = timezone || "Asia/Shanghai";
        return buildScheduleResponseSchema(resolvedTimezone);
    }

    /**
     * 执行解析后的意图
     */
    async executeIntent(userId: string, dto: ExecuteScheduleDto): Promise<ScheduleExecutionResult> {
        switch (dto.intent) {
            case "create":
                return this.executeCreate(userId, dto);
            case "update":
                return this.executeUpdate(userId, dto);
            case "delete":
                return this.executeDelete(userId, dto);
            case "query":
                return this.executeQuery(userId, dto);
            default:
                throw HttpErrorFactory.badRequest("暂不支持的意图类型");
        }
    }

    private async executeCreate(
        userId: string,
        dto: ExecuteScheduleDto,
    ): Promise<ScheduleExecutionResult> {
        if (!dto.data?.title || !dto.data?.startTime) {
            throw HttpErrorFactory.badRequest("缺少创建日程所需的关键信息");
        }

        const payload: CreateUserScheduleDto = {
            title: dto.data.title,
            description: dto.data.description,
            startTime: dto.data.startTime,
            endTime: dto.data.endTime,
            location: dto.data.location,
            attendees: dto.data.attendees,
            timezone: dto.data.timezone,
            category: this.guardCategory(dto.data.category),
            priority: this.guardPriority(dto.data.priority),
            isImportant: dto.data.isImportant,
            isUrgent: dto.data.isUrgent,
            completed: dto.data.completed,
            metadata: dto.data.metadata,
        };

        const created = await this.userScheduleService.createSchedule(userId, payload);
        return {
            intent: "create",
            message: "日程已创建完成",
            event: created,
        };
    }

    private async executeUpdate(
        userId: string,
        dto: ExecuteScheduleDto,
    ): Promise<ScheduleExecutionResult> {
        if (!dto.scheduleId) {
            throw HttpErrorFactory.badRequest("缺少需要更新的日程ID");
        }
        if (!dto.data) {
            throw HttpErrorFactory.badRequest("没有提供需要更新的内容");
        }

        const payload: CreateUserScheduleDto = {
            title: dto.data.title,
            description: dto.data.description,
            startTime: dto.data.startTime,
            endTime: dto.data.endTime,
            location: dto.data.location,
            attendees: dto.data.attendees,
            timezone: dto.data.timezone,
            category: this.guardCategory(dto.data.category),
            priority: this.guardPriority(dto.data.priority),
            isImportant: dto.data.isImportant,
            isUrgent: dto.data.isUrgent,
            completed: dto.data.completed,
            metadata: dto.data.metadata,
        };

        const updated = await this.userScheduleService.updateSchedule(
            userId,
            dto.scheduleId,
            payload,
        );
        return {
            intent: "update",
            message: "日程已更新",
            event: updated,
        };
    }

    private async executeDelete(
        userId: string,
        dto: ExecuteScheduleDto,
    ): Promise<ScheduleExecutionResult> {
        if (!dto.scheduleId) {
            throw HttpErrorFactory.badRequest("缺少需要删除的日程ID");
        }

        const schedule = await this.userScheduleService.findOwnedSchedule(userId, dto.scheduleId);
        await this.userScheduleService.deleteSchedule(userId, dto.scheduleId);
        return {
            intent: "delete",
            message: `已删除「${schedule.title}」`,
            event: schedule,
        };
    }

    private async executeQuery(
        userId: string,
        dto: ExecuteScheduleDto,
    ): Promise<ScheduleExecutionResult> {
        const start = dto.data?.startTime ? new Date(dto.data.startTime) : new Date();
        const end = dto.data?.endTime
            ? new Date(dto.data.endTime)
            : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

        const events = await this.userScheduleService.findSchedulesInRange(userId, { start, end });
        return {
            intent: "query",
            message: "查询结果如下",
            events,
        };
    }

    private async resolveModel(modelId?: string): Promise<AiModel> {
        const relations = { provider: true as const };

        if (modelId) {
            const model = await this.aiModelRepository.findOne({
                where: { id: modelId },
                relations,
            });
            if (!model) {
                throw HttpErrorFactory.notFound("指定的模型不存在");
            }
            return model;
        }

        const defaultModelId = await this.dictService.get(AI_DEFAULT_MODEL);
        if (defaultModelId) {
            const defaultModel = await this.aiModelRepository.findOne({
                where: { id: defaultModelId },
                relations,
            });
            if (defaultModel) {
                return defaultModel;
            }
        }

        const activeModel = await this.aiModelRepository.findOne({
            where: { isActive: true },
            order: {
                sortOrder: "ASC",
                createdAt: "DESC",
            },
            relations,
        });
        if (activeModel) return activeModel;

        const fallback = await this.aiModelRepository.findOne({ relations });
        if (!fallback) {
            throw HttpErrorFactory.internal("尚未配置可用的AI模型");
        }
        return fallback;
    }

    private async createGenerator(model: AiModel): Promise<TextGenerator> {
        if (!model.provider?.bindSecretId) {
            this.logger.error(`模型 ${model.id} 缺少绑定的密钥 ID，无法创建生成器`);
            throw HttpErrorFactory.internal("AI 模型密钥未配置，请联系管理员");
        }

        const providerSecret = await this.secretService.getConfigKeyValuePairs(
            model.provider.bindSecretId,
        );

        const provider = getProvider(model.provider.provider, {
            apiKey: getProviderSecret("apiKey", providerSecret),
            baseURL: getProviderSecret("baseUrl", providerSecret),
        });

        return new TextGenerator(provider);
    }

    private buildSystemPrompt(
        now: Date,
        timezone: string,
        events: UserSchedule[],
        schema: ScheduleSchemaDefinition,
        customPrompt?: string,
    ): string {
        const eventLines =
            events.length === 0
                ? "暂无记录"
                : events
                      .map(
                          (item) =>
                              `${item.id}|${item.title}|${item.startTime.toISOString()}|${item.endTime.toISOString()}`,
                      )
                      .join("\n");
        const schemaInstructions = this.buildSchemaInstructions(schema);

        if (customPrompt) {
            return (
                customPrompt
                    .replace("{{current_time}}", now.toISOString())
                    .replace("{{user_timezone}}", timezone)
                    .replace("{{upcoming_events}}", eventLines) +
                "\n\n" +
                schemaInstructions
            );
        }

        return [
            "You are an intelligent scheduling assistant for BuildingAI.",
            `Current server time: ${now.toISOString()}`,
            `User timezone: ${timezone}`,
            "Upcoming user events (id|title|start|end):",
            eventLines,
            "Always respond with machine-parseable JSON that matches the schema below. No commentary or markdown code fences are allowed.",
            schemaInstructions,
            "Only set missing_fields (with ['title']) when the user did not supply a title. All other properties, including time and location, are optional—leave them blank if uncertain.",
        ].join("\n");
    }

    private buildSchemaInstructions(schema: ScheduleSchemaDefinition): string {
        return [
            `Schema name: ${schema.name}`,
            "Schema summary:",
            schema.summary,
            "JSON Schema:",
            JSON.stringify(schema.schema, null, 2),
        ].join("\n");
    }

    private parseAssistantContent(raw: string): {
        reply?: string;
        intent?: ScheduleIntent;
        proposal?: ScheduleProposalPayload;
        confidence?: number;
        missing_fields?: string[];
        follow_up_question?: string;
        target_event_id?: string;
    } {
        const cleaned = raw
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();
        try {
            return JSON.parse(cleaned);
        } catch {
            // 尝试提取大括号内容
            const start = cleaned.indexOf("{");
            const end = cleaned.lastIndexOf("}");
            if (start !== -1 && end !== -1 && end > start) {
                try {
                    return JSON.parse(cleaned.slice(start, end + 1));
                } catch (err) {
                    this.logger.warn(`二次解析失败: ${err.message}`);
                }
            }
            this.logger.warn("AI响应无法解析为JSON:", raw);
            return {};
        }
    }

    private buildResponseFromPayload(
        payload: Record<string, any>,
        timezone: string,
    ): AiScheduleResponse {
        const rawMissing = Array.isArray(payload.missing_fields)
            ? (payload.missing_fields as string[])
            : [];
        const filteredMissing = rawMissing.includes("title") ? ["title"] : [];

        const proposal: AiScheduleProposal | undefined = payload.intent
            ? {
                  intent: payload.intent,
                  summary: payload.proposal?.title || payload.reply || "待确认的日程",
                  data: {
                      ...payload.proposal,
                      timezone: payload.proposal?.timezone || timezone,
                  },
                  confidence: payload.confidence,
                  missingFields: filteredMissing,
                  originalEventId: payload.target_event_id || undefined,
                  requiresClarification: filteredMissing.length > 0,
                  followUpQuestion: payload.follow_up_question || undefined,
              }
            : undefined;

        const requiresClarification =
            proposal?.requiresClarification || !!payload.follow_up_question;

        return {
            reply: payload.reply || "我已记录下这条请求，请确认具体信息。",
            requiresClarification,
            followUpQuestion: payload.follow_up_question,
            proposal,
            raw: payload,
        };
    }

    private shouldUseSchema(model: AiModel, config: ScheduleConfigDto): boolean {
        const toggleEnabled = config.schemaOutputEnabled ?? true;
        if (!toggleEnabled) {
            return false;
        }
        return !!model.features?.includes(MODEL_FEATURES.STRUCTURED_OUTPUT);
    }

    private guardCategory(input?: string): UserSchedule["category"] | undefined {
        if (!input) return undefined;
        if (["work", "personal", "meeting", "reminder"].includes(input)) {
            return input as UserSchedule["category"];
        }
        return undefined;
    }

    private guardPriority(input?: string): UserSchedule["priority"] | undefined {
        if (!input) return undefined;
        if (["high", "medium", "low", "none"].includes(input)) {
            return input as UserSchedule["priority"];
        }
        return undefined;
    }
}
