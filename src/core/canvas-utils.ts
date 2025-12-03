import * as fabric from "fabric";
import type { Canvas as ICanvas, Image as IImage } from "fabric";
import type { OcrTextResult } from "../types";
import { isString } from "lodash-es";
import { Badge, Ocr } from "./fabric-shapes";

export interface ImageRect {
  x: number;
  y: number;
  w: number;
  h: number;
  ow: number;
  oh: number;
}

export function addImage(
  canvas: ICanvas,
  imageData: File | string
): Promise<ImageRect> {
  return new Promise((resolve) => {
    const url: string = isString(imageData)
      ? (imageData as string)
      : URL.createObjectURL(imageData as Blob);

    fabric.Image.fromURL(url).then((img: IImage) => {
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight() - 55; // 减去底部工具栏高度，与 zoomReset 保持一致

      const imgWidth = (img.width as number) * (img.scaleX as number);
      const imgHeight = (img.height as number) * (img.scaleY as number);

      const scaleX = canvasWidth / imgWidth;
      const scaleY = canvasHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY, 1);

      img.set({ scaleX: scale, scaleY: scale });

      const imageWidth = imgWidth * scale;
      const imageHeight = imgHeight * scale;

      const left = (canvasWidth - imageWidth) / 2;
      const top = (canvasHeight - imageHeight) / 2;

      img.set({ left, top, selectable: false });
      img.set({ lock: true } as any);

      canvas.add(img);
      canvas.renderAll();

      resolve({
        x: left,
        y: top,
        w: imageWidth,
        h: imageHeight,
        ow: imgWidth,
        oh: imgHeight,
      });
    });
  });
}

export function addOcrRect(
  canvas: ICanvas,
  ocrResult: OcrTextResult,
  imageSize: { w: number; h: number; ow: number; oh: number },
  canvasOffset: { x: number; y: number } = { x: 0, y: 0 }
) {
  if (!ocrResult || !ocrResult.details || !Array.isArray(ocrResult.details)) {
    console.warn("OCR结果格式不正确，缺少details数组", ocrResult);
    return;
  }

  if (ocrResult.details.length === 0) {
    return;
  }

  const scale = imageSize.h / imageSize.oh;

  ocrResult.details.forEach((detail, index) => {
    if (
      !detail ||
      typeof detail.minX !== "number" ||
      typeof detail.maxX !== "number" ||
      typeof detail.minY !== "number" ||
      typeof detail.maxY !== "number"
    ) {
      console.warn(`OCR详情项 ${index} 格式不正确，跳过`, detail);
      return;
    }

    const { minX, maxX, minY, maxY } = detail;
    let [x, y, w, h] = [minX, minY, maxX - minX, maxY - minY].map(
      (m) => m * scale
    );
    x += canvasOffset.x;
    y += canvasOffset.y;

    const accentColor = "#6366F1";
    const rect = new Ocr({
      left: x,
      top: y,
      width: w,
      height: h,
      selectable: false,
      accentColor,
    });

    const badge = new Badge({
      left: x,
      top: y,
      width: w,
      height: h,
      fill: "rgba(0,0,0,0)",
      stroke: "transparent",
      selectable: false,
    } as any);
    (badge as any).text = index + 1;

    canvas.add(rect);
    canvas.add(badge);
  });

  canvas.renderAll();
}
