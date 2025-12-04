<template>
  <div
    class="h-full flex flex-col bg-white border-r border-gray-200 transition-all duration-300"
    :class="isCollapsed ? 'w-[60px]' : 'w-[250px]'"
  >
    <!-- 折叠按钮 -->
    <div
      class="flex p-2 border-b border-gray-200 gap-2"
      :class="
        isCollapsed ? 'flex-col items-center' : 'items-center justify-between'
      "
    >
      <span v-if="!isCollapsed" class="text-sm font-medium text-gray-700 ml-2"
        >图片列表</span
      >
      <button
        class="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg cursor-pointer transition-all hover:bg-gray-200 outline-none"
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

    <!-- 上传区 -->
    <div v-if="!isCollapsed" class="p-4 border-b border-gray-200">
      <div
        ref="uploadArea"
        class="flex items-center justify-center flex-col border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer transition-all duration-300 hover:border-blue-600 hover:bg-gray-50"
        :class="{ 'border-blue-600 bg-blue-50': isDragOver }"
        @click="handleUploadClick"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <svg
          class="w-8 h-8 mx-auto text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p class="mt-1 text-xs text-gray-600">上传图片</p>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="handleFileChange"
        />
      </div>
    </div>

    <!-- 折叠状态下的上传按钮 -->
    <div v-else class="p-2 border-b border-gray-200">
      <button
        class="w-full aspect-square flex items-center justify-center bg-blue-500 rounded-lg cursor-pointer transition-all hover:bg-blue-600 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        @click="handleUploadClick"
        title="上传图片"
      >
        <svg
          class="w-6 h-6 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="handleFileChange"
      />
    </div>

    <!-- 图片列表 -->
    <div
      class="flex-1 overflow-y-auto flex flex-col scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
      :class="isCollapsed ? 'p-2 gap-2' : 'p-4 gap-3'"
    >
      <div
        v-for="(image, index) in images"
        :key="index"
        class="image-item relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 group shrink-0"
        :class="[
          isCollapsed
            ? 'hover:scale-105'
            : 'hover:scale-[1.02] hover:shadow-md',
          index === currentIndex ? 'border-blue-600' : 'border-gray-200',
        ]"
        @click="selectImage(index)"
      >
        <div
          class="w-full bg-contain bg-center bg-no-repeat bg-gray-100 pointer-events-none"
          :class="isCollapsed ? 'aspect-square' : 'aspect-video'"
          :style="{
            backgroundImage: image.url ? `url(${image.url})` : 'none',
          }"
        ></div>
        <button
          class="remove-btn absolute bg-black/60 border-none rounded-full cursor-pointer flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-red-600/90"
          :class="
            isCollapsed ? 'top-0.5 right-0.5 w-4 h-4' : 'top-1 right-1 w-6 h-6'
          "
          @click.stop="removeImage(index)"
          title="删除"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            :class="isCollapsed ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'"
            class="text-white"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <!-- OCR状态指示 / 加载中指示 -->
        <div
          v-if="image.ocrLoading"
          class="absolute bottom-1 left-1 bg-white/90 text-blue-600 text-xs px-1.5 py-0.5 rounded flex items-center justify-center"
        >
          <svg
            class="w-3 h-3 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
            />
            <path
              class="opacity-75"
              d="M4 12a8 8 0 018-8"
              stroke="currentColor"
            />
          </svg>
        </div>
        <div
          v-else-if="isImagePendingOcr(image)"
          class="absolute bottom-1 left-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center justify-center"
        >
          <svg
            class="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <div
          v-else-if="hasImageOcrTask(image)"
          class="absolute bottom-1 left-1 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center justify-center"
        >
          <svg
            class="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </div>
        <div
          v-else-if="image.ocrResult"
          class="absolute bottom-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded"
        >
          OCR
        </div>
      </div>
    </div>

    <!-- 底部批量 OCR / 全局播放 工具栏 -->
    <div
      class="border-t border-gray-200 px-3 py-2 flex items-center justify-between text-xs"
    >
      <!-- 折叠状态：只显示一个小方形图标按钮，不显示文字和下拉 -->
      <div v-if="isCollapsed" class="w-full flex justify-center">
        <button
          class="w-8 h-8 flex items-center justify-center rounded-md text-white bg-blue-500 hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          type="button"
          :disabled="!canBatchExecute"
          @click="handleBatchExecute"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>

      <!-- 展开状态：完整按钮 + 模式下拉 -->
      <div
        v-else
        class="inline-flex items-stretch h-8 rounded-md overflow-hidden"
        :class="
          !canBatchExecute
            ? 'bg-gray-300 text-gray-500'
            : 'bg-blue-500 text-white'
        "
      >
        <!-- 左侧执行区域 -->
        <button
          class="flex-1 flex items-center gap-1 px-3 text-xs font-medium"
          :class="{
            'cursor-pointer hover:bg-blue-600': canBatchExecute,
            'cursor-not-allowed opacity-60': !canBatchExecute,
          }"
          :disabled="!canBatchExecute"
          @click="handleBatchExecute"
          type="button"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>批量 执行</span>
        </button>

        <!-- 右侧触发区域：使用 Naive Popover 展示自定义内容 -->
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

          <div class="px-3 py-2 text-xs text-gray-700 space-y-2 w-56">
            <div class="font-medium mb-1">批量 执行</div>

            <button
              class="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-gray-100 transition-colors"
              :class="
                batchMode === 'skipDone' ? 'bg-blue-50 text-blue-600' : ''
              "
              type="button"
              @click="handleSelectBatchMode('skipDone')"
            >
              <span>仅未完成任务</span>
              <span
                v-if="batchMode === 'skipDone'"
                class="text-blue-500 text-[10px]"
                >当前</span
              >
            </button>

            <button
              class="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-gray-100 transition-colors"
              :class="
                batchMode === 'forceAll' ? 'bg-blue-50 text-blue-600' : ''
              "
              type="button"
              @click="handleSelectBatchMode('forceAll')"
            >
              <span>强制全部任务</span>
              <span
                v-if="batchMode === 'forceAll'"
                class="text-blue-500 text-[10px]"
                >当前</span
              >
            </button>

            <div class="pt-2 mt-1 border-t border-gray-200 space-y-1">
              <div
                class="font-medium text-gray-800 flex items-center justify-between"
              >
                <span>执行内容</span>
                <span
                  v-if="!hasBatchAction"
                  class="text-[10px] text-red-500 font-normal"
                  >至少选择一项</span
                >
              </div>

              <n-checkbox
                size="small"
                :checked="isBatchOcrSelected"
                @update:checked="handleCheckboxChange('ocr', $event)"
                class="batch-option"
              >
                <div class="flex flex-col leading-tight text-gray-700">
                  <div class="flex items-center justify-between">
                    <span>执行 OCR</span>
                    <span
                      v-if="isBatchOcrSelected"
                      class="text-blue-500 text-[10px]"
                      >已启用</span
                    >
                  </div>
                  <p class="text-[10px] text-gray-400 mt-0.5">
                    按模式处理「仅未完成任务」或「强制全部任务」
                  </p>
                </div>
              </n-checkbox>

              <n-checkbox
                size="small"
                :checked="isBatchAudioSelected"
                @update:checked="handleCheckboxChange('audio', $event)"
                class="batch-option"
              >
                <div class="flex flex-col leading-tight text-gray-700">
                  <div class="flex items-center justify-between">
                    <span>执行音频生成</span>
                    <span
                      v-if="isBatchAudioSelected"
                      class="text-blue-500 text-[10px]"
                      >已启用</span
                    >
                  </div>
                  <p class="text-[10px] text-gray-400 mt-0.5">
                    若同时勾选 OCR，将在识别完成后自动加入音频队列
                  </p>
                </div>
              </n-checkbox>
            </div>
          </div>
        </n-popover>
      </div>

      <!-- 所有图片的序列播放按钮（仅在展开状态下显示） -->
      <button
        v-if="!isCollapsed"
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
        <span>{{ playerLoading ? "准备中" : "播放" }}</span>
      </button>

      <span v-if="playerError" class="ml-3 text-[11px] text-red-500">
        {{ playerError }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, toRefs } from "vue";
