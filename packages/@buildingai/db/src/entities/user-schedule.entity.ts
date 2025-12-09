import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index, JoinColumn, ManyToOne, type Relation } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";
import { User } from "./user.entity";

export type SchedulePriority = "high" | "medium" | "low" | "none";
export type ScheduleCategory = "work" | "personal" | "meeting" | "reminder";

/**
 * 用户个人日程实体
 *
 * 存储用户通过 AI 助手或手动创建的日程信息
 */
@AppEntity({ name: "user_schedule", comment: "用户个人日程" })
@Index(["userId", "startTime"])
@Index(["userId", "category"])
export class UserSchedule extends SoftDeleteBaseEntity {
    /**
     * 用户 ID
     */
    @Column({
        type: "uuid",
        comment: "所属用户ID",
    })
    @Index()
    userId: string;

    /**
     * 关联用户
     */
    @ManyToOne(() => User, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "user_id" })
    user: Relation<User>;

    /**
     * 日程标题
     */
    @Column({
        type: "varchar",
        length: 255,
        comment: "日程标题",
    })
    title: string;

    /**
     * 日程描述
     */
    @Column({
        type: "text",
        nullable: true,
        comment: "日程描述",
    })
    description?: string;

    /**
     * 开始时间
     */
    @Column({
        type: "timestamptz",
        comment: "开始时间",
    })
    startTime: Date;

    /**
     * 结束时间
     */
    @Column({
        type: "timestamptz",
        comment: "结束时间",
    })
    endTime: Date;

    /**
     * 日程类别
     */
    @Column({
        type: "varchar",
        length: 32,
        default: "work",
        comment: "类别：work/personal/meeting/reminder",
    })
    category: ScheduleCategory;

    /**
     * 优先级
     */
    @Column({
        type: "varchar",
        length: 16,
        default: "none",
        comment: "优先级：high/medium/low/none",
    })
    priority: SchedulePriority;

    /**
     * 是否重要
     */
    @Column({
        type: "boolean",
        default: false,
        comment: "是否重要",
    })
    isImportant: boolean;

    /**
     * 是否紧急
     */
    @Column({
        type: "boolean",
        default: false,
        comment: "是否紧急",
    })
    isUrgent: boolean;

    /**
     * 日程地点
     */
    @Column({
        type: "varchar",
        length: 255,
        nullable: true,
        comment: "地点",
    })
    location?: string;

    /**
     * 参会人或相关人员
     */
    @Column({
        type: "varchar",
        length: 512,
        nullable: true,
        comment: "参会人员",
    })
    attendees?: string;

    /**
     * 用户时区
     */
    @Column({
        type: "varchar",
        length: 64,
        nullable: true,
        comment: "生成该日程的时区",
    })
    timezone?: string;

    /**
     * 附加元数据
     */
    @Column({
        type: "jsonb",
        nullable: true,
        comment: "AI 解析原始数据",
    })
    metadata?: Record<string, any>;
}
