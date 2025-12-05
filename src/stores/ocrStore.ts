import { defineStore } from "pinia";
import { ref, computed, watch, nextTick, toRef, toRaw } from "vue";
import type { ImageItem, OcrTextDetail, OcrTextResult } from "../types";
import { useArrayHistory } from "../composables/useArrayHistory";
import { useOcr } from "../composables/useOcr";
import { getImageDimensions, getImageDimensionsFromUrl, compositeImages } from "../utils/image";
import { normalizeOcrResult } from "../utils/ocr";
import { useStoreToJSON } from "../composables/useStoreToJSON";
import { useNaimoStore, type ProjectConfig } from "./naimoStore";
import { omit } from "lodash-es";

// 全局 OCR / 图片状态管理
export const useOcrStore = defineStore("ocr-store", () => {
  // 图片及其 OCR 结果列表
  const images = ref<ImageItem[]>([]);

  const naimoStore = useNaimoStore();

  // 将 ImageItem[] 序列化为 ProjectConfig 格式
  const serializeImages = (imageList: ImageItem[]): ProjectConfig => {
    const config: ProjectConfig = {
      images: {},
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const getOcrResult = (detail: OcrTextDetail) => {
      return omit(detail, ['audioUrl'])
    }

    for (const image of toRaw(imageList)) {
      if (!image.path) continue;
      // 保存 ocrResult，即使为 null 也要保存（表示已处理但无结果）
      config.images[image.path] = {
        ocrResult: image.ocrResult?.details.map(detail => getOcrResult(detail)) ?? [],
      };
    }

    return config;
  };

  // 将 ProjectConfig 反序列化为 ImageItem[]
  const deserializeImages = async (config: ProjectConfig | null, folderImages: ImageItem[]): Promise<ImageItem[]> => {
    if (!config || !config.images) return folderImages;
    // 从 folderImages 恢复 ImageItem，并合并 OCR 

    const getAudioUrl = async (path: string) => {
      return await naimoStore.getAudioUrl(path);
    }

    const result = await Promise.all(folderImages.map(async (img) => {
      if (!img.path) return img;
      const configItem = config.images[img.path];
      if (configItem) {
        return {
          ...img,
          // 从配置中恢复 ocrResult（可能是 null，表示已处理但无结果）
          ocrResult: configItem.ocrResult.length > 0 ? {
            details: await Promise.all(configItem.ocrResult.map(async (detail) => {
              if (!detail.audioPath) return detail;
              const audioUrl = await getAudioUrl(detail.audioPath);
              return { ...detail, audioUrl }
            })),
            img: null,
            detection_size: 0,
          } : null,
        };
      }
      return img;
    }));

    return result;
  };

  // 使用 useStoreToJSON 自动保存 images
  const jsonStorage = useStoreToJSON<ImageItem[]>(
    toRef(naimoStore, 'currentFolder'),
    images,
    {
      debounce: 500,
      immediate: true, // 自动读取数据
      serializer: serializeImages,
      deserializer: async (config: any) => {
        const imageItems: ImageItem[] = naimoStore.folderImages.map(img => {
          return {
            id: generateImageId(),
            url: img.url,
            path: img.path,
            name: img.name,
            ocrResult: null,
            ocrLoading: false,
          }
        });
        return await deserializeImages(config, imageItems);
      },
    }
  );

  // 当前选中的图片索引
  const currentIndex = ref(0);

  // 全局 OCR 加载状态
  const ocrLoading = ref<boolean>(false);

  // 当前图片
  const currentImage = computed<ImageItem | null>(() => {
    if (images.value.length === 0) return null;
    const index = Math.min(currentIndex.value, images.value.length - 1)
    return images.value[index];
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

  // 生成 OCR 明细的唯一 ID（与图片 ID 分开，方便任务管理）
  const generateDetailId = (): string => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `detail_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  };

  // 为 OCR 结果中的所有明细补充 id（已有 id 则保持不变）
  const ensureDetailIds = (result: OcrTextResult | null): OcrTextResult | null => {
    if (!result || !Array.isArray(result.details)) return result;
    const detailsWithId = result.details.map((detail) => {
      if (detail.id) return detail;
      return {
        ...detail,
        id: generateDetailId(),
      } as OcrTextDetail;
    });
    return {
      ...result,
      details: detailsWithId,
    };
  };

  // 添加图片（文件上传模式）
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
        processedImageUrl: null,
      });
    });
    if (images.value.length > 0) {
      currentIndex.value = images.value.length - 1;
    }
  };

  // 从文件夹添加图片（项目模式）
  const addImagesFromFolder = (imageItems: ImageItem[]) => {
    images.value.push(...imageItems);
    if (images.value.length > 0) {
      currentIndex.value = images.value.length - 1;
    }
  };

  // 清空所有图片
  const clearAllImages = () => {
    // 清理 blob URLs
    images.value.forEach((image) => {
      if (image.url && image.url.startsWith('blob:')) {
        URL.revokeObjectURL(image.url);
      }
    });
    images.value = [];
    currentIndex.value = 0;
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
    currentImage.value.ocrResult = ensureDetailIds(result);
    // 自动保存 Hook 会监听变化并保存
  };

  // 按 imageId 设置指定图片的 OCR 结果（避免异步结果错位）
  const setOcrResultById = async (imageId: string, result: OcrTextResult | null) => {
    const target = findImageById(imageId);
    if (!target) return;

    target.ocrResult = ensureDetailIds(result);
    // 自动保存 Hook 会监听变化并保存
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
    // 自动保存 Hook 会监听变化并保存
  };

  // 替换当前图片的详情列表（拖拽排序 / 批量修改）
  const replaceCurrentDetails = (details: OcrTextDetail[]) => {
    if (!currentImage.value?.ocrResult) return;
    currentImage.value.ocrResult = {
      ...currentImage.value.ocrResult,
      details: ensureDetailIds({
        ...currentImage.value.ocrResult,
        details: [...details],
      })!.details,
    };
    // 自动保存 Hook 会监听变化并保存
  };

  // 将 URL（data URL 或普通 URL）转换为 File 对象
  const urlToFile = async (url: string, filename: string = "image.png"): Promise<File> => {
    // 如果是 data URL，直接转换
    if (url.startsWith("data:")) {
      const response = await fetch(url);
      const blob = await response.blob();
      return new File([blob], filename, { type: blob.type });
    }
    // 如果是普通 URL，先 fetch 再转换
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  };

  // 通用 OCR 异步任务：传入 imageId、文件以及结果合并函数
  const runOcrTask = async (
    imageId: string,
    file: File | undefined,
    applyResult: (
      prev: OcrTextResult | null,
      next: OcrTextResult
    ) => OcrTextResult,
    options?: {
      updateProcessedImage?: boolean;
      patchArea?: { x: number; y: number; width: number; height: number };
    }
  ) => {
    // 第一次查找：在请求前确认图片存在，并打开 loading 状态
    const imageRef = findImageById(imageId);
    if (!imageRef) return;

    ocrLoading.value = true;
    imageRef.ocrLoading = true;

    try {
      // 处理好的图片 URL 回调
      const onProcessedImage = async (imageUrl: string) => {
        // 再次查找图片，确保仍然存在
        const target = findImageById(imageId);
        if (!target) return;

        // 只有在未显式禁用更新时才替换图片
        if (options?.updateProcessedImage !== false) {
          if (options?.patchArea) {
            // 如果提供了 patchArea，则进行局部替换
            const baseImage = target.processedImageUrl || target.url;
            try {
              const newImageUrl = await compositeImages(
                baseImage,
                imageUrl,
                options.patchArea.x,
                options.patchArea.y,
                options.patchArea.width,
                options.patchArea.height
              );
              target.processedImageUrl = newImageUrl;
            } catch (error) {
              console.error("图片合成失败:", error);
            }
          } else {
            // 否则直接替换整张图片
            target.processedImageUrl = imageUrl;
          }
        }
      };

      // 如果 file 不存在（项目模式），从 URL 转换为 File
      let ocrFile: File;
      if (!file) {
        if (!imageRef.url) {
          throw new Error("图片 URL 不存在");
        }
        const filename = imageRef.name || `image_${imageId}.png`;
        ocrFile = await urlToFile(imageRef.url, filename);
      } else {
        ocrFile = file;
      }

      // 获取图片尺寸：如果有 file 就用 file，否则用 URL
      const dimensionsPromise = file
        ? getImageDimensions(file).catch((error) => {
          console.error("读取图片尺寸失败:", error);
          return null;
        })
        : getImageDimensionsFromUrl(imageRef.url).catch((error) => {
          console.error("读取图片尺寸失败:", error);
          return null;
        });

      const [ocrResult, dimensions] = await Promise.all([
        requestOcr(ocrFile, onProcessedImage),
        dimensionsPromise,
      ]);

      const normalizedResult =
        dimensions && dimensions.width > 0 && dimensions.height > 0
          ? normalizeOcrResult(ocrResult, dimensions.width, dimensions.height)
          : ocrResult;

      // 第二次查找：请求返回时再次确认图片仍然存在（中途可能被删除）
      const target = findImageById(imageId) || imageRef;
      const merged = applyResult(target.ocrResult, normalizedResult);
      target.ocrResult = ensureDetailIds(merged);
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

  // 加载项目数据
  // 先加载文件夹图片，然后调用 init() 自动读取数据并开始监听
  const loadProjectData = async () => {
    if (!naimoStore.isProjectMode) return;
    // 先加载文件夹图片（deserializer 需要依赖 folderImages）
    await naimoStore.loadFolderImages();
    // init() 内部会自动读取数据（deserializer 会自动处理所有转换和合并，包括文件不存在时创建基础数据）
    await jsonStorage.init(true);
  };

  // 监听项目文件夹变化
  watch(
    () => naimoStore.currentFolder,
    (newFolder, oldFolder) => {
      if (oldFolder) {
        // 停止旧的监听
        jsonStorage.stopWatching();
      }
      if (newFolder) {
        // 加载新项目数据
        loadProjectData();
      } else {
        // 清空数据
        images.value = [];
      }
    }
  );

  return {
    images,
    currentIndex,
    ocrLoading,
    currentImage,
    currentDetails,
    addImages,
    addImagesFromFolder,
    clearAllImages,
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
    generateImageId,
    // 自动保存相关
    jsonStorage,
    loadProjectData,
  };
});
