<script lang="ts" setup>
import type { ScheduleConfig } from "@buildingai/service/consoleapi/user-schedule";
import {
    apiGetScheduleConfig,
    apiUpdateScheduleConfig,
} from "@buildingai/service/consoleapi/user-schedule";
import { computed, defineAsyncComponent, onMounted } from "vue";

const ModelSelect = defineAsyncComponent(() => import("@//components/model-select.vue"));

const { t, tm } = useI18n();
const message = useMessage();

const defaultConfig: ScheduleConfig = {
    modelId: "",
    temperature: 0.2,
    systemPrompt: "",
    contextLimit: 5,
};

const formData = reactive<ScheduleConfig>({ ...defaultConfig });

type PlaceholderItem = { token: string; description: string };

const highlightToken = (value: string) => {
    if (!value) return "";
    return value.replace(
        /(\{\{[^}]+\}\})/g,
        "<span class='text-blue-600 font-semibold dark:text-blue-400'>$1</span>",
    );
};

const placeholderItems = computed<PlaceholderItem[]>(() => {
    const translated = tm("ai-schedule.backend.config.placeholders.items") as
        | PlaceholderItem[]
        | undefined;
    if (Array.isArray(translated)) return translated;
    return [
        {
            token: "{{current_time}}",
            description: "ISO timestamp of current server time",
        },
        {
            token: "{{user_timezone}}",
            description: "End-user timezone identifier",
        },
        {
            token: "{{upcoming_events}}",
            description: "Upcoming events formatted as id|title|start|end",
        },
    ];
});

const clampNumber = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

const normalizeTemperature = () => {
    const raw = Number(formData.temperature ?? defaultConfig.temperature);
    if (Number.isNaN(raw)) {
        formData.temperature = defaultConfig.temperature;
        return;
    }
    formData.temperature = Number(clampNumber(raw, 0, 1).toFixed(2));
};

const normalizeContextLimit = () => {
    const raw = Number(formData.contextLimit ?? defaultConfig.contextLimit);
    if (Number.isNaN(raw)) {
        formData.contextLimit = defaultConfig.contextLimit;
        return;
    }
    formData.contextLimit = clampNumber(Math.round(raw), 1, 20);
};

const { lockFn: fetchConfig, isLock: loadingConfig } = useLockFn(async () => {
    try {
        const config = await apiGetScheduleConfig();
        Object.assign(formData, defaultConfig, config ?? {});
        normalizeTemperature();
        normalizeContextLimit();
    } catch (error) {
        console.error("Failed to load schedule config:", error);
        message.error(t("ai-schedule.backend.config.messages.fetchFailed"));
    }
});

const { lockFn: submitForm, isLock: saving } = useLockFn(async () => {
    if (!formData.modelId) {
        message.warning(t("ai-schedule.backend.config.messages.modelRequired"));
        return;
    }

    normalizeTemperature();
    normalizeContextLimit();

    const payload: ScheduleConfig = {
        modelId: formData.modelId,
        temperature: formData.temperature,
        contextLimit: formData.contextLimit,
        systemPrompt: formData.systemPrompt?.trim() || "",
    };

    try {
        await apiUpdateScheduleConfig(payload);
        message.success(t("ai-schedule.backend.config.messages.updateSuccess"));
        await fetchConfig();
    } catch (error) {
        console.error("Failed to update schedule config:", error);
        message.error(t("ai-schedule.backend.config.messages.updateFailed"));
    }
});

onMounted(() => fetchConfig());
</script>

