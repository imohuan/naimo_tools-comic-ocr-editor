import { ref, watch, onUnmounted, type Ref } from "vue";
import { clamp } from "lodash-es";
import * as fabric from "fabric";
import { canvasEventBus } from "../core/event-bus";

export function useCanvasZoom(fabricCanvas: Ref<any>) {
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
      // 重置 viewportTransform 到初始状态（单位矩阵，无平移无缩放）
      fabricCanvas.value.setViewportTransform([1, 0, 0, 1, 0, 0]);

      // 将缩放级别设置为 1
      zoomLevel.value = 1;

      // 查找画布中的图片对象，重新计算位置使其居中
      const objects = fabricCanvas.value.getObjects();
      const imageObject = objects.find((obj: any) => obj.type === "image");

      if (imageObject) {
        const canvasWidth = fabricCanvas.value.getWidth();
        const canvasHeight = fabricCanvas.value.getHeight() - 55;

        // 获取图片的原始尺寸
        const imgWidth = imageObject.width as number;
        const imgHeight = imageObject.height as number;

        // 计算使图片居中最大显示的缩放比例
        // 直接使用画布尺寸，因为画布尺寸已经考虑了容器布局
        const scaleX = canvasWidth / imgWidth;
        const scaleY = canvasHeight / imgHeight;
        const scale = Math.min(scaleX, scaleY, 1);

        // 更新图片的缩放
        imageObject.set({ scaleX: scale, scaleY: scale });

        // 计算居中位置
        const imageWidth = imgWidth * scale;
        const imageHeight = imgHeight * scale;
        const left = (canvasWidth - imageWidth) / 2;
        const top = (canvasHeight - imageHeight) / 2;

        // 更新图片位置
        imageObject.set({ left, top });

        // 确保图片不可选择和锁定
        imageObject.set({ selectable: false });
        imageObject.set({ lock: true } as any);
      }

      // 触发渲染
      fabricCanvas.value.requestRenderAll();

      // 发送缩放事件
      canvasEventBus.emit("canvas:zoom", { level: 1 });
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
