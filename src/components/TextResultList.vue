<template>
  <div
    v-show="!isCollapsed"
    class="relative h-full flex flex-col bg-white border-r border-gray-200"
    :style="{ width: `${boundedWidth}px` }"
  >
    <!-- 顶部工具栏 -->
    <div
      class="flex p-2 border-b border-gray-200 gap-2"
      :class="isCollapsed ? 'flex-col items-center' : 'items-center justify-between'"
    >
      <span v-if="!isCollapsed" class="text-sm font-medium text-gray-700 ml-2"
        >文本结果</span
      >
      <button
        class="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg cursor-pointer transition-all hover:bg-gray-200 outline-none"
        @click="toggleCollapse"
        title="关闭文本结果面板"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="w-5 h-5 text-gray-600"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <!-- 顶部工具栏：撤销 / 重做 -->
    <div v-if="!isCollapsed" class="px-3 pt-2 pb-2 border-b border-gray-100">
      <div class="flex items-center space-x-2 text-xs text-gray-500">
        <span class="flex-1">
          {{ hasDetails ? "当前图片 OCR 结果" : "暂无 OCR 结果" }}
        </span>
        <button
          class="icon-button"
          :class="{ disabled: !canUndo }"
          :disabled="!canUndo"
          @click="onUndo"
          title="撤销 (Ctrl + Z)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="w-4 h-4"
          >
            <path d="M9 5L4 9l5 4" />
            <path d="M20 19v-2a6 6 0 0 0-6-6H4" />
          </svg>
        </button>
        <button
          class="icon-button"
          :class="{ disabled: !canRedo }"
          :disabled="!canRedo"
          @click="onRedo"
          title="重做 (Ctrl + Y)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="w-4 h-4"
          >
            <path d="M15 5l5 4-5 4" />
            <path d="M4 19v-2a6 6 0 0 1 6-6h10" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 文本列表 -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div
        class="h-full flex-1 overflow-y-auto px-2 py-2 pr-3 space-y-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
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
            :progress="getDetailProgress(item.id)"
            :voice-role-options="voiceRoleOptions"
            @update-translated="handleChangeTranslated"
            @update-origin="handleChangeOrigin"
            @update-voice-role="handleChangeVoiceRole"
            @delete-detail="handleDeleteDetail"
            @generate-audio="handleGenerateAudio"
          />
        </VueDraggable>

        <div v-else class="h-full flex items-center justify-center text-xs text-gray-400">
          暂无 OCR 结果
        </div>
      </div>

      <!-- 底部批量音频生成工具栏 -->
      <div
        class="border-t border-gray-200 px-3 py-2 flex items-center justify-between text-xs"
      >
        <div
          class="inline-flex items-stretch h-8 rounded-md overflow-hidden"
          :class="!canBatchRun ? 'bg-gray-300 text-gray-500' : 'bg-blue-500 text-white'"
        >
          <!-- 左侧执行区域 -->
          <button
            class="flex-1 flex items-center gap-1 px-3 text-xs font-medium"
            :class="{
              'cursor-pointer hover:bg-blue-600': canBatchRun,
              'cursor-not-allowed opacity-60': !canBatchRun,
            }"
            :disabled="!canBatchRun"
            @click="handleStartBatchAudio"
            type="button"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>批量音频</span>
          </button>

          <!-- 右侧批量模式下拉 -->
          <n-popover
            trigger="click"
            v-model:show="batchDropdownVisible"
            placement="top-end"
            :to="false"
            :show-arrow="false"
          >
            <template #trigger>
              <button
                class="flex items-center justify-center px-2 text-xs border-l border-white/20"
                :class="{
                  'cursor-pointer hover:bg-blue-600': canBatchRun,
                  'cursor-not-allowed opacity-60': !canBatchRun,
                }"
                :disabled="!canBatchRun"
                type="button"
              >
                <svg
                  class="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </template>

            <div class="px-3 py-2 text-xs text-gray-700 space-y-1 w-56">
              <div class="font-medium mb-1">批量音频生成设置</div>

              <button
                class="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                :class="batchMode === 'skipDone' ? 'bg-blue-50 text-blue-600' : ''"
                type="button"
                @click="handleSelectBatchMode('skipDone')"
              >
                <span>仅未生成音频</span>
                <span v-if="batchMode === 'skipDone'" class="text-blue-500 text-[10px]"
                  >当前</span
                >
              </button>

              <button
                class="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                :class="batchMode === 'forceAll' ? 'bg-blue-50 text-blue-600' : ''"
                type="button"
                @click="handleSelectBatchMode('forceAll')"
              >
                <span>强制所有文本生成</span>
                <span v-if="batchMode === 'forceAll'" class="text-blue-500 text-[10px]"
                  >当前</span
                >
              </button>
            </div>
          </n-popover>
        </div>

        <button
          class="ml-3 h-8 px-3 rounded-md flex items-center gap-1 text-xs font-medium transition-colors"
          :class="
            canPlaySequence
              ? 'bg-indigo-500 text-white hover:bg-indigo-600'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          "
          :disabled="!canPlaySequence"
          type="button"
          @click="handleOpenPlayback"
        >
          <span
            v-if="playerLoading"
            class="w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin"
          ></span>
          <svg v-else class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>{{ playerLoading ? "准备中" : "单图播放" }}</span>
        </button>
      </div>
    </div>

    <!-- 右侧拖拽条 -->
    <div
      class="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400/20 transition-colors"
      @mousedown.prevent="onResizeMouseDown"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, toRefs, onBeforeUnmount } from "vue";