<template>
    <div class="schedule-config-page pb-12">
        <div class="mx-auto max-w-5xl space-y-6">
            <header class="flex flex-wrap items-start justify-between gap-4">
                <div class="space-y-2">
                    <p class="text-xs font-semibold tracking-[0.3em] text-gray-400 uppercase">
                        {{ t("console-menu.aiConversation.scheduleConfig") }}
                    </p>
                    <div>
                        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
                            {{ t("ai-schedule.backend.config.title") }}
                        </h1>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                            {{ t("ai-schedule.backend.config.description") }}
                        </p>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <UButton
                        variant="soft"
                        color="neutral"
                        size="md"
                        icon="i-lucide-refresh-cw"
                        @click="fetchConfig"
                        :loading="loadingConfig"
                    >
                        {{ t("ai-schedule.backend.config.actions.refresh") }}
                    </UButton>
                    <AccessControl :codes="['user-schedule:update-config']">
                        <UButton
                            color="primary"
                            size="md"
                            type="submit"
                            form="schedule-config-form"
                            :loading="saving"
                            :disabled="loadingConfig"
                        >
                            {{ t("console-common.save") }}
                        </UButton>
                    </AccessControl>
                </div>
            </header>

            <UForm
                id="schedule-config-form"
                :state="formData"
                class="space-y-6"
                @submit="submitForm"
            >
                <UCard>
                    <template #header>
                        <div>
                            <h3 class="text-lg font-semibold">
                                {{ t("ai-schedule.backend.config.model.title") }}
                            </h3>
                            <p class="text-sm text-gray-500">
                                {{ t("ai-schedule.backend.config.model.description") }}
                            </p>
                        </div>
                    </template>

                    <div class="space-y-6">
                        <UFormField
                            :label="t('ai-schedule.backend.config.model.label')"
                            name="modelId"
                            required
                        >
                            <ModelSelect
                                v-model="formData.modelId"
                                :console="true"
                                :default-selected="false"
                                :disabled="loadingConfig"
                                :show-description="false"
                                :button-ui="{
                                    color: 'neutral',
                                    size: 'lg',
                                    class: 'w-full justify-between rounded-lg',
                                }"
                            />
                        </UFormField>
                        <p class="text-xs text-gray-500">
                            {{ t("ai-schedule.backend.config.model.helper") }}
                        </p>

                        <div class="grid gap-6 md:grid-cols-2">
                            <div>
                                <UFormField
                                    :label="t('ai-schedule.backend.config.temperature.label')"
                                    name="temperature"
                                >
                                    <UInput
                                        type="number"
                                        step="0.05"
                                        min="0"
                                        max="1"
                                        v-model.number="formData.temperature"
                                        @blur="normalizeTemperature"
                                        :disabled="loadingConfig"
                                        size="lg"
                                    />
                                </UFormField>
                                <p class="mt-1 text-xs text-gray-500">
                                    {{ t("ai-schedule.backend.config.temperature.description") }}
                                </p>
                            </div>

                            <div>
                                <UFormField
                                    :label="t('ai-schedule.backend.config.contextLimit.label')"
                                    name="contextLimit"
                                >
                                    <UInput
                                        type="number"
                                        min="1"
                                        max="20"
                                        step="1"
                                        v-model.number="formData.contextLimit"
                                        @blur="normalizeContextLimit"
                                        :disabled="loadingConfig"
                                        size="lg"
                                    />
                                </UFormField>
                                <p class="mt-1 text-xs text-gray-500">
                                    {{ t("ai-schedule.backend.config.contextLimit.description") }}
                                </p>
                            </div>
                        </div>
                    </div>
                </UCard>

                <UCard>
                    <template #header>
                        <div>
                            <h3 class="text-lg font-semibold">
                                {{ t("ai-schedule.backend.config.systemPrompt.title") }}
                            </h3>
                            <p class="text-sm text-gray-500">
                                {{ t("ai-schedule.backend.config.systemPrompt.description") }}
                            </p>
                        </div>
                    </template>

                    <div class="space-y-4">
                        <UFormField
                            :label="t('ai-schedule.backend.config.systemPrompt.label')"
                            name="systemPrompt"
                        >
                            <UTextarea
                                v-model="formData.systemPrompt"
                                :placeholder="
                                    t('ai-schedule.backend.config.systemPrompt.placeholder')
                                "
                                :rows="14"
                                :disabled="loadingConfig"
                                class="font-mono w-full"
                                :ui="{ root: 'w-full' }"
                            />
                        </UFormField>
                        <p class="text-xs text-gray-500">
                            {{ t("ai-schedule.backend.config.systemPrompt.helper") }}
                        </p>

                        <div
                            class="rounded-xl bg-gray-50 p-4 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-200"
                        >
                            <p class="mb-2 font-medium">
                                {{ t("ai-schedule.backend.config.systemPrompt.preview") }}
                            </p>
                            <div
                                class="text-[11px] leading-relaxed break-words whitespace-pre-wrap font-mono"
                                v-html="
                                    highlightToken(
                                        formData.systemPrompt?.trim() ||
                                            t('ai-schedule.backend.config.systemPrompt.example'),
                                    )
                                "
                            ></div>
                        </div>
                    </div>
                </UCard>

                <UCard>
                    <template #header>
                        <div>
                            <h3 class="text-lg font-semibold">
                                {{ t("ai-schedule.backend.config.placeholders.title") }}
                            </h3>
                            <p class="text-sm text-gray-500">
                                {{ t("ai-schedule.backend.config.placeholders.description") }}
                            </p>
                        </div>
                    </template>

                    <div class="space-y-3">
                        <div
                            v-for="item in placeholderItems"
                            :key="item.token"
                            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-4 py-3 dark:border-gray-800"
                        >
                            <code
                                class="font-mono text-sm bg-blue-50 px-2 py-1 rounded text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                            >
                                {{ item.token }}
                            </code>
                            <div
                                class="flex-1 text-sm text-gray-600 dark:text-gray-300"
                                v-html="highlightToken(item.description)"
                            ></div>
                        </div>
                    </div>
                </UCard>

                <div class="flex justify-end gap-3 pt-2">
                    <UButton
                        variant="soft"
                        color="neutral"
                        :loading="loadingConfig"
                        icon="i-lucide-refresh-ccw"
                        @click="fetchConfig"
                    >
                        {{ t("ai-schedule.backend.config.actions.refresh") }}
                    </UButton>
                    <AccessControl :codes="['user-schedule:update-config']">
                        <UButton color="primary" size="lg" type="submit" :loading="saving">
                            {{ t("console-common.save") }}
                        </UButton>
                    </AccessControl>
                </div>
            </UForm>
        </div>
    </div>
</template>
