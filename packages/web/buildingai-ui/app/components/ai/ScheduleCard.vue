<script setup lang="ts">
import type { ScheduleProposal } from "@buildingai/service/webapi/user-schedule";
import { computed } from "vue";

const props = defineProps<{
    proposal: ScheduleProposal;
    pending?: boolean;
}>();

const hasBlockingMissingFields = computed(() => {
    const fields = props.proposal.missingFields ?? [];
    return fields.length > 0;
});

const emit = defineEmits<{
    (e: "confirm"): void;
    (e: "edit"): void;
    (e: "cancel"): void;
}>();

const formatDateTime = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
};

const getIntentBadgeColor = (intent: ScheduleProposal["intent"]) => {
    if (intent === "delete") return "error";
    if (intent === "update") return "warning";
    if (intent === "query") return "info";
    return "primary";
};

const intentLabelMap: Record<ScheduleProposal["intent"], string> = {
    create: "创建",
    update: "更新",
    delete: "删除",
    query: "查询",
};

const priorityLabelMap = {
    high: "高",
    medium: "中",
    low: "低",
    none: "无",
} as const;

const resolvePriorityLabel = (value?: ScheduleProposal["data"]["priority"]) => {
    const key = (value ?? "none") as keyof typeof priorityLabelMap;
    return priorityLabelMap[key] ?? priorityLabelMap.none;
};
</script>

<template>
    <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div class="mb-3 flex items-start justify-between">
            <div>
                <p class="text-xs tracking-wide text-gray-500 uppercase">
                    {{ proposal.intent === "create" ? "创建提案" : "日程提案" }}
                </p>
                <p class="text-base font-semibold text-gray-900">
                    {{ proposal.data.title || proposal.summary }}
                </p>
            </div>
            <UBadge :color="getIntentBadgeColor(proposal.intent)" size="xs">
                {{ intentLabelMap[proposal.intent] }}
            </UBadge>
        </div>

        <dl class="space-y-2 text-sm text-gray-600">
            <div class="grid grid-cols-3 gap-2">
                <dt class="col-span-1 text-gray-500">开始时间</dt>
                <dd class="col-span-2 font-medium">
                    {{ formatDateTime(proposal.data.startTime) }}
                </dd>
            </div>
            <div class="grid grid-cols-3 gap-2">
                <dt class="col-span-1 text-gray-500">结束时间</dt>
                <dd class="col-span-2 font-medium">
                    {{ formatDateTime(proposal.data.endTime) }}
                </dd>
            </div>
            <div v-if="proposal.data.location" class="grid grid-cols-3 gap-2">
                <dt class="col-span-1 text-gray-500">地点</dt>
                <dd class="col-span-2 font-medium">{{ proposal.data.location }}</dd>
            </div>
            <div v-if="proposal.data.attendees" class="grid grid-cols-3 gap-2">
                <dt class="col-span-1 text-gray-500">参与者</dt>
                <dd class="col-span-2 font-medium">{{ proposal.data.attendees }}</dd>
            </div>
            <div class="grid grid-cols-3 gap-2">
                <dt class="col-span-1 text-gray-500">优先级</dt>
                <dd class="col-span-2">
                    <span class="rounded-md bg-gray-100 px-2 py-0.5 text-xs">
                        {{ resolvePriorityLabel(proposal.data.priority) }}
                    </span>
                </dd>
            </div>
        </dl>

        <div
            v-if="proposal.followUpQuestion || (proposal.missingFields?.length ?? 0) > 0"
            class="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800"
        >
            <div>{{ proposal.followUpQuestion }}</div>
            <div v-if="proposal.missingFields?.length">
                仍缺少：{{ proposal.missingFields.join("，") }}
            </div>
        </div>

        <div class="mt-4 flex items-center gap-2 text-sm">
            <UButton
                size="xs"
                color="primary"
                :loading="pending"
                :disabled="pending || hasBlockingMissingFields"
                @click="emit('confirm')"
            >
                确认
            </UButton>
            <UButton size="xs" variant="soft" color="neutral" @click="emit('edit')">编辑</UButton>
            <UButton size="xs" variant="ghost" color="neutral" @click="emit('cancel')">
                取消
            </UButton>
        </div>
    </div>
</template>
