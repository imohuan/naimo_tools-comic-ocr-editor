import type { OcrTextResult } from "../types";

export const normalizeOcrResult = (
  result: OcrTextResult,
  width: number,
  height: number
): OcrTextResult => {
  if (!result?.details?.length || width <= 0 || height <= 0) {
    return result;
  }

  const longerSide = Math.max(width, height);
  const detectionSize = result.detection_size || longerSide;
  const processedScale =
    longerSide > detectionSize ? detectionSize / longerSide : 1;

  const processedWidth = width * processedScale;
  const processedHeight = height * processedScale;

  const scaleX = processedWidth > 0 ? width / processedWidth : 1;
  const scaleY = processedHeight > 0 ? height / processedHeight : 1;

  const normalizedDetails = result.details.map((detail) => ({
    ...detail,
    minX: detail.minX * scaleX,
    maxX: detail.maxX * scaleX,
    minY: detail.minY * scaleY,
    maxY: detail.maxY * scaleY,
  }));

  return {
    ...result,
    details: normalizedDetails,
  };
};
