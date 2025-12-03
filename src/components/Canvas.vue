<template>
  <div ref="container" class="w-full h-full relative">
    <canvas ref="canvasDom"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from "vue";
import type { OcrTextResult } from "../types";
import { useCanvas } from "../composables/useCanvas";
import { useCanvasPan } from "../composables/useCanvasPan";
import { useCanvasZoom } from "../composables/useCanvasZoom";
import { useCanvasDrawing } from "../composables/useCanvasDrawing";
import { canvasEventBus } from "../core/event-bus";

interface Props {
  image?: File | string;
  ocrResult?: OcrTextResult | null;
  waitingMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  image: undefined,
  ocrResult: null,
  waitingMode: false,
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
}>();

const container = ref<HTMLDivElement>();
const canvasDom = ref<HTMLCanvasElement>();

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
const { zoomLevel } = useCanvasZoom(fabricCanvas);

// 统一的图片 + OCR 加载逻辑，并在最后触发重置事件
const loadImageWithOcr = async (
  image?: File | string,
  ocrResult?: OcrTextResult | null
) => {
  if (!image) {
    // 没有图片时清空画布
    clearCanvas();
    return;
  }

  // 先加载图片（内部会清空画布并绘制图片）
  await loadImage(image);

  // 再绘制当前图片对应的 OCR 结果框，确保在图片之上
  await nextTick();
  if (ocrResult) {
    loadOcrBoxes(ocrResult);
  }

  // 通过全局画布事件总线触发缩放重置（居中显示）
  canvasEventBus.emit("canvas:zoom-reset");
};

watch([() => container.value], () => {
  if (container.value) {
    resizeCanvas();
  }
});

watch(
  () => props.image,
  async (image) => {
    await loadImageWithOcr(image, props.ocrResult);
  }
);

let ocrResultWatchTimer: number | null = null;
watch(
  () => props.ocrResult,
  (ocrResult, oldOcrResult) => {
    // 避免重复触发：如果引用相同，则不处理
    if (ocrResult === oldOcrResult) return;

    // 清除之前的定时器，防止重复触发
    if (ocrResultWatchTimer !== null) {
      clearTimeout(ocrResultWatchTimer);
      ocrResultWatchTimer = null;
    }

    if (ocrResult) {
      // 使用防抖，确保不会重复调用
      ocrResultWatchTimer = window.setTimeout(() => {
        try {
          loadOcrBoxes(ocrResult);
        } catch (error) {
          console.error("加载OCR结果时出错:", error);
        } finally {
          ocrResultWatchTimer = null;
        }
      }, 0);
    } else {
      // 当 ocrResult 为 null 时，清除所有 OCR 框
      clearOcrResults();
    }
  },
  { flush: "post" }
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
});
</script>

<style scoped></style>
