<template>
  <div
    class="h-full flex flex-col bg-white border-r border-gray-200 transition-all duration-300"
    :class="isCollapsed ? 'w-[60px]' : 'w-[260px]'"
  >
    <!-- 折叠按钮 -->
    <div
      class="flex items-center p-2 border-b border-gray-200"
      :class="isCollapsed ? 'justify-center' : 'justify-between'"
    >
      <span v-if="!isCollapsed" class="text-sm font-medium text-gray-700 ml-2"
        >文本结果</span
      >
      <button
        class="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg cursor-pointer transition-all hover:bg-gray-200"
        @click="toggleCollapse"
        :title="isCollapsed ? '展开' : '折叠'"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="w-5 h-5 text-gray-600 transition-transform duration-300"
          :class="{ 'rotate-180': isCollapsed }"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
    </div>

    <!-- 顶部工具栏：撤销 / 重做 -->
    <div v-if="!isCollapsed" class="px-3 pt-2 pb-2 border-b border-gray-100">
      <div class="flex items-center space-x-2 text-xs text-gray-500">
        <span class="flex-1">
          {{ hasDetails ? "当前图片 OCR 结果" : "暂无 OCR 结果" }}
        </span>
        <n-button size="tiny" tertiary :disabled="!canUndo" @click="onUndo">
          撤销
        </n-button>
        <n-button size="tiny" tertiary :disabled="!canRedo" @click="onRedo">
          重做
        </n-button>
      </div>
    </div>

    <!-- 文本列表 -->
    <div
      class="flex-1 overflow-y-auto px-2 py-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
      :class="isCollapsed ? 'pr-1' : 'pr-3'"
    >
      <VueDraggable
        v-if="detailsSource.length > 0"
        v-model="detailsSource"
        :animation="150"
        handle=".drag-handle"
        item-key="__key"
      >
        <TextResultItem
          v-for="(item, index) in detailsSource"
          :key="item.__key"
          :detail="item"
          :index="index"
          :voice-role-options="voiceRoleOptions"
          @update-translated="handleChangeTranslated"
          @update-origin="handleChangeOrigin"
          @update-voice-role="handleChangeVoiceRole"
          @delete-detail="handleDeleteDetail"
        />
      </VueDraggable>

      <div
        v-else
        class="h-full flex items-center justify-center text-xs text-gray-400"
      >
        暂无 OCR 结果
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import { VueDraggable } from "vue-draggable-plus";
import { NButton } from "naive-ui";
import type { OcrTextDetail } from "../types";
import { useOcrStore } from "../stores/ocrStore";
import TextResultItem from "./TextResultItem.vue";
import { useArrayHistory } from "../composables/useArrayHistory";

interface Props {
  voiceRoleOptions: Array<{ label: string; value: string }>;
}

defineProps<Props>();

const ocrStore = useOcrStore();

const isCollapsed = ref(false);
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

const details = computed(() => ocrStore.currentDetails);

// 历史记录：仅针对当前图片的 OCR 详情列表（不包含 File 等复杂对象）
// 使用浅层数组 + 显式拷贝，避免 deep 监听带来的性能开销
const detailsSource = ref<any[]>([]);

// 标记当前是否处于从 Store 同步到本地的过程，避免形成递归更新
const syncingFromStore = ref(false);

// 同步 Pinia 中的详情到本地 source，用于记录历史（单向：Pinia -> history）
watch(
  details,
  (val) => {
    syncingFromStore.value = true;
    detailsSource.value = (val || []).map((d, index) => ({
      ...(d as any),
      __key: `${index}-${d.minX}-${d.minY}-${d.maxX}-${d.maxY}-${d.text}`,
    }));
    // 下一轮 tick 再允许本地变更同步回 Store，避免本次 watch 触发的变更再次写回
    nextTick(() => {
      syncingFromStore.value = false;
    });
  },
  { immediate: true, deep: true }
);

// 历史记录：基于数组快照的撤销 / 重做
const { undo, redo, canUndo, canRedo } = useArrayHistory(detailsSource, {
  maxSize: 100,
  debounce: 200,
  ignoreRef: syncingFromStore,
});

const hasDetails = computed(
  () => detailsSource.value && detailsSource.value.length > 0
);

// 提交当前 detailsSource 到 Pinia（去掉内部 __key 字段）
const commitToStore = () => {
  if (syncingFromStore.value) return;

  const pure: OcrTextDetail[] = (detailsSource.value || []).map((item: any) => {
    const { __key, ...rest } = item;
    return rest as OcrTextDetail;
  });
  ocrStore.replaceCurrentDetails(pure);
};

// 数据变化时自动同步到 Pinia
watch(
  detailsSource,
  () => {
    commitToStore();
  },
  { deep: false }
);

const handleChangeTranslated = (detailIndex: number, value: string) => {
  const list = [...(detailsSource.value || [])];
  const target = list[detailIndex];
  if (!target) return;
  list[detailIndex] = {
    ...target,
    translatedText: value,
    text: value,
  };
  detailsSource.value = list;
};

const handleChangeOrigin = (detailIndex: number, value: string) => {
  const list = [...(detailsSource.value || [])];
  const target = list[detailIndex];
  if (!target) return;
  list[detailIndex] = {
    ...target,
    originText: value,
  };
  detailsSource.value = list;
};

const handleChangeVoiceRole = (detailIndex: number, value: string | null) => {
  const list = [...(detailsSource.value || [])];
  const target = list[detailIndex];
  if (!target) return;
  list[detailIndex] = {
    ...target,
    voiceRole: value || "",
  };
  detailsSource.value = list;
};

const handleDeleteDetail = (detailIndex: number) => {
  const list = (detailsSource.value || []).filter(
    (_: any, idx: number) => idx !== detailIndex
  );
  detailsSource.value = list;
};

const onUndo = () => undo();
const onRedo = () => redo();
</script>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
