import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

/**
 * 日程助手配置 DTO
 */
export class ScheduleConfigDto {
    /**
     * AI 模型 ID
     */
    @IsOptional()
    @IsString()
    modelId?: string;

    /**
     * 温度参数
     */
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    temperature?: number;

    /**
     * 系统提示词
     */
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    systemPrompt?: string;

    /**
     * 上下文限制数量
     */
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(50)
    contextLimit?: number;
}
