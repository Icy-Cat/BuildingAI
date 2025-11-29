<script setup lang="ts">
import {
    apiParseUserSchedule,
    type ScheduleProposal,
} from "@buildingai/service/webapi/user-schedule";
import { computed } from "vue";

import ScheduleCard from "../../../../components/ai/ScheduleCard.vue";
import type { ScheduleItem } from "../types";
import { formatDateLocal } from "../utils";

const props = defineProps<{
    isOpen: boolean;
    editingItem: ScheduleItem | null;
    selectedDate: Date;
    saving?: boolean;
    startWithAi?: boolean;
    modelId?: string;
}>();

const emit = defineEmits<{
    (e: "close"): void;
    (e: "save", item: Omit<ScheduleItem, "id">): void;
}>();

const timezone = computed(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

const normalizeTime = (value?: string) => {
    if (!value) return "09:00";
    const match = value.match(/(\d{1,2}):(\d{2})/);
    if (!match || !match[1] || !match[2]) return "09:00";
    const hour = match[1].padStart(2, "0");
    const minute = match[2].padStart(2, "0");
    return `${hour}:${minute}`;
};

const formData = ref({
    title: "",
    description: "",
    date: "",
    time: "09:00",
    priority: "none" as "high" | "medium" | "low" | "none",
    category: "uncategorized" as "work" | "personal" | "meeting" | "reminder" | "uncategorized",
    completed: false,
    isImportant: false,
    isUrgent: false,
    meetingAgenda: "",
    attendees: "",
});
type FormState = typeof formData.value;

const showAdvanced = ref(false);
const aiModeEnabled = ref(false);
const aiPrompt = ref("");
const aiLoading = ref(false);
const aiError = ref<string | null>(null);
const aiReply = ref<string | null>(null);
const aiFollowUp = ref<string | null>(null);
const aiProposal = ref<ScheduleProposal | null>(null);

watch(
    () => [props.editingItem, props.selectedDate],
    () => {
        if (props.editingItem) {
            const {
                title,
                description,
                date,
                time,
                priority,
                category,
                completed,
                isImportant,
                isUrgent,
                meetingAgenda,
                attendees,
            } = props.editingItem;
            formData.value = {
                title,
                description,
                date: date || formatDateLocal(props.selectedDate),
                time: normalizeTime(time),
                priority,
                category,
                completed,
                isImportant: !!isImportant,
                isUrgent: !!isUrgent,
                meetingAgenda: meetingAgenda || "",
                attendees: attendees || "",
            };
        } else {
            formData.value = {
                title: "",
                description: "",
                date: formatDateLocal(props.selectedDate),
                time: "09:00",
                priority: "none",
                category: "uncategorized",
                completed: false,
                isImportant: false,
                isUrgent: false,
                meetingAgenda: "",
                attendees: "",
            };
        }
    },
    { immediate: true },
);

watch(
    () => props.isOpen,
    (open) => {
        if (open) {
            aiModeEnabled.value = !!props.startWithAi;
        }
    },
    { immediate: true },
);

watch(aiModeEnabled, (enabled) => {
    if (!enabled) {
        aiPrompt.value = "";
        aiReply.value = null;
        aiFollowUp.value = null;
        aiProposal.value = null;
        aiError.value = null;
    }
});

const handleSubmit = () => {
    emit("save", {
        ...formData.value,
        time: normalizeTime(formData.value.time),
    });
};

const formatTimeFromIso = (value?: string) => {
    if (!value) return "09:00";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "09:00";
    return `${date.getHours().toString().padStart(2, "0")}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
};

const guardCategory = (value?: string): ScheduleItem["category"] => {
    const allowed: ScheduleItem["category"][] = [
        "work",
        "personal",
        "meeting",
        "reminder",
        "uncategorized",
    ];
    return allowed.includes(value as ScheduleItem["category"])
        ? (value as ScheduleItem["category"])
        : "uncategorized";
};

const guardPriority = (value?: string): ScheduleItem["priority"] => {
    const allowed: ScheduleItem["priority"][] = ["high", "medium", "low", "none"];
    return allowed.includes(value as ScheduleItem["priority"])
        ? (value as ScheduleItem["priority"])
        : "none";
};

const convertProposalToForm = (proposal: ScheduleProposal): FormState => {
    const start = proposal.data.startTime ? new Date(proposal.data.startTime) : props.selectedDate;
    const fallbackDate = formatDateLocal(start);
    return {
        title: proposal.data.title || proposal.summary || "",
        description: proposal.data.description || "",
        date: fallbackDate,
        time: formatTimeFromIso(proposal.data.startTime) || "09:00",
        priority: guardPriority(proposal.data.priority),
        category: guardCategory(proposal.data.category),
        completed: proposal.data.completed ?? false,
        isImportant: proposal.data.isImportant ?? false,
        isUrgent: proposal.data.isUrgent ?? false,
        meetingAgenda: "",
        attendees: proposal.data.attendees || "",
    } as FormState;
};

const handleAiSend = async () => {
    const message = aiPrompt.value.trim();
    if (!message || aiLoading.value) return;
    aiLoading.value = true;
    aiError.value = null;
    aiReply.value = null;
    aiFollowUp.value = null;
    aiProposal.value = null;
    try {
        const response = await apiParseUserSchedule({
            message,
            timezone: timezone.value,
            modelId: props.modelId,
        });
        aiReply.value = response.reply;
        aiFollowUp.value = response.followUpQuestion || null;
        if (response.proposal) {
            aiProposal.value = response.proposal;
        } else if (!response.requiresClarification) {
            aiError.value = "AI 未能生成待办，请换一种描述再试一次。";
        }
    } catch (error) {
        console.error("AI parse schedule failed", error);
        aiError.value = "AI 写待办暂时不可用，请稍后再试。";
    } finally {
        aiLoading.value = false;
        aiPrompt.value = "";
    }
};

const handleAiPromptKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    handleAiSend();
};

const confirmAiProposal = () => {
    if (!aiProposal.value) return;
    const payload = convertProposalToForm(aiProposal.value);
    emit("save", payload);
};

const cancelAiProposal = () => {
    aiProposal.value = null;
};

const editAiProposal = () => {
    if (!aiProposal.value) return;
    const converted = convertProposalToForm(aiProposal.value);
    formData.value = converted;
    aiModeEnabled.value = false;
    showAdvanced.value = true;
};
</script>

<template>
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div class="mb-4 flex items-center justify-between">
                <div class="flex flex-col gap-1">
                    <p class="text-xs tracking-widest text-gray-400 uppercase">
                        {{ editingItem ? "编辑日程" : "新建日程" }}
                    </p>
                    <h3 class="text-xl font-semibold text-gray-900">
                        {{ formData.title || "输入标题" }}
                    </h3>
                </div>
                <div class="flex items-center gap-3">
                    <label
                        class="flex cursor-pointer items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-blue-200 hover:text-blue-600"
                    >
                        <input
                            type="checkbox"
                            class="sr-only"
                            v-model="aiModeEnabled"
                            aria-label="AI写待办"
                        />
                        <UIcon
                            name="i-lucide-bot"
                            class="h-4 w-4"
                            :class="aiModeEnabled ? 'text-blue-600' : 'text-gray-400'"
                        />
                        <span>AI写待办</span>
                        <span
                            class="relative inline-flex h-4 w-7 items-center rounded-full transition"
                            :class="aiModeEnabled ? 'bg-blue-600' : 'bg-gray-300'"
                        >
                            <span
                                class="inline-block h-3 w-3 rounded-full bg-white transition"
                                :class="aiModeEnabled ? 'translate-x-3' : 'translate-x-0.5'"
                            ></span>
                        </span>
                    </label>
                    <button
                        class="text-gray-400 transition hover:text-gray-600"
                        type="button"
                        @click="emit('close')"
                    >
                        <UIcon name="i-lucide-x" class="h-5 w-5" />
                    </button>
                </div>
            </div>

            <form v-if="!aiModeEnabled" @submit.prevent="handleSubmit" class="space-y-6">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-600">标题</label>
                        <input
                            v-model="formData.title"
                            type="text"
                            placeholder="输入日程标题"
                            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            required
                        />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-600">备注</label>
                        <textarea
                            v-model="formData.description"
                            rows="3"
                            placeholder="添加描述或背景信息..."
                            class="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        />
                    </div>
                </div>

                <div class="rounded-xl border border-dashed border-gray-200 p-4">
                    <button
                        type="button"
                        class="flex w-full items-center justify-between text-sm font-medium text-gray-600"
                        @click="showAdvanced = !showAdvanced"
                    >
                        <span>更多选项</span>
                        <UIcon
                            name="i-lucide-chevron-down"
                            class="h-4 w-4 transition"
                            :class="showAdvanced ? 'rotate-180' : ''"
                        />
                    </button>

                    <div v-if="showAdvanced" class="mt-4 space-y-4 border-t border-gray-100 pt-4">
                        <div class="grid gap-4 md:grid-cols-2">
                            <div>
                                <label class="block text-sm font-medium text-gray-600">日期</label>
                                <input
                                    v-model="formData.date"
                                    type="date"
                                    class="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                    required
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-600">时间</label>
                                <div class="flex items-center gap-2">
                                    <input
                                        v-model="formData.time"
                                        type="time"
                                        class="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-600">与会人</label>
                            <input
                                v-model="formData.attendees"
                                type="text"
                                placeholder="添加与会人..."
                                class="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            />
                        </div>

                        <div class="grid gap-4 md:grid-cols-2">
                            <div>
                                <label class="block text-sm font-medium text-gray-600">类别</label>
                                <select
                                    v-model="formData.category"
                                    class="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                >
                                    <option value="uncategorized">未分类</option>
                                    <option value="work">工作</option>
                                    <option value="personal">个人</option>
                                    <option value="meeting">会议</option>
                                    <option value="reminder">提醒</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-600"
                                    >优先级</label
                                >
                                <select
                                    v-model="formData.priority"
                                    class="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                >
                                    <option value="none">无</option>
                                    <option value="low">低</option>
                                    <option value="medium">中</option>
                                    <option value="high">高</option>
                                </select>
                            </div>
                        </div>

                        <div class="grid gap-3 md:grid-cols-2">
                            <label
                                class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            >
                                <input
                                    type="checkbox"
                                    class="rounded"
                                    v-model="formData.isImportant"
                                />
                                <span>标记为重要</span>
                            </label>
                            <label
                                class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            >
                                <input
                                    type="checkbox"
                                    class="rounded"
                                    v-model="formData.isUrgent"
                                />
                                <span>标记为紧急</span>
                            </label>
                        </div>

                        <div v-if="formData.category === 'meeting'" class="space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-600"
                                    >会议议程</label
                                >
                                <input
                                    type="text"
                                    v-model="formData.meetingAgenda"
                                    placeholder="例如：项目评审、方案确认"
                                    class="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-3">
                    <button
                        type="button"
                        @click="emit('close')"
                        class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                        :disabled="props.saving"
                    >
                        取消
                    </button>
                    <button
                        type="submit"
                        class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                        :disabled="props.saving"
                    >
                        {{ props.saving ? "保存中..." : editingItem ? "更新日程" : "创建日程" }}
                    </button>
                </div>
            </form>

            <div v-else class="space-y-4">
                <div class="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-4">
                    <p class="text-sm font-medium text-blue-900">AI 写待办</p>
                    <p class="text-xs text-blue-700">描述你想安排的事情，AI 将帮你生成待办卡片。</p>
                    <form class="mt-3 flex flex-col gap-3" @submit.prevent="handleAiSend">
                        <textarea
                            v-model="aiPrompt"
                            rows="3"
                            class="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            placeholder="例如：明天上午10点和销售团队开会，总结周报"
                            :disabled="aiLoading"
                            @keydown="handleAiPromptKeydown"
                            required
                        />
                        <button
                            type="submit"
                            class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                            :disabled="aiLoading || !aiPrompt.trim()"
                        >
                            <UIcon name="i-lucide-bot" class="mr-1 h-4 w-4" />
                            {{ aiLoading ? "AI 正在生成..." : "AI 写待办" }}
                        </button>
                    </form>
                </div>

                <div v-if="aiReply" class="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    {{ aiReply }}
                </div>
                <div
                    v-if="aiFollowUp"
                    class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"
                >
                    {{ aiFollowUp }}
                </div>

                <div v-if="aiError" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {{ aiError }}
                </div>

                <ScheduleCard
                    v-if="aiProposal"
                    :proposal="aiProposal"
                    @confirm="confirmAiProposal"
                    @cancel="cancelAiProposal"
                    @edit="editAiProposal"
                />

                <div class="flex justify-end">
                    <button
                        type="button"
                        class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                        @click="emit('close')"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
