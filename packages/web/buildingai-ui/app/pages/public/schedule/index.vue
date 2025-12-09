<script setup lang="ts">
import { apiGetDefaultAiModel } from "@buildingai/service/webapi/ai-conversation";
import {
    apiCreateUserSchedule,
    apiDeleteUserSchedule,
    apiListUserSchedules,
    apiUpdateUserSchedule,
    type ScheduleProposal,
    type UserScheduleEvent,
} from "@buildingai/service/webapi/user-schedule";
import { computed, onMounted, ref, watch } from "vue";

import CalendarView from "./components/calendar-view.vue";
import ListView from "./components/list-view.vue";
import QuadrantView from "./components/quadrant-view.vue";
import ScheduleModal from "./components/schedule-modal.vue";
import type { ScheduleItem } from "./types";
import { formatDateLocal, getLocalDate, parseLocalDate } from "./utils";

definePageMeta({
    layout: "default",
    title: "menu.schedule",
    auth: false,
    inSystem: true,
    inLinkSelector: true,
});

const currentDate = ref(new Date());
const selectedDate = ref(new Date());
const activeView = ref<"list" | "calendar" | "quadrant">("calendar");
const calendarViewMode = ref<"day" | "week" | "month">("month");
const scheduleItems = ref<ScheduleItem[]>([]);
const showAddModal = ref(false);
const showAIChat = ref(false);
const editingItem = ref<ScheduleItem | null>(null);
const startWithAiMode = ref(false);
const dailyGoals = ref<Record<string, string>>({});
const loadingTasks = ref(false);
const fetchError = ref<string | null>(null);
const isSavingSchedule = ref(false);
const deletingScheduleId = ref<string | null>(null);

