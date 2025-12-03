import { defineStore } from "pinia";
import { ref, computed, watch, nextTick } from "vue";
import type { ImageItem, OcrTextDetail, OcrTextResult } from "../types";
import { useArrayHistory } from "../composables/useArrayHistory";
import { useOcr } from "../composables/useOcr";

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

  // OCR 请求工具（集中在 Store 中，便于按 imageId 绑定结果）
  const { handleOcr: requestOcr } = useOcr();

  const findImageById = (id: string): ImageItem | null => {
    return images.value.find((img) => img.id === id) || null;
  };

  const generateImageId = (): string => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    // 兼容环境：退化为时间戳 + 随机数
    return `img_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  };

  // 添加图片
  const addImages = (files: File[]) => {
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      images.value.push({
        id: generateImageId(),
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

  // 按 imageId 设置指定图片的 OCR 结果（避免异步结果错位）
  const setOcrResultById = (imageId: string, result: OcrTextResult | null) => {
    const target = findImageById(imageId);
    if (!target) return;
    target.ocrResult = result;
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

  // 通用 OCR 异步任务：传入 imageId、文件以及结果合并函数
  const runOcrTask = async (
    imageId: string,
    file: File,
    applyResult: (
      prev: OcrTextResult | null,
      next: OcrTextResult
    ) => OcrTextResult
  ) => {
    // 第一次查找：在请求前确认图片存在，并打开 loading 状态
    const imageRef = findImageById(imageId);
    if (!imageRef) return;

    ocrLoading.value = true;
    imageRef.ocrLoading = true;

    try {
      const ocrResult = await requestOcr(file);

      // 第二次查找：请求返回时再次确认图片仍然存在（中途可能被删除）
      const target = findImageById(imageId) || imageRef;
      const merged = applyResult(target.ocrResult, ocrResult);
      target.ocrResult = merged;
    } catch (error) {
      console.error("OCR 请求失败:", error);
    } finally {
      // 第三次查找可以省略，直接用最初的引用关闭 loading；
      // 即使图片已从列表移除，也只是一个悬挂引用，不会影响 UI。
      imageRef.ocrLoading = false;
      ocrLoading.value = false;
    }
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

  const cloneDetails = (list: OcrTextDetail[] = []) =>
    (list || []).map((item) => ({ ...item }));

  const historySyncing = ref(false);
  const historySource = ref<OcrTextDetail[]>([]);

  watch(
    currentDetails,
    (val) => {
      historySyncing.value = true;
      historySource.value = cloneDetails(val);
      nextTick(() => {
        historySyncing.value = false;
      });
    },
    { immediate: true, deep: true }
  );

  const {
    undo: undoDetailsInternal,
    redo: redoDetailsInternal,
    canUndo: canUndoDetails,
    canRedo: canRedoDetails,
  } = useArrayHistory(historySource, {
    maxSize: 100,
    debounce: 200,
    ignoreRef: historySyncing,
  });

  watch(
    historySource,
    (val) => {
      if (historySyncing.value) return;
      replaceCurrentDetails(cloneDetails(val));
    },
    { deep: false }
  );

  const undoDetails = () => {
    undoDetailsInternal();
  };

  const redoDetails = () => {
    redoDetailsInternal();
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
    setOcrResultById,
    updateCurrentDetail,
    replaceCurrentDetails,
    deleteCurrentDetail,
    clearCurrentOcrResult,
    undoDetails,
    redoDetails,
    canUndoDetails,
    canRedoDetails,
    runOcrTask,
  };
});
