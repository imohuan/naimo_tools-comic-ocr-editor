<template>
  <div ref="container" class="w-full h-full relative">
    <canvas ref="canvasDom"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import type { OcrTextResult } from "../types";
import { useCanvas } from "../composables/useCanvas";
import { useCanvasPan } from "../composables/useCanvasPan";
import { useCanvasZoom } from "../composables/useCanvasZoom";
import { useCanvasDrawing } from "../composables/useCanvasDrawing";

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
  "waiting-rect-complete": [rect: {
    canvasX: number;
    canvasY: number;
    canvasWidth: number;
    canvasHeight: number;
  }];
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

useCanvasPan(fabricCanvas);
const { zoomLevel } = useCanvasZoom(fabricCanvas);
const {
  setupDrawing,
  setWaitingMode,
  removeWaitingRect,
  clearAllWaitingRects,
  canvasToImageCoords,
} = useCanvasDrawing(fabricCanvas, imageRect);

watch([() => container.value], () => {
  if (container.value) {
    resizeCanvas();
  }
});

watch(
  () => props.image,
  (image) => {
    if (image) {
      loadImage(image);
    }
  }
);

watch(
  () => props.ocrResult,
  (ocrResult) => {
    if (ocrResult) {
      // 使用 nextTick 确保在 DOM 更新后执行
      setTimeout(() => {
        try {
          loadOcrBoxes(ocrResult);
        } catch (error) {
          console.error("加载OCR结果时出错:", error);
        }
      }, 0);
    } else {
      // 当 ocrResult 为 null 时，清除所有 OCR 框
      clearOcrResults();
    }
  },
  { deep: true }
);

const handleWaitingRectComplete = (rect: any) => {
  emits("waiting-rect-complete", {
    canvasX: rect.canvasX,
    canvasY: rect.canvasY,
    canvasWidth: rect.canvasWidth,
    canvasHeight: rect.canvasHeight,
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
    loadImage(props.image);
  }
  if (props.ocrResult) {
    loadOcrBoxes(props.ocrResult);
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
