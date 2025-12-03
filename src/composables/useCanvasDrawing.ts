import { type Ref, ref } from "vue";
import { useKeyModifier } from "@vueuse/core";
import * as fabric from "fabric";
import { Ocr } from "../core/fabric-shapes";

export interface WaitingRect {
  rect: fabric.Rect;
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
}

export function useCanvasDrawing(
  fabricCanvas: Ref<any>,
  imageRect: Ref<{ x: number; y: number; w: number; h: number; ow: number; oh: number }>
) {
  const shiftKey = useKeyModifier("Shift");
  const isWaitingMode = ref(false);
  let isDrawingOcr = false;
  let isDrawingWaiting = false;
  let startPoint = { x: 0, y: 0 };
  let currentOcrRect: fabric.Rect | null = null;
  let currentWaitingRect: Ocr | null = null;
  let waitingRects: WaitingRect[] = [];

  const handleMouseDown = (opt: any) => {
    if (!fabricCanvas.value) return;

    const e = opt.e as MouseEvent;
    if (!e) return;

    const altKey = e.altKey;

    // 等待识别框模式
    if (isWaitingMode.value && !altKey) {
      isDrawingWaiting = true;
      const pointer = fabricCanvas.value.getPointer(e);
      startPoint = { x: pointer.x, y: pointer.y };
      currentWaitingRect = new Ocr({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        fill: "rgba(0, 123, 255, 0.1)",
        stroke: "#007bff",
        strokeWidth: 2,
        selectable: false,
      });
      fabricCanvas.value.add(currentWaitingRect);
      e.preventDefault();
      return;
    }

    // 原有的 Shift+点击绘制模式
    if (shiftKey.value && !altKey) {
      isDrawingOcr = true;
      const pointer = fabricCanvas.value.getPointer(e);
      startPoint = { x: pointer.x, y: pointer.y };
      currentOcrRect = new fabric.Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        fill: "rgba(255, 0, 0, 0.1)",
        stroke: "#ff0000",
        strokeWidth: 2,
        selectable: false,
      });
      fabricCanvas.value.add(currentOcrRect);
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

    // 等待识别框模式
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

    // 原有的 OCR 框绘制模式
    if (isDrawingOcr && currentOcrRect) {
      currentOcrRect.set({
        width,
        height,
        left,
        top,
      });
      fabricCanvas.value.renderAll();
    }
  };

  const handleMouseUp = (callback?: (rect: WaitingRect) => void) => {
    if (!fabricCanvas.value) return;

    // 等待识别框模式
    if (isDrawingWaiting && currentWaitingRect) {
      const { width, height, left, top } = currentWaitingRect;
      if (width > 10 && height > 10) {
        const waitingRect: WaitingRect = {
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

    // 原有的 OCR 框绘制模式
    if (isDrawingOcr && currentOcrRect) {
      const { width, height } = currentOcrRect;
      if (width > 10 && height > 10) {
        console.log("OCR框绘制完成", currentOcrRect);
      } else {
        fabricCanvas.value.remove(currentOcrRect);
      }
      currentOcrRect = null;
      isDrawingOcr = false;
    }
  };

  const setupDrawing = (onWaitingRectComplete?: (rect: WaitingRect) => void) => {
    if (!fabricCanvas.value) return;

    fabricCanvas.value.on("mouse:down", handleMouseDown);
    fabricCanvas.value.on("mouse:move", handleMouseMove);
    fabricCanvas.value.on("mouse:up", () => handleMouseUp(onWaitingRectComplete));
  };

  const setWaitingMode = (enabled: boolean) => {
    isWaitingMode.value = enabled;
  };

  const removeWaitingRect = (rect: WaitingRect) => {
    if (!fabricCanvas.value) return;
    if (rect.rect instanceof Ocr) {
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
      if (rect.rect instanceof Ocr) {
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