const defaultModelId = ref<string>("");
const browserTimezone = ref(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
const viewTabs = [
    { key: "list", label: "清单视图" },
    { key: "calendar", label: "日历视图" },
    { key: "quadrant", label: "四象限视图" },
] as const;
const PAGE_STATE_KEY = "schedule:page-state";

onMounted(async () => {
    restorePageState();
    try {
        const defaultModel = await apiGetDefaultAiModel();
        if (defaultModel?.id) {
            defaultModelId.value = defaultModel.id;
        }
    } catch (e) {
        console.error("Failed to load default model", e);
    }
});

const mockScheduleData: ScheduleItem[] = [
    {
        id: "1",
        title: "团队会议",
        description: "讨论Q4项目进展",
        date: getLocalDate(0, 0),
        time: "09:00",
        priority: "high",
        category: "meeting",
        completed: false,
        isImportant: true,
        isUrgent: true,
        meetingAgenda: "项目进展、阻塞点、下周计划",
        attendees: "产品、研发、测试",
    },
    {
        id: "2",
        title: "AI项目评审",
        description: "评估新AI功能的技术方案",
        date: getLocalDate(0, 0),
        time: "14:30",
        priority: "high",
        category: "work",
        completed: false,
        isImportant: true,
        isUrgent: false,
    },
    {
        id: "3",
        title: "健身训练",
        description: "跑步30分钟 + 力量训练",
        date: getLocalDate(0, 1),
        time: "07:00",
        priority: "medium",
        category: "personal",
        completed: true,
        isImportant: false,
        isUrgent: false,
    },
    {
        id: "4",
        title: "客户电话",
        description: "与张总讨论合作细节",
        date: getLocalDate(0, 1),
        time: "10:00",
        priority: "high",
        category: "work",
        completed: false,
        isImportant: true,
        isUrgent: true,
    },
    {
        id: "5",
        title: "药物提醒",
        description: "记得服用维生素",
        date: getLocalDate(0, 2),
        time: "08:00",
        priority: "low",
        category: "reminder",
        completed: false,
        isImportant: false,
        isUrgent: false,
    },
];

const DEFAULT_EVENT_DURATION = 60 * 60 * 1000;
const DRAFT_ID_PREFIX = "__draft__";
type ApiCategory = Exclude<ScheduleItem["category"], "uncategorized">;
type ApiPriority = ScheduleItem["priority"];

const normalizeCategoryForRequest = (value?: ScheduleItem["category"]): ApiCategory | undefined => {
    if (!value || value === "uncategorized") return undefined;
    return value;
};

const normalizePriorityForRequest = (value?: ScheduleItem["priority"]): ApiPriority | undefined =>
    value || undefined;

const combineLocalDateTime = (dateStr: string | undefined, timeStr: string | undefined) => {
    const normalizedDate = dateStr || formatDateLocal(new Date());
    const normalizedTime = timeStr && timeStr.length >= 4 ? timeStr : "00:00";
    const date = new Date(`${normalizedDate}T${normalizedTime}`);
    if (Number.isNaN(date.getTime())) {
        console.warn("Invalid date/time detected, falling back to now", {
            date: normalizedDate,
            time: normalizedTime,
        });
        return new Date();
    }
    return date;
};

const buildScheduleRequest = (item: Omit<ScheduleItem, "id">, existing?: ScheduleItem | null) => {
    const resolveStart = () => {
        const candidates = [existing?.startDateTime, item.startDateTime];
        for (const candidate of candidates) {
            if (!candidate) continue;
            const parsed = new Date(candidate);
            if (!Number.isNaN(parsed.getTime())) return parsed;
        }
        return combineLocalDateTime(item.date, item.time);
    };

    const start = resolveStart();

    const resolveEnd = () => {
        const candidates = [existing?.endDateTime, item.endDateTime];
        for (const candidate of candidates) {
            if (!candidate) continue;
            const parsed = new Date(candidate);
            if (!Number.isNaN(parsed.getTime())) return parsed;
        }
        if (item.endTime) {
            const parsedEnd = new Date(`${item.date}T${item.endTime}`);
            if (!Number.isNaN(parsedEnd.getTime())) {
                return parsedEnd;
            }
        }
        return new Date(start.getTime() + DEFAULT_EVENT_DURATION);
    };

    const end = resolveEnd();

    const combinedDescription = [item.description, item.meetingAgenda]
        .map((text) => text?.trim())
        .filter(Boolean)
        .join("\n");

    const attendees = item.attendees?.trim();

    const metadata = {
        ...(existing?.metadata ?? {}),
        completed: item.completed,
    };

    return {
        title: item.title,
        description: combinedDescription || undefined,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        attendees: attendees || undefined,
        category: normalizeCategoryForRequest(item.category),
        priority: normalizePriorityForRequest(item.priority),
        isImportant: item.isImportant,
        isUrgent: item.isUrgent,
        timezone: existing?.timezone || browserTimezone.value,
        metadata,
    };
};

const convertProposalToScheduleItem = (proposal: ScheduleProposal): ScheduleItem => {
    const data = proposal.data;
    const startDate = data.startTime ? new Date(data.startTime) : new Date();
    const _endDate = data.endTime ? new Date(data.endTime) : undefined;
    const date = formatDateLocal(startDate);
    const draftId =
        globalThis.crypto?.randomUUID?.() !== undefined
            ? globalThis.crypto.randomUUID()
            : `${Date.now()}`;
    return {
        id: `${DRAFT_ID_PREFIX}${draftId}`,
        title: data.title || proposal.summary,
        description: data.description || proposal.summary,
        date,
        time: formatTimeFromIso(data.startTime) || "09:00",
        endTime: formatTimeFromIso(data.endTime),
        startDateTime: data.startTime,
        endDateTime: data.endTime,
        priority: data.priority || "none",
        category: data.category || "uncategorized",
        completed: data.completed ?? false,
        isImportant: data.isImportant,
        isUrgent: data.isUrgent,
        meetingAgenda: data.description,
        attendees: data.attendees,
        timezone: data.timezone || browserTimezone.value,
        metadata: data.metadata,
    };
};

const loadTasksFromApi = async (range: { start: Date; end: Date }) => {
    loadingTasks.value = true;
    fetchError.value = null;
    try {
        const { items } = await apiListUserSchedules({
            start: range.start.toISOString(),
            end: range.end.toISOString(),
        });
        const tasks = items.map((event) => mapEventToScheduleItem(event));
        const map = new Map<string, ScheduleItem>();
        const startMillis = range.start.getTime();
        const endMillis = range.end.getTime();

        scheduleItems.value.forEach((existing) => {
            const date = parseLocalDate(existing.date);
            const time = date.getTime();
            if (time < startMillis || time > endMillis) {
                map.set(existing.id, existing);
            }
        });

        tasks.forEach((t) => map.set(t.id, t));
        scheduleItems.value = Array.from(map.values());
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.warn("Task API load failed, using mock data. Error:", error);
        fetchError.value = error.message || "Failed to fetch tasks";
        const map = new Map<string, ScheduleItem>();
        mockScheduleData.forEach((t) => map.set(t.id, t));
        const startMillis = range.start.getTime();
        const endMillis = range.end.getTime();
        scheduleItems.value.forEach((existing) => {
            const date = parseLocalDate(existing.date);
            const time = date.getTime();
            if (time < startMillis || time > endMillis) {
                map.set(existing.id, existing);
            }
        });
        scheduleItems.value = Array.from(map.values());
    } finally {
        loadingTasks.value = false;
    }
};

const handleSaveSchedule = async (item: Omit<ScheduleItem, "id">) => {
    if (isSavingSchedule.value) return;
    isSavingSchedule.value = true;
    try {
        const payload = buildScheduleRequest(item, editingItem.value);
        const isDraftEdit = editingItem.value?.id.startsWith(DRAFT_ID_PREFIX) ?? false;
        let saved: UserScheduleEvent;
        if (editingItem.value && !isDraftEdit) {
            saved = await apiUpdateUserSchedule(editingItem.value.id, payload);
        } else {
            saved = await apiCreateUserSchedule(payload);
        }
        upsertScheduleItem(mapEventToScheduleItem(saved));
        showAddModal.value = false;
        editingItem.value = null;
        startWithAiMode.value = false;
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Failed to save schedule", error);
        fetchError.value = error.message || "保存日程失败";
    } finally {
        isSavingSchedule.value = false;
    }
};

const handleDeleteSchedule = async (id: string) => {
    deletingScheduleId.value = id;
    try {
        await apiDeleteUserSchedule(id);
        scheduleItems.value = scheduleItems.value.filter((item) => item.id !== id);
        if (editingItem.value && editingItem.value.id === id) {
            editingItem.value = null;
            showAddModal.value = false;
            startWithAiMode.value = false;
        }
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Failed to delete schedule", error);
        fetchError.value = error.message || "删除日程失败";
    } finally {
        if (deletingScheduleId.value === id) {
            deletingScheduleId.value = null;
        }
    }
};

const handleProposalEdit = (proposal: ScheduleProposal) => {
    const draft = convertProposalToScheduleItem(proposal);
    startWithAiMode.value = false;
    editingItem.value = draft;
    showAddModal.value = true;
    showAIChat.value = false;
};

const buildUpdatePayload = (item: ScheduleItem) => {
    const { id: _id, ...withoutId } = item;
    return buildScheduleRequest(withoutId, item);
};

const persistScheduleChanges = async (
    item: ScheduleItem,
    updates: Partial<ScheduleItem>,
    errorMessage = "更新日程状态失败",
) => {
    const previous = { ...item };
    Object.assign(item, updates);

    if (item.id.startsWith(DRAFT_ID_PREFIX)) {
        return;
    }

    try {
        const payload = buildUpdatePayload(item);
        const saved = await apiUpdateUserSchedule(item.id, payload);
        upsertScheduleItem(mapEventToScheduleItem(saved));
        fetchError.value = null;
    } catch (err: unknown) {
        Object.assign(item, previous);
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Failed to update schedule", error);
        fetchError.value = error.message || errorMessage;
    }
};

const toggleComplete = (id: string) => {
    const item = scheduleItems.value.find((i) => i.id === id);
    if (!item) return;
    void persistScheduleChanges(item, { completed: !item.completed });
};

const toggleImportant = (id: string) => {
    const item = scheduleItems.value.find((i) => i.id === id);
    if (!item) return;
    void persistScheduleChanges(item, { isImportant: !item.isImportant });
};

const toggleUrgent = (id: string) => {
    const item = scheduleItems.value.find((i) => i.id === id);
    if (!item) return;
    void persistScheduleChanges(item, { isUrgent: !item.isUrgent });
};

const handleInlineTitleUpdate = (payload: { id: string; title: string }) => {
    const item = scheduleItems.value.find((i) => i.id === payload.id);
    if (!item) return;
    void persistScheduleChanges(item, { title: payload.title }, "更新日程标题失败");
};

const formatTimeFromIso = (value?: string) => {
    if (!value) return "00:00";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value.slice(11, 16) || value;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const mapEventToScheduleItem = (event: UserScheduleEvent): ScheduleItem => {
    const parseSafeDate = (value?: string) => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const start = parseSafeDate(event.startTime) ?? new Date();
    const end = parseSafeDate(event.endTime);
    const completed =
        typeof event.completed === "boolean" ? event.completed : Boolean(event.metadata?.completed);
    return {
        id: event.id,
        title: event.title,
        description: event.description ?? "",
        date: formatDateLocal(start),
        time: formatTimeFromIso(event.startTime),
        endTime: formatTimeFromIso(event.endTime ?? end?.toISOString()),
        startDateTime: parseSafeDate(event.startTime)?.toISOString(),
        endDateTime: end?.toISOString(),
        priority: event.priority,
        category: event.category,
        completed,
        isImportant: event.isImportant,
        isUrgent: event.isUrgent,
        meetingAgenda: event.description,
        attendees: event.attendees,
        timezone: event.timezone,
        metadata: event.metadata,
    };
};

const upsertScheduleItem = (item: ScheduleItem) => {
    const index = scheduleItems.value.findIndex((existing) => existing.id === item.id);
    if (index === -1) {
        scheduleItems.value.push(item);
    } else {
        scheduleItems.value[index] = item;
    }
};

const getWeekStart = (date: Date) => {
    const copy = new Date(date);
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
};

const buildMonthDays = (base: Date) => {
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    const offset = (firstDay.getDay() + 6) % 7;
    startDate.setDate(startDate.getDate() - offset);

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        days.push(date);
    }
    return days;
};

const calendarDays = computed(() => buildMonthDays(currentDate.value));

const calendarRange = computed(() => {
    if (calendarViewMode.value === "day") {
        const start = new Date(selectedDate.value);
        start.setHours(0, 0, 0, 0);
        const end = new Date(selectedDate.value);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    if (calendarViewMode.value === "week") {
        const start = getWeekStart(selectedDate.value);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    const days = calendarDays.value;
    if (!days.length) return null;
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    if (!firstDay || !lastDay) return null;
    const start = new Date(firstDay);
    start.setHours(0, 0, 0, 0);
    const end = new Date(lastDay);
    end.setHours(23, 59, 59, 999);
    return { start, end };
});

watch(
    calendarRange,
    (range) => {
        if (range) {
            loadTasksFromApi(range);
        }
    },
    { immediate: true },
);

const handleEdit = (item: ScheduleItem) => {
    startWithAiMode.value = false;
    editingItem.value = item;
    showAddModal.value = true;
};

const openScheduleModal = (useAi: boolean) => {
    startWithAiMode.value = useAi;
    editingItem.value = null;
    showAddModal.value = true;
};

const openManualScheduleModal = () => openScheduleModal(false);
const openAiScheduleModal = () => openScheduleModal(true);

const setSelectedDate = (date: Date) => {
    selectedDate.value = date;
    currentDate.value = new Date(date);
};

const handleCalendarCursorChange = (value: Date) => {
    currentDate.value = value;
};

const updateDailyGoal = (value: string) => {
    dailyGoals.value[formatDateLocal(selectedDate.value)] = value;
};

const handleAiEventCreated = (event: UserScheduleEvent) => {
    upsertScheduleItem(mapEventToScheduleItem(event));
};

const handleAiEventUpdated = (event: UserScheduleEvent) => {
    upsertScheduleItem(mapEventToScheduleItem(event));
};

const handleAiEventDeleted = (id: string) => {
    scheduleItems.value = scheduleItems.value.filter((item) => item.id !== id);
};

const handleAiQueryResult = (events: UserScheduleEvent[]) => {
    events.forEach((event) => upsertScheduleItem(mapEventToScheduleItem(event)));
};

const restorePageState = () => {
    if (typeof window === "undefined") return;
    try {
        const raw = window.localStorage.getItem(PAGE_STATE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<{
            activeView: "list" | "calendar" | "quadrant";
            calendarViewMode: "day" | "week" | "month";
            selectedDate: string;
            currentDate: string;
            dailyGoals: Record<string, string>;
        }>;
        if (parsed.activeView) activeView.value = parsed.activeView;
        if (parsed.calendarViewMode) calendarViewMode.value = parsed.calendarViewMode;
        if (parsed.selectedDate) {
            const d = new Date(parsed.selectedDate);
            if (!Number.isNaN(d.getTime())) {
                selectedDate.value = d;
                currentDate.value = new Date(d);
            }
        }
        if (parsed.currentDate) {
            const d = new Date(parsed.currentDate);
            if (!Number.isNaN(d.getTime())) {
                currentDate.value = d;
            }
        }
        if (parsed.dailyGoals) dailyGoals.value = parsed.dailyGoals;
    } catch (err) {
        console.warn("Failed to restore schedule page state", err);
    }
};

const persistPageState = () => {
    if (typeof window === "undefined") return;
    const payload = {
        activeView: activeView.value,
        calendarViewMode: calendarViewMode.value,
        selectedDate: selectedDate.value.toISOString(),
        currentDate: currentDate.value.toISOString(),
        dailyGoals: dailyGoals.value,
    };
    window.localStorage.setItem(PAGE_STATE_KEY, JSON.stringify(payload));
};

watch([activeView, calendarViewMode, selectedDate, currentDate, dailyGoals], persistPageState, {
    deep: true,
});
</script>

<template>
    <div class="min-h-screen bg-gray-50 py-8">
        <div class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">日程管理</h1>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <button
                        @click="openManualScheduleModal()"
                        class="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
                    >
                        新建日程
                    </button>
                    <button
                        @click="openAiScheduleModal()"
                        class="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
                    >
                        AI 写待办
                    </button>

                    <div
                        class="flex rounded-full bg-white p-1 text-sm shadow-sm ring-1 ring-gray-200"
                    >
                        <button
                            v-for="tab in viewTabs"
                            :key="tab.key"
                            @click="activeView = tab.key"
                            class="rounded-full px-4 py-1.5 transition"
                            :class="
                                activeView === tab.key
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-gray-600 hover:text-blue-700'
                            "
                        >
                            {{ tab.label }}
                        </button>
                    </div>
                </div>
            </div>

            <div
                v-if="fetchError"
                class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
                加载日程失败：{{ fetchError }}
            </div>

            <ListView
                v-if="activeView === 'list'"
                :selected-date="selectedDate"
                :schedule-items="scheduleItems"
                :deleting-id="deletingScheduleId"
                @toggleComplete="toggleComplete"
                @toggleImportant="toggleImportant"
                @toggleUrgent="toggleUrgent"
                @updateTitle="handleInlineTitleUpdate"
                @edit="handleEdit"
                @delete="handleDeleteSchedule"
                @create="openManualScheduleModal()"
                @openAi="openAiScheduleModal()"
            />

            <CalendarView
                v-else-if="activeView === 'calendar'"
                :current-date="currentDate"
                :selected-date="selectedDate"
                :schedule-items="scheduleItems"
                :mode="calendarViewMode"
                :loading="loadingTasks"
                :deleting-id="deletingScheduleId"
                @update:selectedDate="setSelectedDate"
                @update:currentDate="handleCalendarCursorChange"
                @change-mode="calendarViewMode = $event"
                @create="
                    setSelectedDate($event);
                    openManualScheduleModal();
                "
                @edit="handleEdit"
                @open-ai="openAiScheduleModal()"
                @toggle-complete="toggleComplete"
                @toggle-important="toggleImportant"
                @toggle-urgent="toggleUrgent"
                @delete="handleDeleteSchedule"
                @update-title="handleInlineTitleUpdate"
            />

            <QuadrantView
                v-else
                :selected-date="selectedDate"
                :schedule-items="scheduleItems"
                :deleting-id="deletingScheduleId"
                :daily-goal="dailyGoals[formatDateLocal(selectedDate)] || ''"
                @update:dailyGoal="updateDailyGoal"
                @toggleComplete="toggleComplete"
                @toggleImportant="toggleImportant"
                @toggleUrgent="toggleUrgent"
                @updateTitle="handleInlineTitleUpdate"
                @edit="handleEdit"
                @delete="handleDeleteSchedule"
                @create="openManualScheduleModal()"
                @openAi="openAiScheduleModal()"
            />
        </div>

        <AIChatWidget
            v-model:open="showAIChat"
            :model-id="defaultModelId || undefined"
            :timezone="browserTimezone"
            @event-created="handleAiEventCreated"
            @event-updated="handleAiEventUpdated"
            @event-deleted="handleAiEventDeleted"
            @query-result="handleAiQueryResult"
            @edit-proposal="handleProposalEdit"
        />

        <ScheduleModal
            :isOpen="showAddModal"
            :editingItem="editingItem"
            :selectedDate="selectedDate"
            :saving="isSavingSchedule"
            :startWithAi="startWithAiMode"
            :modelId="defaultModelId || undefined"
            @close="
                showAddModal = false;
                editingItem = null;
                startWithAiMode = false;
            "
            @save="handleSaveSchedule"
        />
    </div>
</template>
