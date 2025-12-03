import { type Ref, ref } from "vue";
import { useKeyModifier } from "@vueuse/core";
import { WaitingRect } from "../core/fabric-shapes";

const WAITING_RECT_STYLE = {
  fill: "rgba(99, 102, 241, 0.08)",
  stroke: "#6366F1",
  strokeDashArray: [14, 10] as number[],
  strokeWidth: 2,
  rx: 8,
  ry: 8,
  label: "等待识别",
  accentColor: "#6366F1",
};

export interface WaitingRectInfo {
  rect: WaitingRect;
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
}

export function useCanvasDrawing(
  fabricCanvas: Ref<any>,
  imageRect: Ref<{
    x: number;
    y: number;
    w: number;
    h: number;
    ow: number;
    oh: number;
  }>
) {
  const shiftKey = useKeyModifier("Shift");
  const isWaitingMode = ref(false);
  let isDrawingWaiting = false;
  let startPoint = { x: 0, y: 0 };
  let currentWaitingRect: WaitingRect | null = null;
  let waitingRects: WaitingRectInfo[] = [];

  const handleMouseDown = (opt: any) => {
    if (!fabricCanvas.value) return;

    const e = opt.e as MouseEvent;
    if (!e) return;

    const altKey = e.altKey;

    // 等待识别框模式（按钮开启）
    if (isWaitingMode.value && !altKey) {
      isDrawingWaiting = true;
      const pointer = fabricCanvas.value.getPointer(e);
      startPoint = { x: pointer.x, y: pointer.y };
      currentWaitingRect = new WaitingRect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        selectable: false,
        ...WAITING_RECT_STYLE,
      });
      fabricCanvas.value.add(currentWaitingRect);
      e.preventDefault();
      return;
    }

    // Shift + 拖拽：同样绘制 WaitingRect 作为框选效果
    if (shiftKey.value && !altKey) {
      isDrawingWaiting = true;
      const pointer = fabricCanvas.value.getPointer(e);
      startPoint = { x: pointer.x, y: pointer.y };
      currentWaitingRect = new WaitingRect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        selectable: false,
        ...WAITING_RECT_STYLE,
      });
      fabricCanvas.value.add(currentWaitingRect);
      e.preventDefault();
    }
  };

  const handleMouseMove = (opt: any) => {
    if (!fabricCanvas.value) return;

    const e = opt.e as MouseEvent;
    if (!e) return;

    const pointer = fabricCanvas.value.getPointer(e);
    const width = Math.abs(pointer.x - startPoint.x);
    const height = Math.abs(pointer.y - startPoint.y);
    const left = Math.min(startPoint.x, pointer.x);
    const top = Math.min(startPoint.y, pointer.y);

    // 等待识别框模式 / Shift 框选
    if (isDrawingWaiting && currentWaitingRect) {
      currentWaitingRect.set({
        width,
        height,
        left,
        top,
      });
      fabricCanvas.value.renderAll();
      return;
    }
  };

  const handleMouseUp = (callback?: (rect: WaitingRectInfo) => void) => {
    if (!fabricCanvas.value) return;

    // 等待识别框模式 / Shift 框选
    if (isDrawingWaiting && currentWaitingRect) {
      const { width, height, left, top } = currentWaitingRect;
      if (width > 10 && height > 10) {
        const waitingRect: WaitingRectInfo = {
          rect: currentWaitingRect,
          canvasX: left,
          canvasY: top,
          canvasWidth: width,
          canvasHeight: height,
        };
        waitingRects.push(waitingRect);
        if (callback) {
          callback(waitingRect);
        }
      } else {
        currentWaitingRect.stopAnimation();
        fabricCanvas.value.remove(currentWaitingRect);
      }
      currentWaitingRect = null;
      isDrawingWaiting = false;
      return;
    }
  };

  const setupDrawing = (
    onWaitingRectComplete?: (rect: WaitingRectInfo) => void
  ) => {
    if (!fabricCanvas.value) return;

    fabricCanvas.value.on("mouse:down", handleMouseDown);
    fabricCanvas.value.on("mouse:move", handleMouseMove);
    fabricCanvas.value.on("mouse:up", () =>
      handleMouseUp(onWaitingRectComplete)
    );
  };

  const setWaitingMode = (enabled: boolean) => {
    isWaitingMode.value = enabled;
  };

  const removeWaitingRect = (rect: WaitingRectInfo) => {
    if (!fabricCanvas.value) return;
    if (rect.rect instanceof WaitingRect) {
      rect.rect.stopAnimation();
    }
    fabricCanvas.value.remove(rect.rect);
    const index = waitingRects.indexOf(rect);
    if (index > -1) {
      waitingRects.splice(index, 1);
    }
    fabricCanvas.value.renderAll();
  };

  const clearAllWaitingRects = () => {
    if (!fabricCanvas.value) return;
    waitingRects.forEach((rect) => {
      if (rect.rect instanceof WaitingRect) {
        rect.rect.stopAnimation();
      }
      fabricCanvas.value.remove(rect.rect);
    });
    waitingRects = [];
    fabricCanvas.value.renderAll();
  };

  // 将画布坐标转换为图片相对坐标
  const canvasToImageCoords = (
    canvasX: number,
    canvasY: number,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    const imgRect = imageRect.value;
    if (imgRect.w === 0 || imgRect.h === 0) {
      return null;
    }

    // 计算相对于图片的坐标
    const relativeX = (canvasX - imgRect.x) / imgRect.w;
    const relativeY = (canvasY - imgRect.y) / imgRect.h;
    const relativeWidth = canvasWidth / imgRect.w;
    const relativeHeight = canvasHeight / imgRect.h;

    // 转换为原始图片坐标
    const imageX = relativeX * imgRect.ow;
    const imageY = relativeY * imgRect.oh;
    const imageWidth = relativeWidth * imgRect.ow;
    const imageHeight = relativeHeight * imgRect.oh;

    return {
      x: Math.max(0, imageX),
      y: Math.max(0, imageY),
      width: Math.min(imgRect.ow - imageX, imageWidth),
      height: Math.min(imgRect.oh - imageY, imageHeight),
    };
  };

  return {
    setupDrawing,
    setWaitingMode,
    removeWaitingRect,
    clearAllWaitingRects,
    canvasToImageCoords,
    isWaitingMode,
  };
}
