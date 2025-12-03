<template>
  <div ref="container" class="w-full h-full relative">
    <canvas ref="canvasDom"></canvas>

    <!-- 对比模式的分割线和标签 -->
    <template v-if="isComparing">
      <!-- 左侧标签 -->
      <div
        class="absolute top-4 left-4 bg-black/70 text-white px-4 py-2 rounded-md text-sm font-medium z-50 pointer-events-none backdrop-blur"
      >
        原图
      </div>

      <!-- 右侧标签 -->
      <div
        class="absolute top-4 right-4 bg-black/70 text-white px-4 py-2 rounded-md text-sm font-medium z-50 pointer-events-none backdrop-blur"
      >
        处理后
      </div>

      <!-- 分割线 -->
      <div
        class="absolute top-0 bottom-0 w-1 bg-blue-600 cursor-ew-resize z-50 -translate-x-1/2"
        :style="{ left: comparePosition + '%' }"
        @mousedown.stop="handleDividerMouseDown"
      >
        <div
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-20 bg-blue-600 rounded-full shadow-[0_4px_12px_rgba(59,130,246,0.4)] flex items-center justify-center before:content-[''] before:absolute before:left-3.5 before:w-0.5 before:h-5 before:bg-white after:content-[''] after:absolute after:right-3.5 after:w-0.5 after:h-5 after:bg-white"
        ></div>
      </div>
    </template>

    <!-- 自定义右键菜单 -->
    <div
      v-if="showContextMenu"
      class="fixed z-50 min-w-[180px] rounded-xl border border-indigo-100 bg-white/95 shadow-xl py-2 text-sm text-gray-800 backdrop-blur-sm"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
    >
      <button
        type="button"
        class="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
        @click="handleContextMenuSelect('delete')"
      >
        <span
          class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-500"
        >
          <!-- 删除图标 -->
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3.5 4.5H12.5M6.5 2.5H9.5M5.5 4.5L6 12.5M10 4.5L9.5 12.5M4.5 4.5L5 12.5C5.08333 13.5 5.5 14 7 14H9C10.5 14 10.9167 13.5 11 12.5L11.5 4.5"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        删除
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
        @click="handleContextMenuSelect('reOcr')"
      >
        <span
          class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"
        >
          <!-- 重新识别图标 -->
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 8C3 5.79086 4.79086 4 7 4H9C11.2091 4 13 5.79086 13 8C13 10.2091 11.2091 12 9 12H5.5"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M5.5 5L7 4H5.5M5.5 4V5"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        重新识别
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick, onUnmounted } from "vue";
import type { OcrTextResult } from "../types";
import { useCanvas } from "../composables/useCanvas";
import { useCanvasPan } from "../composables/useCanvasPan";
import { useCanvasZoom } from "../composables/useCanvasZoom";
import { useCanvasDrawing } from "../composables/useCanvasDrawing";
import { useCanvasBrush } from "../composables/useCanvasBrush";
import { useCanvasCompare } from "../composables/useCanvasCompare";
import { canvasEventBus } from "../core/event-bus";

interface Props {
  image?: File | string;
  originalImage?: File | string;
  ocrResult?: OcrTextResult | null;
  waitingMode?: boolean;
  brushModeEnabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  image: undefined,
  originalImage: undefined,
  ocrResult: null,
  waitingMode: false,
  brushModeEnabled: false,
});

const emits = defineEmits<{
  "change-detail": [result: OcrTextResult];
  "waiting-rect-complete": [
    rect: {
      canvasX: number;
      canvasY: number;
      canvasWidth: number;
      canvasHeight: number;
      waitingRect: any;
    }
  ];
  "delete-detail": [detailIndex: number];
  "re-ocr-detail": [detailIndex: number];
  compare: [isComparing: boolean];
}>();

const container = ref<HTMLDivElement>();
const canvasDom = ref<HTMLCanvasElement>();

const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const selectedDetailIndex = ref<number | null>(null);

const {
  fabricCanvas,
  imageRect,
  initCanvas,
  resizeCanvas,
  loadImage,
  loadOcrBoxes,
  clearCanvas,
  clearOcrResults,
} = useCanvas(canvasDom, container);

const {
  setupDrawing,
  setWaitingMode,
  removeWaitingRect,
  clearAllWaitingRects,
  canvasToImageCoords,
  isWaitingMode,
} = useCanvasDrawing(fabricCanvas, imageRect);

useCanvasPan(fabricCanvas, isWaitingMode);
const brushModeEnabledRef = computed(() => props.brushModeEnabled);
useCanvasBrush(fabricCanvas, brushModeEnabledRef);
const { zoomLevel } = useCanvasZoom(fabricCanvas, imageRect);

// 对比功能
const {
  isComparing,
  comparePosition,
  loadCompareImages,
  handleDividerMouseDown,
  handleGlobalMouseMove,
  handleGlobalMouseUp,
  toggleCompare,
  handleViewportChange,
  cleanupBlobUrls,
} = useCanvasCompare(fabricCanvas, imageRect, container);