import { VueDraggable } from "vue-draggable-plus";
import { storeToRefs } from "pinia";
import type { OcrTextDetail } from "../types";
import { useOcrStore } from "../stores/ocrStore";
import { useTaskStore } from "../stores/taskStore";
import { usePlaybackStore } from "../stores/playbackStore";
import TextResultItem from "./TextResultItem.vue";
import { NPopover } from "naive-ui";
import { uiEventBus } from "../core/event-bus";
import { useNotify } from "../composables/useNotify";

interface Props {
  voiceRoleOptions: Array<{ label: string; value: string }>;
  isCollapsed: boolean;
  width: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "toggle-collapse"): void;
  (e: "resize-width", value: number): void;
}>();
const { isCollapsed, width } = toRefs(props);

const ocrStore = useOcrStore();
const taskStore = useTaskStore();
const playbackStore = usePlaybackStore();
const { error: errorNotify, success: successNotify } = useNotify();
const { canUndoDetails, canRedoDetails } = storeToRefs(ocrStore);
const currentImage = computed(() => ocrStore.currentImage);

const isResizing = ref(false);
const resizeStartX = ref(0);
const resizeStartWidth = ref(0);
const MIN_WIDTH = 300;
const MAX_WIDTH = 500;

// 约束实际宽度在最小 / 最大范围内
const boundedWidth = computed(() => {
  if (width.value < MIN_WIDTH) return MIN_WIDTH;
  if (width.value > MAX_WIDTH) return MAX_WIDTH;
  return width.value;
});

const toggleCollapse = () => {
  emit("toggle-collapse");
};

const onResizeMouseDown = (event: MouseEvent) => {
  if (isCollapsed.value) return;
  isResizing.value = true;
  resizeStartX.value = event.clientX;
  // 使用受约束后的宽度作为起始值，避免初始就超出范围
  resizeStartWidth.value = boundedWidth.value;
  window.addEventListener("mousemove", onResizeMouseMove);
  window.addEventListener("mouseup", onResizeMouseUp);
};

const onResizeMouseMove = (event: MouseEvent) => {
  if (!isResizing.value) return;
  const delta = event.clientX - resizeStartX.value;
  let next = resizeStartWidth.value + delta;
  if (next < MIN_WIDTH) next = MIN_WIDTH;
  if (next > MAX_WIDTH) next = MAX_WIDTH;
  emit("resize-width", next);
};

