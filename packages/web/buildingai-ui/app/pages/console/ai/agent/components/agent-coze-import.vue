<script setup lang="ts">
import {
    apiGetCozeBotList,
    apiImportCozeAgent,
    type CozeBot,
} from "@buildingai/service/consoleapi/ai-agent";
import PinyinMatch from "pinyin-match";

const emits = defineEmits<{
    (e: "close", refresh?: boolean): void;
}>();

const toast = useMessage();
const { t } = useI18n();

interface ExtendedCozeBot extends CozeBot {
    isImported?: boolean;
}

// Coze state
const cozeBots = shallowRef<ExtendedCozeBot[]>([]);
const selectedCozeBots = shallowRef<ExtendedCozeBot[]>([]);
const cozeLoading = shallowRef(false);
const cozePage = shallowRef(1);
const cozeHasMore = shallowRef(true);
const filterImported = shallowRef<"all" | "imported" | "not_imported">("all");
const searchQuery = shallowRef("");

const filterOptions = computed(() => [
    { label: t("ai-agent.backend.cozeImport.filterAll"), value: "all" },
    { label: t("ai-agent.backend.cozeImport.filterImported"), value: "imported" },
    { label: t("ai-agent.backend.cozeImport.filterNotImported"), value: "not_imported" },
]);

const fetchCozeBots = async () => {
    if (cozeLoading.value) return;
    cozeLoading.value = true;
    try {
        const res = await apiGetCozeBotList({ page: cozePage.value, pageSize: 20 });
        if (cozePage.value === 1) {
            cozeBots.value = (res.items || []) as ExtendedCozeBot[];
        } else {
            if (res.items && res.items.length) {
                cozeBots.value = [...cozeBots.value, ...(res.items as ExtendedCozeBot[])];
            }
        }
        cozeHasMore.value = res.totalPages > cozePage.value;
    } catch (error) {
        console.error("Failed to fetch Coze bots", error);
    } finally {
        cozeLoading.value = false;
    }
};

const loadMoreCozeBots = () => {
    if (cozeHasMore.value) {
        cozePage.value++;
        fetchCozeBots();
    }
};

const displayedBots = computed(() => {
    let bots = [...cozeBots.value];

    if (searchQuery.value) {
        bots = bots.filter((b) => PinyinMatch.match(b.name, searchQuery.value));
    }

    if (filterImported.value === "imported") {
        bots = bots.filter((b) => b.isImported);
    } else if (filterImported.value === "not_imported") {
        bots = bots.filter((b) => !b.isImported);
    }

    return bots;
});

const toggleSelection = (bot: ExtendedCozeBot) => {
    const index = selectedCozeBots.value.findIndex((b) => b.id === bot.id);
    if (index > -1) {
        selectedCozeBots.value.splice(index, 1);
    } else {
        selectedCozeBots.value.push(bot);
    }
    selectedCozeBots.value = [...selectedCozeBots.value];
};

const { lockFn: submitImport, isLock } = useLockFn(async () => {
    if (selectedCozeBots.value.length === 0) {
        toast.error(t("ai-agent.backend.cozeImport.selectAtLeastOne"));
        return;
    }

    for (const bot of selectedCozeBots.value) {
        await apiImportCozeAgent({
            cozeBotId: bot.id,
            name: bot.name,
            description: bot.description,
            avatar: bot.icon_url,
            isUpdate: bot.isImported,
        });
    }

    toast.success(t("ai-agent.backend.cozeImport.success"));
    emits("close", true);
});

onMounted(() => {
    fetchCozeBots();
});
</script>

<template>
    <BdModal
        :title="$t('ai-agent.backend.cozeImport.title')"
        :description="$t('ai-agent.backend.cozeImport.desc')"
        :ui="{ content: 'max-w-lg' }"
        @close="emits('close', false)"
    >
        <div class="py-4">
            <div class="mb-4 flex gap-2">
                <UInput
                    v-model="searchQuery"
                    icon="i-lucide-search"
                    :placeholder="$t('common.search')"
                    class="flex-1"
                />
                <USelectMenu
                    v-model="filterImported"
                    :items="filterOptions"
                    class="w-32"
                    value-key="value"
                    label-key="label"
                    :search-input="false"
                >
                </USelectMenu>
            </div>
            <div class="max-h-96 space-y-2 overflow-y-auto">
                <div
                    v-for="bot in displayedBots"
                    :key="bot.id"
                    class="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md border p-2"
                    :class="{
                        'border-primary bg-accent': selectedCozeBots.some((b) => b.id === bot.id),
                        'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20':
                            bot.isImported,
                    }"
                    @click="toggleSelection(bot)"
                >
                    <UAvatar :src="bot.icon_url" :alt="bot.name" size="sm" />
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                            <p class="truncate font-medium">{{ bot.name }}</p>
                            <UBadge
                                v-if="bot.isImported"
                                color="success"
                                variant="subtle"
                                size="xs"
                                >{{ $t("ai-agent.backend.cozeImport.imported") }}</UBadge
                            >
                        </div>
                        <p class="text-muted-foreground truncate text-xs">
                            {{ bot.description }}
                        </p>
                    </div>
                    <div v-if="selectedCozeBots.some((b) => b.id === bot.id)">
                        <UIcon name="i-lucide-check-circle" class="text-primary h-5 w-5" />
                    </div>
                </div>
                <div v-if="cozeLoading" class="text-muted-foreground py-2 text-center text-sm">
                    {{ $t("common.loading") }}
                </div>
                <div v-if="!cozeLoading && cozeHasMore" class="text-center">
                    <UButton variant="link" size="sm" @click="loadMoreCozeBots">{{
                        $t("common.loadMore")
                    }}</UButton>
                </div>
                <div
                    v-if="!cozeLoading && displayedBots.length === 0"
                    class="text-muted-foreground py-4 text-center"
                >
                    {{ $t("ai-agent.backend.cozeImport.noBotsFound") }}
                </div>
            </div>
        </div>

        <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" size="lg" @click="emits('close', false)">
                {{ $t("console-common.cancel") }}
            </UButton>
            <UButton color="primary" size="lg" :loading="isLock" @click="submitImport">
                {{ $t("console-common.import") }} ({{ selectedCozeBots.length }})
            </UButton>
        </div>
    </BdModal>
</template>
