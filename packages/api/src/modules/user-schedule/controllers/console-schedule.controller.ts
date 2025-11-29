import { ConsoleController } from "@common/decorators/controller.decorator";
import { Permissions } from "@common/decorators/permissions.decorator";
import { Body, Get, Post, Put, Delete, Param, Query } from "@nestjs/common";

import { ExecuteScheduleDto, ParseScheduleDto } from "../dto/ai-schedule.dto";
import { CreateUserScheduleDto } from "../dto/create-user-schedule.dto";
import { QueryUserScheduleDto } from "../dto/query-user-schedule.dto";
import { UpdateUserScheduleDto } from "../dto/update-user-schedule.dto";
import { ScheduleConfigDto } from "../dto/schedule-config.dto";
import { AiScheduleService } from "../services/ai-schedule.service";
import { UserScheduleService } from "../services/user-schedule.service";

@ConsoleController("user-schedule", "用户日程")
export class ConsoleScheduleController {
    constructor(
        private readonly aiScheduleService: AiScheduleService,
        private readonly userScheduleService: UserScheduleService,
    ) {}

    /**
     * 获取日程列表
     */
    @Get()
    @Permissions({
        code: "list",
        name: "查询日程列表",
    })
    async list(@Query() query: QueryUserScheduleDto) {
        const range = this.resolveRange(query);
        const items = await this.userScheduleService.findSchedulesInRange("system", range);
        return { items };
    }

    /**
     * 创建日程
     */
    @Post()
    @Permissions({
        code: "create",
        name: "创建日程",
    })
    async create(@Body() dto: CreateUserScheduleDto) {
        return this.userScheduleService.createSchedule("system", dto);
    }

    /**
     * 更新日程
     */
    @Put(":id")
    @Permissions({
        code: "update",
        name: "更新日程",
    })
    async update(
        @Param("id") scheduleId: string,
        @Body() dto: UpdateUserScheduleDto,
    ) {
        return this.userScheduleService.updateSchedule("system", scheduleId, dto);
    }

    /**
     * 删除日程
     */
    @Delete(":id")
    @Permissions({
        code: "delete",
        name: "删除日程",
    })
    async delete(@Param("id") scheduleId: string) {
        await this.userScheduleService.deleteSchedule("system", scheduleId);
        return { success: true };
    }

    /**
     * AI 解析日程意图
     */
    @Post("parse")
    @Permissions({
        code: "parse",
        name: "AI解析日程",
    })
    async parse(@Body() dto: ParseScheduleDto) {
        return this.aiScheduleService.parse("system", dto);
    }

    /**
     * 执行AI解析的日程意图
     */
    @Post("execute")
    @Permissions({
        code: "execute",
        name: "执行日程意图",
    })
    async execute(@Body() dto: ExecuteScheduleDto) {
        return this.aiScheduleService.executeIntent("system", dto);
    }

    /**
     * 获取AI日程助手配置
     */
    @Get("config")
    @Permissions({
        code: "config:get",
        name: "获取日程配置",
    })
    async getConfig() {
        return this.aiScheduleService.getConfig();
    }

    /**
     * 更新AI日程助手配置
     */
    @Post("config")
    @Permissions({
        code: "config:update",
        name: "更新日程配置",
    })
    async updateConfig(@Body() dto: ScheduleConfigDto) {
        await this.aiScheduleService.updateConfig(dto);
        return { success: true };
    }

    private resolveRange(query: QueryUserScheduleDto): { start?: Date; end?: Date } {
        let start: Date | undefined;
        let end: Date | undefined;

        if (query.date) {
            const parsed = new Date(`${query.date}T00:00:00Z`);
            if (Number.isNaN(parsed.getTime())) {
                throw new Error("无效的日期格式");
            }
            start = parsed;
            end = new Date(parsed.getTime() + 24 * 60 * 60 * 1000);
        }

        if (query.start) {
            start = this.parseDate(query.start, "开始时间");
        }
        if (query.end) {
            end = this.parseDate(query.end, "结束时间");
        }

        if (start && end && end < start) {
            [start, end] = [end, start];
        }

        return { start, end };
    }

    private parseDate(value: string, label: string): Date {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            throw new Error(`无效的${label}`);
        }
        return date;
    }
}