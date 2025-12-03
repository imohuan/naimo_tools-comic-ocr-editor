import { ref, watch, onUnmounted, type Ref } from "vue";
import { clamp } from "lodash-es";
import * as fabric from "fabric";
import { canvasEventBus } from "../core/event-bus";
import type { ImageRect } from "../core/canvas-utils";

export function useCanvasZoom(
  fabricCanvas: Ref<any>,
  imageRect?: Ref<ImageRect>
) {
  const zoomLevel = ref(1);
  const minZoom = 0.1;
  const maxZoom = 20;

  const setZoom = (
    zoom: number,
    point?: { x: number; y: number },
    skipEmit = false
  ) => {
    if (!fabricCanvas.value) return;

    try {
      const clampedZoom = clamp(zoom, minZoom, maxZoom);
      const currentZoom = fabricCanvas.value.getZoom();

      // 如果新的 zoom 值与当前值相同，则不需要更新
      if (Math.abs(clampedZoom - currentZoom) < 0.001) {
        return;
      }

      zoomLevel.value = clampedZoom;

      if (point) {
        const fabricPoint = new fabric.Point(point.x, point.y);
        fabricCanvas.value.zoomToPoint(fabricPoint, clampedZoom);
      } else {
        const center = fabricCanvas.value.getCenter();
        if (center) {
          const centerPoint = new fabric.Point(center.left, center.top);
          fabricCanvas.value.zoomToPoint(centerPoint, clampedZoom);
        }
      }

      if (!skipEmit) {
        canvasEventBus.emit("canvas:zoom", { level: clampedZoom });
      }
    } catch (error) {
      console.error("设置缩放时出错:", error);
    }
  };

  const zoomIn = (step: number = 0.1) => {
    setZoom(zoomLevel.value + step);
  };

  const zoomOut = (step: number = 0.1) => {
    setZoom(zoomLevel.value - step);
  };

  const zoomReset = () => {
    if (!fabricCanvas.value) return;

    try {
      const canvas = fabricCanvas.value;
      const rect = imageRect?.value;

      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      // 与图片加载时的布局约定保持一致：底部有工具栏，上下有 padding
      const toolbarHeight = 55 + 15; // 底部工具栏高度
      const paddingX = 40; // 左右内边距
      const paddingTop = 20; // 顶部内边距
      const paddingBottom = 20; // 底部（工具栏上方）内边距

      // 可用于显示图片的有效高度：减去工具栏和上下 padding
      const availableWidth = Math.max(canvasWidth - paddingX * 2, 0);
      const availableHeight = Math.max(
        canvasHeight - toolbarHeight - paddingTop - paddingBottom,
        0
      );

      // 如果没有图片信息，则退化为简单重置视口
      if (!rect || !rect.w || !rect.h || !availableWidth || !availableHeight) {
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        zoomLevel.value = 1;
      } else {
        const { x, y, w, h } = rect;

        // 计算在「黄色框有效区域」内，使图片完整显示并尽量铺满的缩放比例
        const scaleX = availableWidth / w;
        const scaleY = availableHeight / h;
        const fitScale = clamp(Math.min(scaleX, scaleY), minZoom, maxZoom);

        // 计算缩放后，为了在有效区域内居中显示所需要的平移偏移量
        const displayWidth = w * fitScale;
        const displayHeight = h * fitScale;
        const targetLeft = paddingX + (availableWidth - displayWidth) / 2;
        const targetTop = paddingTop + (availableHeight - displayHeight) / 2;

        const offsetX = targetLeft - x * fitScale;
        const offsetY = targetTop - y * fitScale;

        const viewportTransform: fabric.TMat2D = [
          fitScale,
          0,
          0,
          fitScale,
          offsetX,
          offsetY,
        ];

        canvas.setViewportTransform(viewportTransform);
        zoomLevel.value = fitScale;
      }

      // 触发渲染
      canvas.requestRenderAll();

      // 发送缩放事件
      canvasEventBus.emit("canvas:zoom", { level: zoomLevel.value });
    } catch (error) {
      console.error("重置画布时出错:", error);
    }
  };

  const setupWheelZoom = () => {
    if (!fabricCanvas.value) return;

    fabricCanvas.value.on("mouse:wheel", (opt: any) => {
      const e = opt.e as WheelEvent;
      if (!e) return;
      const delta = e.deltaY;
      let zoom = fabricCanvas.value!.getZoom();
      zoom *= 0.999 ** delta;
      setZoom(zoom, { x: e.offsetX, y: e.offsetY });
      e.preventDefault();
      e.stopPropagation();
    });
  };

  const setupEventListeners = () => {
    const zoomInHandler = () => zoomIn();
    const zoomOutHandler = () => zoomOut();
    const zoomResetHandler = () => zoomReset();
    const zoomHandler = (event: { level: number }) => {
      if (fabricCanvas.value) {
        // 检查新的 zoom 值是否与当前值相同，避免循环调用
        const currentZoom = zoomLevel.value;
        if (Math.abs(event.level - currentZoom) > 0.001) {
          setZoom(event.level, undefined, true);
        }
      }
    };

    canvasEventBus.on("canvas:zoom-in", zoomInHandler);
    canvasEventBus.on("canvas:zoom-out", zoomOutHandler);
    canvasEventBus.on("canvas:zoom-reset", zoomResetHandler);
    canvasEventBus.on("canvas:zoom", zoomHandler);

    return () => {
      canvasEventBus.off("canvas:zoom-in", zoomInHandler);
      canvasEventBus.off("canvas:zoom-out", zoomOutHandler);
      canvasEventBus.off("canvas:zoom-reset", zoomResetHandler);
      canvasEventBus.off("canvas:zoom", zoomHandler);
    };
  };

  let cleanup: (() => void) | null = null;

  watch(
    fabricCanvas,
    (canvas) => {
      if (canvas) {
        setupWheelZoom();
        cleanup = setupEventListeners();
        // 初始化时同步当前的 zoom 值
        const currentZoom = canvas.getZoom();
        if (currentZoom !== zoomLevel.value) {
          zoomLevel.value = currentZoom;
          canvasEventBus.emit("canvas:zoom", { level: currentZoom });
        }
      } else if (cleanup) {
        cleanup();
        cleanup = null;
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    if (cleanup) {
      cleanup();
    }
  });

  return {
    zoomLevel,
    setZoom,
    zoomIn,
    zoomOut,
    zoomReset,
  };
}
