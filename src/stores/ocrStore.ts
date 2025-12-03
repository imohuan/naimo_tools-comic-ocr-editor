import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { ImageItem, OcrTextDetail, OcrTextResult } from "../types";

// 全局 OCR / 图片状态管理
export const useOcrStore = defineStore("ocr-store", () => {
  // 图片及其 OCR 结果列表
  const images = ref<ImageItem[]>([]);

  // 当前选中的图片索引
  const currentIndex = ref(0);

  // 全局 OCR 加载状态
  const ocrLoading = ref<boolean>(false);

  // 当前图片
  const currentImage = computed<ImageItem | null>(() => {
    if (images.value.length === 0) return null;
    return images.value[Math.min(currentIndex.value, images.value.length - 1)];
  });

  // 当前图片的 OCR 明细
  const currentDetails = computed<OcrTextDetail[]>(() => {
    if (!currentImage.value || !currentImage.value.ocrResult) return [];
    return currentImage.value.ocrResult.details;
  });

  // 添加图片
  const addImages = (files: File[]) => {
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      images.value.push({
        file,
        url,
        ocrResult: null,
        ocrLoading: false,
      });
    });
    if (images.value.length > 0) {
      currentIndex.value = images.value.length - 1;
    }
  };

  // 移除图片
  const removeImage = (index: number) => {
    if (index < 0 || index >= images.value.length) return;
    URL.revokeObjectURL(images.value[index].url);
    images.value.splice(index, 1);
    if (currentIndex.value >= images.value.length) {
      currentIndex.value = Math.max(0, images.value.length - 1);
    }
  };

  // 选中图片
  const selectImage = (index: number) => {
    if (index < 0 || index >= images.value.length) return;
    currentIndex.value = index;
  };

  // 设置当前图片 OCR 结果
  const setCurrentOcrResult = (result: OcrTextResult | null) => {
    if (!currentImage.value) return;
    currentImage.value.ocrResult = result;
  };

  // 更新当前图片的某条 OCR 明细
  const updateCurrentDetail = (
    index: number,
    updater: (detail: OcrTextDetail) => void
  ) => {
    if (!currentImage.value?.ocrResult) return;
    const details = currentImage.value.ocrResult.details;
    const detail = details[index];
    if (!detail) return;
    updater(detail);
    // 替换引用，确保外部 watch 能感知变化
    currentImage.value.ocrResult = {
      ...currentImage.value.ocrResult,
      details: [...details],
    };
  };

  // 替换当前图片的详情列表（拖拽排序 / 批量修改）
  const replaceCurrentDetails = (details: OcrTextDetail[]) => {
    if (!currentImage.value?.ocrResult) return;
    currentImage.value.ocrResult = {
      ...currentImage.value.ocrResult,
      details: [...details],
    };
  };

  // 删除当前图片的一条 OCR 明细
  const deleteCurrentDetail = (detailIndex: number) => {
    if (!currentImage.value?.ocrResult) return;
    const next = currentImage.value.ocrResult.details.filter(
      (_d, idx) => idx !== detailIndex
    );
    currentImage.value.ocrResult = {
      ...currentImage.value.ocrResult,
      details: next,
    };
  };

  // 清空当前图片 OCR 结果
  const clearCurrentOcrResult = () => {
    if (!currentImage.value) return;
    currentImage.value.ocrResult = null;
  };

  return {
    images,
    currentIndex,
    ocrLoading,
    currentImage,
    currentDetails,
    addImages,
    removeImage,
    selectImage,
    setCurrentOcrResult,
    updateCurrentDetail,
    replaceCurrentDetails,
    deleteCurrentDetail,
    clearCurrentOcrResult,
  };
});