import { NPopover, NCheckbox } from "naive-ui";
import { useOcrStore } from "../stores/ocrStore";
import { useTaskStore } from "../stores/taskStore";
import type { ImageItem, OcrTextDetail } from "../types";
import { getImageDimensions, getImageDimensionsFromUrl } from "../utils/image";
import { uiEventBus } from "../core/event-bus";
import type { SequencePlaybackItem } from "./AudioSequencePlayer.vue";
import { useNotify } from "../composables/useNotify";
import { generateSilentAudio } from "../utils/audio";

const store = useOcrStore();
const taskStore = useTaskStore();
const { success: notify } = useNotify();
const props = defineProps<{
  isCollapsed: boolean;
}>();
const emit = defineEmits<{
  (e: "toggle-collapse"): void;
}>();
const { isCollapsed } = toRefs(props);

const uploadArea = ref<HTMLDivElement>();
const fileInput = ref<HTMLInputElement>();
const isDragOver = ref(false);

const toggleCollapse = () => {
  emit("toggle-collapse");
};

const handleUploadClick = () => {
  fileInput.value?.click();
};

const handleDragOver = () => {
  isDragOver.value = true;
};

const handleDragLeave = () => {
  isDragOver.value = false;
};

const handleDrop = (e: DragEvent) => {
  isDragOver.value = false;
  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length > 0) {
    store.addImages(files);
  }
};

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = Array.from(target.files || []);
  if (files.length > 0) {
    store.addImages(files);
  }
  target.value = "";
};

