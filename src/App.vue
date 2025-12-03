<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <div class="flex h-screen overflow-hidden bg-gray-50">
      <!-- 左侧图片列表 -->
      <ImageList
        :images="imageList"
        :current-index="currentIndex"
        @add-images="handleAddImages"
        @select="handleSelectImage"
        @remove="handleRemoveImage"
      />

      <!-- 中间画布区域 -->
      <div class="flex-1 flex flex-col relative bg-gray-50 w-full">
        <!-- 画布 -->
        <div class="flex-1 relative overflow-hidden">
          <Canvas
            ref="canvasRef"
            :image="currentImage?.file"
            :ocr-result="currentImage?.ocrResult"
            :waiting-mode="isWaitingMode"
            @change-detail="handleChangeDetail"
            @waiting-rect-complete="handleWaitingRectComplete"
          />
        </div>

        <!-- 底部控制栏 -->
        <BottomToolbar
          :current-page="imageList.length > 0 ? currentIndex + 1 : 0"
          :total-pages="imageList.length"
          :display-zoom="displayZoom"
          :has-image="!!currentImage"
          :ocr-loading="ocrLoading"
          @zoom-in="handleZoomIn"
          @zoom-out="handleZoomOut"
          @zoom-reset="handleZoomReset"
          @ocr="handleOcr"
          @clear-ocr="handleClearCanvas"
          @settings="showSettings = true"
          @toggle-waiting-mode="handleToggleWaitingMode"
        />
      </div>
    </div>

    <!-- 设置对话框 -->
    <n-modal
      v-model:show="showSettings"
      preset="dialog"
      title="设置"
      style="width: 600px"
    >
      <SettingsPanel @close="showSettings = false" />
    </n-modal>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { NConfigProvider, NModal } from "naive-ui";
import Canvas from "./components/Canvas.vue";
import ImageList from "./components/ImageList.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import BottomToolbar from "./components/BottomToolbar.vue";
import { useOcr } from "./composables/useOcr.js";
import { canvasEventBus } from "./core/event-bus";
import type { ImageItem, OcrTextResult } from "./types/index";

const themeOverrides = {
  common: {
    primaryColor: "#36ad6a",
    primaryColorHover: "#18a058",
  },
};

const canvasRef = ref<InstanceType<typeof Canvas>>();
const showSettings = ref(false);
const imageList = ref<ImageItem[]>([]);
const currentIndex = ref(0);
const ocrLoading = ref(false);
const zoomLevel = ref(1);
const isWaitingMode = ref(false);

const currentImage = computed(() => {
  if (imageList.value.length === 0) return null;
  return imageList.value[currentIndex.value];
});

const displayZoom = computed(() => {
  const zoom = zoomLevel.value;
  if (typeof zoom !== "number" || isNaN(zoom) || !isFinite(zoom)) {
    return "100%";
  }
  return Math.round(zoom * 100) + "%";
});

const { handleOcr: performOcr } = useOcr();

const handleAddImages = (files: File[]) => {
  files.forEach((file) => {
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      imageList.value.push({
        file,
        url,
        ocrResult: null,
        ocrLoading: false,
      });
    }
  });
  if (imageList.value.length > 0) {
    currentIndex.value = imageList.value.length - 1;
  }
};

const handleSelectImage = (index: number) => {
  if (index >= 0 && index < imageList.value.length) {
    currentIndex.value = index;
    canvasEventBus.emit("canvas:zoom-reset");
  }
};

const handleRemoveImage = (index: number) => {
  if (imageList.value.length > 0) {
    URL.revokeObjectURL(imageList.value[index].url);
    imageList.value.splice(index, 1);
    if (currentIndex.value >= imageList.value.length) {
      currentIndex.value = Math.max(0, imageList.value.length - 1);
    }
  }
};

const handleOcr = async () => {
  if (!currentImage.value) return;
  ocrLoading.value = true;
  currentImage.value.ocrLoading = true;
  try {
    const result = await performOcr(currentImage.value.file);
    if (currentImage.value) {
      currentImage.value.ocrResult = result;
    }
  } catch (error) {
    console.error("OCR识别失败:", error);
  } finally {
    ocrLoading.value = false;
    if (currentImage.value) {
      currentImage.value.ocrLoading = false;
    }
  }
};

