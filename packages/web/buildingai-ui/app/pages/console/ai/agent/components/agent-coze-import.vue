<script setup lang="ts">
import {
    apiGetCozeBotList,
    apiImportCozeAgent,
    type CozeBot,
} from "@buildingai/service/consoleapi/ai-agent";

const emits = defineEmits<{
    (e: "close", refresh?: boolean): void;
}>();

const toast = useMessage();
const { t } = useI18n();

// Coze state
const cozeBots = shallowRef<CozeBot[]>([]);
const selectedCozeBot = shallowRef<CozeBot | null>(null);
const cozeLoading = shallowRef(false);
const cozePage = shallowRef(1);
const cozeHasMore = shallowRef(true);

const fetchCozeBots = async () => {
    if (cozeLoading.value) return;
    cozeLoading.value = true;
    try {
        const res = await apiGetCozeBotList({ page: cozePage.value, pageSize: 20 });
        if (cozePage.value === 1) {
            cozeBots.value = res.items || [];
        } else {
            if (res.items && res.items.length) {
                cozeBots.value.push(...res.items);
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

const { lockFn: submitImport, isLock } = useLockFn(async () => {
    if (!selectedCozeBot.value) {
        toast.error("Please select a Coze bot");
        return;
    }
    await apiImportCozeAgent({
        cozeBotId: selectedCozeBot.value.id,
        name: selectedCozeBot.value.name,
        description: selectedCozeBot.value.description,
        avatar: selectedCozeBot.value.icon_url,
    });

    toast.success(t("ai-agent.backend.dslImport.success"));
    emits("close", true);
});

onMounted(() => {
    fetchCozeBots();
});
</script>

<template>
    <BdModal
        title="Import from Coze"
        description="Select a Coze bot to import as an agent."
        :ui="{ content: 'max-w-lg' }"
        @close="emits('close', false)"
    >
        <div class="py-4">
            <div class="max-h-96 space-y-2 overflow-y-auto">
                <div
                    v-for="bot in cozeBots"
                    :key="bot.id"
                    class="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md border p-2"
                    :class="{
                        'border-primary bg-accent': selectedCozeBot?.id === bot.id,
                    }"
                    @click="selectedCozeBot = bot"
                >
                    <UAvatar :src="bot.icon_url" :alt="bot.name" size="sm" />
                    <div class="min-w-0 flex-1">
                        <p class="truncate font-medium">{{ bot.name }}</p>
                        <p class="text-muted-foreground truncate text-xs">
                            {{ bot.description }}
                        </p>
                    </div>
                </div>
                <div v-if="cozeLoading" class="text-muted-foreground py-2 text-center text-sm">
                    Loading...
                </div>
                <div v-if="!cozeLoading && cozeHasMore" class="text-center">
                    <UButton variant="link" size="sm" @click="loadMoreCozeBots">Load More</UButton>
                </div>
                <div
                    v-if="!cozeLoading && cozeBots.length === 0"
                    class="text-muted-foreground py-4 text-center"
                >
                    No bots found
                </div>
            </div>
        </div>

        <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" size="lg" @click="emits('close', false)">
                {{ $t("console-common.cancel") }}
            </UButton>
            <UButton color="primary" size="lg" :loading="isLock" @click="submitImport">
                {{ $t("console-common.create") }}
            </UButton>
        </div>
    </BdModal>
</template>
