/**
 * 日程助手配置 DTO
 */
export class ScheduleConfigDto {
    /**
     * AI 模型 ID
     */
    modelId?: string;

    /**
     * 温度参数
     */
    temperature?: number;

    /**
     * 系统提示词
     */
    systemPrompt?: string;

    /**
     * 上下文限制数量
     */
    contextLimit?: number;
}