const handleChangeDetail = (result: OcrTextResult) => {
  if (currentImage.value) {
    currentImage.value.ocrResult = result;
  }
};

const handleClearCanvas = () => {
  // 只清除OCR结果，不清除图片
  if (currentImage.value) {
    // 先清除画布上的OCR框
    canvasRef.value?.clearOcrResults();
    // 然后清空数据，这会触发 watch 再次清除（双重保险）
    currentImage.value.ocrResult = null;
  }
};

const handleZoomIn = () => {
  canvasEventBus.emit("canvas:zoom-in");
};

const handleZoomOut = () => {
  canvasEventBus.emit("canvas:zoom-out");
};

const handleZoomReset = () => {
  canvasEventBus.emit("canvas:zoom-reset");
};

const handleToggleWaitingMode = (enabled: boolean) => {
  isWaitingMode.value = enabled;
};

// 裁剪图片
const cropImage = async (
  imageFile: File,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("无法创建画布上下文"));
        return;
      }
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("裁剪失败"));
            return;
          }
          const croppedFile = new File([blob], imageFile.name, {
            type: imageFile.type,
          });
          resolve(croppedFile);
        },
        imageFile.type,
        1.0
      );
    };
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = URL.createObjectURL(imageFile);
  });
};

// 将 OCR 结果的相对坐标转换为画布坐标
const convertOcrResultToCanvas = (
  ocrResult: OcrTextResult,
  imageCoords: { x: number; y: number; width: number; height: number },
  canvasRect: { canvasX: number; canvasY: number; canvasWidth: number; canvasHeight: number },
  imageRect: { x: number; y: number; w: number; h: number; ow: number; oh: number }
): OcrTextResult => {
  // OCR 结果的坐标是相对于裁剪后的图片的（像素坐标）
  // 裁剪后的图片尺寸就是 imageCoords.width 和 imageCoords.height
  const croppedImageWidth = imageCoords.width;
  const croppedImageHeight = imageCoords.height;

  // 计算裁剪区域在原图中的位置（原图坐标）
  const cropXInOriginal = imageCoords.x;
  const cropYInOriginal = imageCoords.y;

  // 计算画布上裁剪框的尺寸和位置
  const canvasCropWidth = canvasRect.canvasWidth;
  const canvasCropHeight = canvasRect.canvasHeight;
  const canvasCropX = canvasRect.canvasX;
  const canvasCropY = canvasRect.canvasY;

  // 计算 OCR 结果相对于裁剪后图片的比例，然后映射到画布坐标
  const details = ocrResult.details.map((detail) => {
    // OCR 坐标是相对于裁剪后的图片的（像素坐标）
    // 计算在裁剪后图片中的相对位置（0-1）
    const relativeX = detail.minX / croppedImageWidth;
    const relativeY = detail.minY / croppedImageHeight;
    const relativeWidth = (detail.maxX - detail.minX) / croppedImageWidth;
    const relativeHeight = (detail.maxY - detail.minY) / croppedImageHeight;

    // 映射到画布坐标
    const canvasMinX = canvasCropX + relativeX * canvasCropWidth;
    const canvasMinY = canvasCropY + relativeY * canvasCropHeight;
    const canvasMaxX = canvasMinX + relativeWidth * canvasCropWidth;
    const canvasMaxY = canvasMinY + relativeHeight * canvasCropHeight;

    return {
      ...detail,
      minX: canvasMinX,
      minY: canvasMinY,
      maxX: canvasMaxX,
      maxY: canvasMaxY,
    };
  });

  return {
    ...ocrResult,
    details,
  };
};