const selectImage = (index: number) => {
  store.selectImage(index);
};

const removeImage = (index: number) => {
  store.removeImage(index);
};

const images = computed(() => store.images);
const currentIndex = computed(() => store.currentIndex);

// 检查图片是否在OCR等待队列中
const isImagePendingOcr = (image: ImageItem) => {
  return image.id ? taskStore.isPendingOcrTask(image.id) : false;
};

// 检查图片是否已有OCR任务（等待中或运行中）
const hasImageOcrTask = (image: ImageItem) => {
  return image.id ? taskStore.hasOcrTask(image.id) : false;
};

// 批量 OCR 模式：仅处理未 OCR / 强制全部 OCR（UI 状态）
const batchMode = ref<"skipDone" | "forceAll">("skipDone");
type BatchAction = "ocr" | "audio";
const batchActions = ref<BatchAction[]>(["ocr"]);
const isBatchOcrSelected = computed(() => batchActions.value.includes("ocr"));
const isBatchAudioSelected = computed(() =>
  batchActions.value.includes("audio")
);
const hasBatchAction = computed(() => batchActions.value.length > 0);
// Popover 显隐
const batchDropdownVisible = ref(false);

// 选择批量 OCR 模式
const handleSelectBatchMode = (key: "skipDone" | "forceAll") => {
  batchMode.value = key;
  batchDropdownVisible.value = false;
};

const handleCheckboxChange = (action: BatchAction, checked: boolean) => {
  const next = new Set(batchActions.value);
  if (checked) {
    next.add(action);
  } else {
    next.delete(action);
  }
  batchActions.value = Array.from(next);
};

// 是否存在图片（用于控制按钮是否可用，仅在完全无图片时禁用）
const canBatchRun = computed(() => {
  return taskStore.canBatchOcr;
});
const canBatchExecute = computed(
  () => canBatchRun.value && hasBatchAction.value
);

// 序列播放（针对所有图片，仅维护按钮 loading / 错误状态）
const playerLoading = ref(false);
const playerError = ref<string | null>(null);

// 计算所有图片的文本音频是否都已就绪
const allAudioReady = computed(() => {
  const list = (images.value || []) as ImageItem[];
  if (!list.length) return false;

  const allDetails: (OcrTextDetail & {
    id?: string;
    audioLoading?: boolean;
  })[] = [];
  list.forEach((image) => {
    if (image?.ocrResult?.details?.length) {
      allDetails.push(
        ...(image.ocrResult.details as (OcrTextDetail & {
          id?: string;
          audioLoading?: boolean;
        })[])
      );
    }
  });

  if (!allDetails.length) return false;
  return allDetails.every((detail) => {
    const progress = detail.id ? taskStore.getProgressByKey(detail.id) : null;
    const loading = progress?.loading ?? false;
    return detail.audioUrl && !loading;
  });
});

const canPlaySequence = computed(() => {
  return allAudioReady.value && !playerLoading.value;
});

// 解析图片尺寸
const resolveImageSize = async (image: ImageItem) => {
  if (image.file) {
    return getImageDimensions(image.file);
  }
  const src = image.processedImageUrl || image.url;
  if (!src) {
    throw new Error("无法获取当前图片资源");
  }
  return getImageDimensionsFromUrl(src);
};