// 统一的图片 + OCR 加载逻辑，并在最后触发重置事件
const loadImageWithOcr = async (
  image?: File | string,
  ocrResult?: OcrTextResult | null
) => {
  // 先清空画布
  clearCanvas();

  // 没有图片时直接返回
  if (!image) {
    return;
  }

  // 如果在对比模式，加载对比图片
  if (isComparing.value) {
    const original = props.originalImage || props.image;
    const processed = props.image;
    if (original && processed) {
      await loadCompareImages(original, processed);
      // 等待图片加载完成后再绘制OCR框
      await nextTick();
      if (ocrResult && imageRect.value && imageRect.value.w > 0) {
        loadOcrBoxes(ocrResult);
      }
    }
  } else {
    // 先加载图片（内部会清空画布并绘制图片）
    await loadImage(image);
    // 再绘制当前图片对应的 OCR 结果框，确保在图片之上
    await nextTick();
    if (ocrResult) {
      loadOcrBoxes(ocrResult);
    }
  }

  // 通过全局画布事件总线触发缩放重置（居中显示）
  await nextTick();
  canvasEventBus.emit("canvas:zoom-reset");
};

watch([() => container.value], () => {
  if (container.value) {
    resizeCanvas();
  }
});

// 同时监听图片和 OCR 结果的变化，确保同步更新
watch(
  [() => props.image, () => props.originalImage, () => props.ocrResult],
  async ([image, _, ocrResult]) => {
    await loadImageWithOcr(image, ocrResult ?? null);
  }
);

// 监听对比模式变化
watch(
  () => isComparing.value,
  async (enabled) => {
    if (enabled) {
      const original = props.originalImage || props.image;
      const processed = props.image;
      if (original && processed) {
        await loadCompareImages(original, processed);
        await nextTick();
        if (props.ocrResult) {
          loadOcrBoxes(props.ocrResult);
        }
      }
    } else {
      // 退出对比模式，恢复正常显示
      if (props.image) {
        await loadImage(props.image);
        await nextTick();
        if (props.ocrResult) {
          loadOcrBoxes(props.ocrResult);
        }
      }
    }
    emits("compare", enabled);
  }
);

const handleWaitingRectComplete = (rect: any) => {
  emits("waiting-rect-complete", {
    canvasX: rect.canvasX,
    canvasY: rect.canvasY,
    canvasWidth: rect.canvasWidth,
    canvasHeight: rect.canvasHeight,
    waitingRect: rect,
  });
};

const handleCanvasContextMenu = (payload: {
  clientX: number;
  clientY: number;
  target: any;
}) => {
  // 关闭已有菜单
  showContextMenu.value = false;

  const target = payload.target;
  if (!target || target.type !== "ocr") {
    return;
  }

  const label = Number(target.label ?? target.text);
  if (!Number.isInteger(label) || label <= 0) {
    return;
  }

  selectedDetailIndex.value = label - 1;

  // Naive UI 的 x / y 使用视口坐标
  contextMenuX.value = payload.clientX;
  contextMenuY.value = payload.clientY;
  showContextMenu.value = true;
};

const handleContextMenuSelect = (key: string | number) => {
  if (selectedDetailIndex.value == null) return;
  const index = selectedDetailIndex.value;

  if (key === "delete") {
    emits("delete-detail", index);
  } else if (key === "reOcr") {
    emits("re-ocr-detail", index);
  }

  showContextMenu.value = false;
};

watch(
  () => props.waitingMode,
  (enabled) => {
    setWaitingMode(enabled);
  },
  { immediate: true }
);

onMounted(() => {
  initCanvas();
  setupDrawing(handleWaitingRectComplete);
  if (props.image) {
    // 初始化时同样保证先绘制图片再绘制 OCR 框，并在最后重置视图
    loadImageWithOcr(props.image, props.ocrResult ?? null);
  }
  setWaitingMode(props.waitingMode);
  canvasEventBus.on("canvas:context-menu", handleCanvasContextMenu);
  canvasEventBus.on("canvas:zoom", handleViewportChange);
  canvasEventBus.on("canvas:pan", handleViewportChange);
  document.addEventListener("mousemove", handleGlobalMouseMove);
  document.addEventListener("mouseup", handleGlobalMouseUp);
});

onUnmounted(() => {
  canvasEventBus.off("canvas:context-menu", handleCanvasContextMenu);
  canvasEventBus.off("canvas:zoom", handleViewportChange);
  canvasEventBus.off("canvas:pan", handleViewportChange);
  document.removeEventListener("mousemove", handleGlobalMouseMove);
  document.removeEventListener("mouseup", handleGlobalMouseUp);
  // 清理 blob URL
  cleanupBlobUrls();
});

defineExpose({
  clearCanvas,
  clearOcrResults,
  loadOcrBoxes,
  zoomLevel,
  removeWaitingRect,
  clearAllWaitingRects,
  canvasToImageCoords,
  imageRect,
  toggleCompare,
  isComparing: computed(() => isComparing.value),
});
</script>

<style scoped></style>
