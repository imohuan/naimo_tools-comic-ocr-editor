import { ref, type Ref } from "vue";
import { useElementSize } from "@vueuse/core";
import * as fabric from "fabric";
import type { ImageRect } from "../core/canvas-utils";
import { addImage, addOcrRect } from "../core/canvas-utils";
import type { OcrTextResult } from "../types";
import { Badge } from "../core/fabric-shapes";

export function useCanvas(
  canvasDom: Ref<HTMLCanvasElement | undefined>,
  container: Ref<HTMLElement | undefined>
) {
  const { width, height } = useElementSize(container);
  const fabricCanvas = ref<any>(null);
  const imageRect = ref<ImageRect>({ x: 0, y: 0, w: 0, h: 0, ow: 0, oh: 0 });

  const initCanvas = () => {
    if (!canvasDom.value) return;

    const canvas = new fabric.Canvas(canvasDom.value, {
      selection: false,
      preserveObjectStacking: true,
    });

    if (width.value && height.value) {
      canvas.setWidth(width.value);
      canvas.setHeight(height.value);
    }

    fabricCanvas.value = canvas;
  };

  const resizeCanvas = () => {
    if (fabricCanvas.value && width.value && height.value) {
      fabricCanvas.value.setWidth(width.value);
      fabricCanvas.value.setHeight(height.value);
    }
  };

  const loadImage = async (image: File | string) => {
    if (!fabricCanvas.value || !image) return;
    fabricCanvas.value.clear();
    imageRect.value = await addImage(fabricCanvas.value, image);
  };

  const loadOcrBoxes = (ocrResult: OcrTextResult | null) => {
    if (!fabricCanvas.value || !ocrResult) return;

    try {
      // 清除现有的OCR框（使用相同的清除逻辑）
      const objectsToRemove: fabric.Object[] = [];
      fabricCanvas.value.forEachObject((obj: fabric.Object) => {
        // 多种方式识别 Badge 对象
        // Badge 对象有 text 属性，图片对象没有
        const hasTextProperty = (obj as any).text !== undefined;
        const isBadgeType = obj.type === "Badge" || obj instanceof Badge;

        if (isBadgeType || (hasTextProperty && obj.type !== "image")) {
          objectsToRemove.push(obj);
        }
      });

      if (objectsToRemove.length > 0) {
        objectsToRemove.forEach((obj) => {
          fabricCanvas.value!.remove(obj);
        });
      }

      // 只有在有图片尺寸信息时才添加OCR框
      if (imageRect.value.w > 0 && imageRect.value.h > 0) {
        const { w, h, ow, oh, x, y } = imageRect.value;
        addOcrRect(fabricCanvas.value, ocrResult, { w, h, ow, oh }, { x, y });
      }
    } catch (error) {
      console.error("加载OCR框时出错:", error);
    }
  };

  const clearCanvas = () => {
    if (fabricCanvas.value) {
      fabricCanvas.value.clear();
      imageRect.value = { x: 0, y: 0, w: 0, h: 0, ow: 0, oh: 0 };
    }
  };

  const clearOcrResults = () => {
    if (!fabricCanvas.value) return;

    // 只清除OCR框（Badge类型的对象），保留图片
    const objectsToRemove: fabric.Object[] = [];
    fabricCanvas.value.forEachObject((obj: fabric.Object) => {
      // 多种方式识别 Badge 对象
      // Badge 对象有 text 属性，图片对象没有
      const hasTextProperty = (obj as any).text !== undefined;
      const isBadgeType = obj.type === "Badge" || obj instanceof Badge;

      if (isBadgeType || (hasTextProperty && obj.type !== "image")) {
        objectsToRemove.push(obj);
      }
    });

    if (objectsToRemove.length > 0) {
      objectsToRemove.forEach((obj) => {
        fabricCanvas.value!.remove(obj);
      });
      fabricCanvas.value.renderAll();
    }
  };

  return {
    fabricCanvas,
    imageRect,
    initCanvas,
    resizeCanvas,
    loadImage,
    loadOcrBoxes,
    clearCanvas,
    clearOcrResults,
  };
}