// 计算将要添加的任务数量
const calculateTaskCount = () => {
  const list = (images.value || []) as ImageItem[];
  let ocrTaskCount = 0;
  let audioTaskCount = 0;

  if (isBatchOcrSelected.value) {
    // 计算 OCR 任务数量
    ocrTaskCount = list.filter((img) => {
      if (!img?.file) return false;
      if (batchMode.value === "skipDone" && img.ocrResult) return false;
      return true;
    }).length;
  }

  if (isBatchAudioSelected.value) {
    // 计算音频任务数量
    list.forEach((img) => {
      if (!img?.ocrResult?.details?.length) return;
      img.ocrResult.details.forEach((detail) => {
        if (batchMode.value === "skipDone" && detail.audioUrl) return;
        audioTaskCount++;
      });
    });
  }

  return { ocrTaskCount, audioTaskCount, total: ocrTaskCount + audioTaskCount };
};

// 构建「所有图片」的播放列表
const buildGlobalPlaybackPlaylist = async (): Promise<
  SequencePlaybackItem[]
> => {
  const list = (images.value || []) as ImageItem[];
  if (!list.length) {
    throw new Error("当前没有可用图片");
  }

  const result: SequencePlaybackItem[] = [];

  for (const image of list) {
    const src = image.processedImageUrl || image.url;
    if (!src) {
      continue;
    }

    const { width, height } = await resolveImageSize(image);

    // 如果没有 OCR 结果或详情为空，创建一个 3 秒的空白播放项
    if (!image.ocrResult || !image.ocrResult.details?.length) {
      // 生成 3 秒空白音频
      const { blob } = await generateSilentAudio(3);
      const silentAudioUrl = URL.createObjectURL(blob);

      result.push({
        image: src,
        audio: silentAudioUrl,
        text: "",
        rect: null, // 设置为 null 表示没有需要高亮的区域
        imageWidth: width,
        imageHeight: height,
      });
    } else {
      // 正常处理有 OCR 结果的图片
      for (const detail of image.ocrResult.details as OcrTextDetail[]) {
        result.push({
          image: src,
          audio: detail.audioUrl || "",
          text: detail.translatedText || detail.text || "",
          rect: {
            minX: detail.minX,
            minY: detail.minY,
            maxX: detail.maxX,
            maxY: detail.maxY,
          },
          imageWidth: width,
          imageHeight: height,
        });
      }
    }
  }

  return result;
};

// 打开序列播放（所有图片）
const handleOpenPlayback = async () => {
  if (!canPlaySequence.value || playerLoading.value) return;
  playerLoading.value = true;
  playerError.value = null;

  try {
    const playlist = await buildGlobalPlaybackPlaylist();
    if (!playlist.length) {
      throw new Error("暂无可播放的音频");
    }
    if (!playlist.every((item) => item.audio)) {
      throw new Error("存在未生成的音频，无法播放");
    }
    uiEventBus.emit("sequence-player:open", {
      source: "all-images",
      playlist,
    });
  } catch (error: any) {
    playerError.value =
      typeof error?.message === "string" ? error.message : "播放准备失败";
  } finally {
    playerLoading.value = false;
  }
};

// 执行批量任务
const handleBatchExecute = () => {
  if (!canBatchExecute.value) return;
  const wantsOcr = isBatchOcrSelected.value;
  const wantsAudio = isBatchAudioSelected.value;

  // 计算任务数量并显示提示
  const { ocrTaskCount, audioTaskCount, total } = calculateTaskCount();

  let message = `已添加 ${total} 个任务到队列`;
  if (wantsOcr && wantsAudio) {
    message = `已添加 ${ocrTaskCount} 个 OCR 任务和 ${audioTaskCount} 个音频任务到队列`;
  } else if (wantsOcr) {
    message = `已添加 ${ocrTaskCount} 个 OCR 任务到队列`;
  } else if (wantsAudio) {
    message = `已添加 ${audioTaskCount} 个音频任务到队列`;
  }

  notify(message);

  if (wantsAudio) {
    if (!wantsOcr) {
      taskStore.startBatchAudioForAllImages(batchMode.value);
      return;
    }

    if (batchMode.value === "skipDone") {
      taskStore.startBatchAudioForAllImages("skipDone");
    }
  }

  if (wantsOcr) {
    taskStore.startBatchOcr(
      batchMode.value,
      wantsAudio
        ? {
            withAudio: true,
            audioMode: batchMode.value,
          }
        : undefined
    );
  }
};
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
