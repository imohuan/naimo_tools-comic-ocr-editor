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
        class="image-item relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 group"
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
          class="absolute bottom-1 left-1 bg-white/90 text-gray-700 text-xs px-1.5 py-0.5 rounded flex items-center justify-center"
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
          v-else-if="image.ocrResult"
          class="absolute bottom-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded"
        >
          OCR
        </div>
      </div>
    </div>

    <!-- 底部批量 OCR 工具栏 -->
    <div
      class="border-t border-gray-200 px-3 py-2 flex items-center justify-start text-xs"
    >
      <!-- 折叠状态：只显示一个小方形图标按钮，不显示文字和下拉 -->
      <div v-if="isCollapsed" class="w-full flex justify-center">
        <button
          class="w-8 h-8 flex items-center justify-center rounded-md text-white bg-blue-500 hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          type="button"
          :disabled="!canBatchRun && !batchRunning"
          @click="batchRunning ? handleStopBatchOcr() : handleStartBatchOcr()"
        >
          <svg
            v-if="!batchRunning"
            class="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          <svg
            v-else
            class="w-3.5 h-3.5 animate-spin"
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
              d="M4 12a8 8 0 0 1 8-8"
              stroke="currentColor"
            />
          </svg>
        </button>
      </div>

      <!-- 展开状态：完整按钮 + 模式下拉 -->
      <div
        v-else
        class="inline-flex items-stretch h-8 rounded-md overflow-hidden"
        :class="
          batchRunning
            ? 'bg-red-500 text-white'
            : !canBatchRun
            ? 'bg-gray-300 text-gray-500'
            : 'bg-blue-500 text-white'
        "
      >
        <!-- 左侧执行区域 -->
        <button
          class="flex-1 flex items-center gap-1 px-3 text-xs font-medium"
          :class="{
            'cursor-pointer hover:bg-blue-600': canBatchRun && !batchRunning,
            'cursor-pointer hover:bg-red-600': batchRunning,
            'cursor-not-allowed opacity-60': !canBatchRun && !batchRunning,
          }"
          :disabled="!canBatchRun && !batchRunning"
          @click="batchRunning ? handleStopBatchOcr() : handleStartBatchOcr()"
          type="button"
        >
          <!-- 左侧图标：未运行时为播放图标，运行中为加载中的圆环 -->
          <svg
            v-if="!batchRunning"
            class="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          <svg
            v-else
            class="w-3.5 h-3.5 animate-spin"
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
          <span>{{ batchRunning ? "停止" : "批量 OCR" }}</span>
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
                'cursor-pointer hover:bg-blue-600':
                  !batchRunning && (canBatchRun || batchRunning),
                'cursor-not-allowed opacity-60':
                  batchRunning || (!canBatchRun && !batchRunning),
              }"
              :disabled="batchRunning || (!canBatchRun && !batchRunning)"
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
            <div class="font-medium mb-1">批量 OCR 模式</div>

            <button
              class="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-gray-100 transition-colors"
              :class="
                batchMode === 'skipDone' ? 'bg-blue-50 text-blue-600' : ''
              "
              type="button"
              @click="handleSelectBatchMode('skipDone')"
            >
              <span>仅未 OCR 图片</span>
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
              <span>强制所有图片 OCR</span>
              <span
                v-if="batchMode === 'forceAll'"
                class="text-blue-500 text-[10px]"
                >当前</span
              >
            </button>
          </div>
        </n-popover>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, toRefs } from "vue";
import { NPopover } from "naive-ui";
import { useOcrStore } from "../stores/ocrStore";

const store = useOcrStore();
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

// 批量 OCR 模式：仅处理未 OCR / 强制全部 OCR
const batchMode = ref<"skipDone" | "forceAll">("skipDone");
// 是否正在批量执行
const batchRunning = ref(false);
// 下一个待处理的图片索引
const nextBatchIndex = ref(0);

// Popover 显隐
const batchDropdownVisible = ref(false);

// 选择批量 OCR 模式
const handleSelectBatchMode = (key: "skipDone" | "forceAll") => {
  batchMode.value = key;
  batchDropdownVisible.value = false;
};

// 是否存在图片（用于控制按钮是否可用，仅在完全无图片时禁用）
const canBatchRun = computed(() => {
  return !!(images.value && images.value.length > 0);
});

// 内部：执行实际批量 OCR 逻辑（从 nextBatchIndex 开始，逐个执行）
const runBatchOcrInternal = async () => {
  const list = images.value || [];
  if (list.length === 0) return;

  batchRunning.value = true;

  for (let i = nextBatchIndex.value; i < list.length; i++) {
    nextBatchIndex.value = i;

    const img = list[i];
    // 只处理图片文件存在的项
    if (!img || !img.file) {
      continue;
    }

    // 普通模式：跳过已经有 OCR 结果的图片
    if (batchMode.value === "skipDone" && img.ocrResult) {
      continue;
    }

    // 如果在循环中被要求停止，则直接退出
    if (!batchRunning.value) {
      nextBatchIndex.value = i;
      return;
    }

    // 逐张执行 OCR，结果总是以最新结果为准
    await store.runOcrTask(img.id, img.file, (_prev, next) => next);
  }

  // 执行完成后重置状态
  batchRunning.value = false;
  nextBatchIndex.value = 0;
};

// 点击开始批量 OCR
const handleStartBatchOcr = async () => {
  if (!canBatchRun.value || batchRunning.value) return;
  nextBatchIndex.value = 0;
  await runBatchOcrInternal();
};

// 点击停止批量 OCR（当前图片请求结束后不再继续后续）
const handleStopBatchOcr = () => {
  if (!batchRunning.value) return;
  batchRunning.value = false;
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
