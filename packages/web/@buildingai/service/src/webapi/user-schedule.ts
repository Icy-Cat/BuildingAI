export type ScheduleIntent = "create" | "update" | "delete" | "query";

export type ScheduleMetadata = Record<string, unknown>;

export interface UserScheduleEvent {
    id: string;
    userId: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    category: "work" | "personal" | "meeting" | "reminder";
    priority: "high" | "medium" | "low" | "none";
    isImportant: boolean;
    isUrgent: boolean;
    location?: string;
    attendees?: string;
    timezone?: string;
    createdAt: string;
    updatedAt: string;
    completed?: boolean;
    metadata?: ScheduleMetadata;
}

export interface ScheduleProposalPayload {
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    attendees?: string;
    category?: UserScheduleEvent["category"];
    priority?: UserScheduleEvent["priority"];
    isImportant?: boolean;
    isUrgent?: boolean;
    timezone?: string;
    completed?: boolean;
    metadata?: ScheduleMetadata;
}

export interface ScheduleProposal {
    intent: ScheduleIntent;
    summary: string;
    data: ScheduleProposalPayload;
    confidence?: number;
    originalEventId?: string;
    missingFields?: string[];
    requiresClarification?: boolean;
    followUpQuestion?: string;
}

export interface ParseScheduleRequest {
    message: string;
    timezone?: string;
    modelId?: string;
}

export interface ParseScheduleResponse {
    reply: string;
    requiresClarification: boolean;
    followUpQuestion?: string;
    proposal?: ScheduleProposal;
}

export interface ExecuteScheduleRequest {
    intent: ScheduleIntent;
    scheduleId?: string;
    data?: ScheduleProposalPayload;
    summary?: string;
}

export interface ExecuteScheduleResponse {
    intent: ScheduleIntent;
    message: string;
    event?: UserScheduleEvent;
    events?: UserScheduleEvent[];
}

export interface ListUserScheduleParams {
    date?: string;
    start?: string;
    end?: string;
}

export interface ListUserScheduleResponse {
    items: UserScheduleEvent[];
}

export interface SaveUserScheduleRequest {
    title: string;
    description?: string;
    startTime: string;
    endTime?: string;
    location?: string;
    attendees?: string;
    timezone?: string;
    category?: UserScheduleEvent["category"];
    priority?: UserScheduleEvent["priority"];
    isImportant?: boolean;
    isUrgent?: boolean;
    completed?: boolean;
    metadata?: ScheduleMetadata;
}

export function apiListUserSchedules(
    params: ListUserScheduleParams = {},
): Promise<ListUserScheduleResponse> {
    return useWebGet("/user-schedule", params);
}

export function apiCreateUserSchedule(
    payload: SaveUserScheduleRequest,
): Promise<UserScheduleEvent> {
    return useWebPost("/user-schedule", payload);
}

export function apiUpdateUserSchedule(
    scheduleId: string,
    payload: SaveUserScheduleRequest,
): Promise<UserScheduleEvent> {
    return useWebPatch(`/user-schedule/${scheduleId}`, payload);
}

export function apiDeleteUserSchedule(scheduleId: string): Promise<{ success: boolean }> {
    return useWebDelete(`/user-schedule/${scheduleId}`);
}

export function apiParseUserSchedule(
    payload: ParseScheduleRequest,
): Promise<ParseScheduleResponse> {
    return useWebPost("/user-schedule/parse", payload);
}

export function apiExecuteUserSchedule(
    payload: ExecuteScheduleRequest,
): Promise<ExecuteScheduleResponse> {
    return useWebPost("/user-schedule/execute", payload);
}
