import type {
    ScheduleCategory,
    SchedulePriority,
} from "@buildingai/db/entities/user-schedule.entity";
import {
    IsBoolean,
    IsDateString,
    IsIn,
    IsObject,
    IsOptional,
    IsString,
    MaxLength,
} from "class-validator";

export class CreateUserScheduleDto {
    @IsString()
    @MaxLength(255)
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsDateString()
    startTime: string;

    @IsOptional()
    @IsDateString()
    endTime?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    location?: string;

    @IsOptional()
    @IsString()
    @MaxLength(512)
    attendees?: string;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    timezone?: string;

    @IsOptional()
    @IsIn(["work", "personal", "meeting", "reminder"])
    category?: ScheduleCategory;

    @IsOptional()
    @IsIn(["high", "medium", "low", "none"])
    priority?: SchedulePriority;

    @IsOptional()
    @IsBoolean()
    isImportant?: boolean;

    @IsOptional()
    @IsBoolean()
    isUrgent?: boolean;

    @IsOptional()
    @IsBoolean()
    completed?: boolean;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}
