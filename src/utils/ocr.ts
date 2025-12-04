import type { OcrTextResult } from "../types";

 const clamp = (value: number, max: number) => {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
};

export const normalizeOcrResult = (
  result: OcrTextResult,
  width: number,
  height: number
): OcrTextResult => {
  if (!result?.details?.length || width <= 0 || height <= 0) {
    return result;
  }

  const normalizedDetails = result.details.map((detail) => ({
    ...detail,
    minX: clamp(detail.minX, width),
    maxX: clamp(detail.maxX, width),
    minY: clamp(detail.minY, height),
    maxY: clamp(detail.maxY, height),
  }));

  return {
    ...result,
    details: normalizedDetails,
  };
};