const onResizeMouseUp = () => {
  if (!isResizing.value) return;
  isResizing.value = false;
  window.removeEventListener("mousemove", onResizeMouseMove);
  window.removeEventListener("mouseup", onResizeMouseUp);
};

onBeforeUnmount(() => {
  window.removeEventListener("mousemove", onResizeMouseMove);
  window.removeEventListener("mouseup", onResizeMouseUp);
});

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
      __key: `${(d as any).id || index}-${d.minX}-${d.minY}-${d.maxX}-${d.maxY}-${
        d.text
      }`,
    }));
    // 下一轮 tick 再允许本地变更同步回 Store，避免本次 watch 触发的变更再次写回
    nextTick(() => {
      syncingFromStore.value = false;
    });
  },
  { immediate: true, deep: true }
);

const canUndo = canUndoDetails;
const canRedo = canRedoDetails;

const hasDetails = computed(() => detailsSource.value && detailsSource.value.length > 0);

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

watch(
  detailsSource,
  () => {
    playerError.value = null;
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

// 单条音频生成：委托任务 Store 处理
const handleGenerateAudio = (detailIndex: number) => {
  const image = currentImage.value;
  if (!image?.ocrResult?.details?.length) return;
  const detail = (detailsSource.value || [])[detailIndex] as
    | (OcrTextDetail & { id?: string })
    | undefined;
  if (!detail?.id) return;
  taskStore.startAudioForDetail(image.id, detail.id);
};

const getDetailProgress = (detailId?: string) => {
  if (!detailId) return { loading: false, error: null };
  return taskStore.getProgressByKey(detailId);
};

// 批量音频生成：仅处理当前图片的文本结果
const batchMode = ref<"skipDone" | "forceAll">("skipDone");
const batchDropdownVisible = ref(false);
// 并发控制

// 播放器状态（本地仅做按钮 loading / 错误提示，全局播放交给 App 控制）
const playerLoading = ref(false);
const playerError = ref<string | null>(null);

// 是否存在文本（用于控制按钮是否可用）
const canBatchRun = computed(() => {
  return taskStore.canBatchAudio && hasDetails.value;
});

const canPlaySequence = computed(() => {
  return currentImage.value && !playerLoading.value;
});

const handleSelectBatchMode = (key: "skipDone" | "forceAll") => {
  batchMode.value = key;
  batchDropdownVisible.value = false;
};

// 计算将要添加的音频任务数量
const calculateAudioTaskCount = () => {
  const list = (detailsSource.value as Array<OcrTextDetail & { id?: string }>) || [];

  return list.filter((detail) => {
    if (batchMode.value === "skipDone" && detail.audioUrl) return false;
    return true;
  }).length;
};

const handleStartBatchAudio = () => {
  if (!canBatchRun.value) return;

  // 计算任务数量并显示提示
  const audioTaskCount = calculateAudioTaskCount();
  successNotify(`已添加 ${audioTaskCount} 个音频任务到队列`);

  taskStore.startBatchAudioForCurrentImage(batchMode.value);
};

const handleOpenPlayback = async () => {
  if (!canPlaySequence.value || playerLoading.value) return;
  playerLoading.value = true;
  playerError.value = null;
  try {
    const playlist = await playbackStore.buildCurrentImagePlaylist();
    if (!playlist.length) {
      throw new Error("暂无可播放的内容");
    }
    uiEventBus.emit("sequence-player:open", {
      source: "current-image",
      playlist,
    });
  } catch (error: any) {
    const errorMessage =
      typeof error?.message === "string" ? error.message : "播放准备失败";
    errorNotify(errorMessage);
  } finally {
    playerLoading.value = false;
  }
};

const onUndo = () => ocrStore.undoDetails();
const onRedo = () => ocrStore.redoDetails();

defineExpose({
  undo: onUndo,
  redo: onRedo,
});
</script>

<style scoped>
.icon-button {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  background-color: #ffffff;
  color: #4b5563;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.icon-button:hover:not(.disabled) {
  background-color: #f3f4f6;
  color: #1f2937;
}

.icon-button.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

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