const handleWaitingRectComplete = async (rect: {
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
}) => {
  if (!currentImage.value || !canvasRef.value) return;

  try {
    // 获取图片坐标
    const imageCoords = canvasRef.value.canvasToImageCoords(
      rect.canvasX,
      rect.canvasY,
      rect.canvasWidth,
      rect.canvasHeight
    );

    if (!imageCoords) {
      console.error("无法转换坐标");
      return;
    }

    // 裁剪图片
    const croppedFile = await cropImage(
      currentImage.value.file,
      imageCoords.x,
      imageCoords.y,
      imageCoords.width,
      imageCoords.height
    );

    // 提交 OCR 识别请求
    const ocrResult = await performOcr(croppedFile);

    // 获取图片在画布上的位置信息（需要通过 canvasRef 获取）
    // 这里我们需要从 useCanvas 中获取 imageRect
    // 暂时使用 canvasToImageCoords 的反向计算
    // 实际上我们需要直接访问 imageRect，但为了简化，我们使用另一种方法
    
    // 由于 OCR 结果的坐标是相对于裁剪后的图片的，我们需要将其转换为画布坐标
    // 裁剪后的图片尺寸就是 imageCoords.width 和 imageCoords.height
    // 画布上裁剪框的尺寸就是 rect.canvasWidth 和 rect.canvasHeight
    
    const details = ocrResult.details.map((detail) => {
      // OCR 坐标是相对于裁剪后的图片的（像素坐标）
      const croppedImageWidth = imageCoords.width;
      const croppedImageHeight = imageCoords.height;

      // 计算在裁剪后图片中的相对位置（0-1）
      const relativeX = detail.minX / croppedImageWidth;
      const relativeY = detail.minY / croppedImageHeight;
      const relativeWidth = (detail.maxX - detail.minX) / croppedImageWidth;
      const relativeHeight = (detail.maxY - detail.minY) / croppedImageHeight;

      // 映射到画布坐标
      const canvasMinX = rect.canvasX + relativeX * rect.canvasWidth;
      const canvasMinY = rect.canvasY + relativeY * rect.canvasHeight;
      const canvasMaxX = canvasMinX + relativeWidth * rect.canvasWidth;
      const canvasMaxY = canvasMinY + relativeHeight * rect.canvasHeight;

      return {
        ...detail,
        minX: canvasMinX,
        minY: canvasMinY,
        maxX: canvasMaxX,
        maxY: canvasMaxY,
      };
    });

    const canvasOcrResult: OcrTextResult = {
      ...ocrResult,
      details,
    };

    // 合并到现有的 OCR 结果中
    if (currentImage.value.ocrResult) {
      currentImage.value.ocrResult.details.push(...canvasOcrResult.details);
    } else {
      currentImage.value.ocrResult = canvasOcrResult;
    }

    // 获取图片在画布上的信息
    const imageRect = canvasRef.value.imageRect || { x: 0, y: 0, w: 0, h: 0, ow: 0, oh: 0 };
    
    // 将画布坐标转换为图片相对坐标（原图坐标）
    // loadOcrBoxes 期望的坐标是原图坐标
    const imageRelativeDetails = canvasOcrResult.details.map((detail) => {
      // 画布坐标 -> 图片相对坐标（0-1）
      const relativeX = (detail.minX - imageRect.x) / imageRect.w;
      const relativeY = (detail.minY - imageRect.y) / imageRect.h;
      const relativeWidth = (detail.maxX - detail.minX) / imageRect.w;
      const relativeHeight = (detail.maxY - detail.minY) / imageRect.h;

      // 转换为原图坐标（像素）
      const originalMinX = relativeX * imageRect.ow;
      const originalMinY = relativeY * imageRect.oh;
      const originalMaxX = originalMinX + relativeWidth * imageRect.ow;
      const originalMaxY = originalMinY + relativeHeight * imageRect.oh;

      return {
        ...detail,
        minX: originalMinX,
        minY: originalMinY,
        maxX: originalMaxX,
        maxY: originalMaxY,
      };
    });

    const finalOcrResult: OcrTextResult = {
      ...ocrResult,
      details: imageRelativeDetails,
    };

    // 合并到现有的 OCR 结果中
    if (currentImage.value.ocrResult) {
      currentImage.value.ocrResult.details.push(...imageRelativeDetails);
    } else {
      currentImage.value.ocrResult = finalOcrResult;
    }

    // 重新加载 OCR 框
    canvasRef.value.loadOcrBoxes(currentImage.value.ocrResult);
  } catch (error) {
    console.error("等待识别框 OCR 识别失败:", error);
  }
};

const updateZoom = (event: { level: number }) => {
  zoomLevel.value = event.level;
};

onMounted(() => {
  canvasEventBus.on("canvas:zoom", updateZoom);
  // 初始化时执行重置缩放，确保居中计算正确
  nextTick(() => {
    setTimeout(() => {
      handleZoomReset();
    }, 100);
  });
});

onUnmounted(() => {
  canvasEventBus.off("canvas:zoom", updateZoom);
});
</script>

<style scoped></style>
