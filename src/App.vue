<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <div class="flex h-screen overflow-hidden bg-gray-50">
      <!-- 左侧菜单切换 -->
      <div class="flex h-full bg-white">
        <SidebarTabs
          :tabs="sidebarTabs"
          :active-tab="activeSidebarTab"
          @change="handleSidebarTabChange"
        />
        <ImageList
          v-if="activeSidebarTab === 'images'"
          :is-collapsed="isSidebarCollapsed"
          @toggle-collapse="toggleSidebarCollapse"
        />
        <TextResultList
          v-else
          :voice-role-options="voiceRoleOptions"
          :is-collapsed="isSidebarCollapsed"
          :width="textSidebarWidth"
          @toggle-collapse="toggleSidebarCollapse"
          @resize-width="(w: number) => (textSidebarWidth = w)"
        />
      </div>

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
            @delete-detail="handleDeleteDetail"
            @re-ocr-detail="handleReOcrDetail"
          />
        </div>

        <!-- 底部控制栏 -->
        <BottomToolbar
          :current-page="
            ocrStore.images.length > 0 ? ocrStore.currentIndex + 1 : 0
          "
          :total-pages="ocrStore.images.length"
          :display-zoom="displayZoom"
          :has-image="!!currentImage"
          :ocr-loading="ocrLoading"
          :waiting-mode="isWaitingMode"
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
import { useEventListener } from "@vueuse/core";
import { NConfigProvider, NModal } from "naive-ui";
import { useOcrStore } from "./stores/ocrStore";
import Canvas from "./components/Canvas.vue";
import ImageList from "./components/ImageList.vue";
import TextResultList from "./components/TextResultList.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import BottomToolbar from "./components/BottomToolbar.vue";
import SidebarTabs from "./components/SidebarTabs.vue";
import { canvasEventBus, uiEventBus } from "./core/event-bus";
import type { OcrTextResult } from "./types/index";
import { useEdgeTts } from "./composables/useEdgeTts";

const themeOverrides = {
  common: {
    primaryColor: "#36ad6a",
    primaryColorHover: "#18a058",
  },
};

type SidebarTab = "images" | "text";

const canvasRef = ref<InstanceType<typeof Canvas>>();
const showSettings = ref(false);
const ocrStore = useOcrStore();
const ocrLoading = computed(() => ocrStore.ocrLoading);
const zoomLevel = ref(1);
const isWaitingMode = ref(false);
const isSidebarCollapsed = ref(false);
const textSidebarWidth = ref(260);
const sidebarTabs: Array<{ key: SidebarTab; label: string }> = [
  { key: "images", label: "图片" },
  { key: "text", label: "文本" },
];
const activeSidebarTab = ref<SidebarTab>("images");
// 使用 Edge TTS Hook 提供的播音人列表
const { voiceRoleOptions, loadVoiceRoleOptions } = useEdgeTts();

const currentImage = computed(() => ocrStore.currentImage);

const displayZoom = computed(() => {
  const zoom = zoomLevel.value;
  if (typeof zoom !== "number" || isNaN(zoom) || !isFinite(zoom)) {
    return "100%";
  }
  return Math.round(zoom * 100) + "%";
});

const handleOcr = async () => {
  if (!currentImage.value) return;
  const image = currentImage.value;
  await ocrStore.runOcrTask(image.id, image.file, (_prev, next) => ({
    ...next,
    details: next.details.map((detail) => ({
      ...detail,
      translatedText: detail.translatedText ?? detail.text,
      originText: detail.originText ?? detail.text,
    })),
  }));
};

const handleChangeDetail = (result: OcrTextResult) => {
  if (currentImage.value) {
    ocrStore.setCurrentOcrResult({
      ...result,
      details: result.details.map((detail) => ({
        ...detail,
        // 补全可能缺失的翻译/原文字段，保证文本列表展示正常
        translatedText: detail.translatedText ?? detail.text,
        originText: detail.originText ?? detail.text,
      })),
    });
  }
};

const handleClearCanvas = () => {
  // 只清除OCR结果，不清除图片
  if (currentImage.value) {
    // 先清除画布上的OCR框
    canvasRef.value?.clearOcrResults();
    // 然后清空数据，这会触发 watch 再次清除（双重保险）
    ocrStore.clearCurrentOcrResult();
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

const handleSidebarTabChange = (tab: SidebarTab) => {
  activeSidebarTab.value = tab;
};

const toggleSidebarCollapse = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
};

const ensureTextSidebarActive = () => {
  if (activeSidebarTab.value !== "text") {
    handleSidebarTabChange("text");
  }
};

const triggerUndo = () => {
  ensureTextSidebarActive();
  ocrStore.undoDetails();
};

const triggerRedo = () => {
  ensureTextSidebarActive();
  ocrStore.redoDetails();
};

const shouldIgnoreShortcut = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
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

const handleWaitingRectComplete = async (rect: {
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
  waitingRect: any;
}) => {
  // 保存当前图片的引用，使用 imageId 确保多张图片时结果不会错位
  const targetImage = currentImage.value;
  if (!targetImage || !canvasRef.value) return;

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
      targetImage.file,
      imageCoords.x,
      imageCoords.y,
      imageCoords.width,
      imageCoords.height
    );

    // 提交 OCR 识别请求（结果通过 imageId 绑定到对应图片）
    await ocrStore.runOcrTask(targetImage.id, croppedFile, (prev, next) => {
      // OCR结果的坐标是相对于裁剪后的图片的（像素坐标）
      // 需要转换为原图坐标（像素坐标），因为 loadOcrBoxes 期望原图坐标
      const croppedImageWidth = imageCoords.width;
      const croppedImageHeight = imageCoords.height;

      // 将OCR结果从裁剪图片坐标转换为原图坐标
      const originalImageDetails = next.details.map((detail) => {
        // OCR坐标是相对于裁剪后图片的（像素）
        // 计算在裁剪后图片中的相对位置（0-1）
        const relativeX = detail.minX / croppedImageWidth;
        const relativeY = detail.minY / croppedImageHeight;
        const relativeWidth = (detail.maxX - detail.minX) / croppedImageWidth;
        const relativeHeight = (detail.maxY - detail.minY) / croppedImageHeight;

        // 转换为原图坐标（像素）
        // 裁剪区域在原图中的位置是 imageCoords.x, imageCoords.y
        const originalMinX = imageCoords.x + relativeX * croppedImageWidth;
        const originalMinY = imageCoords.y + relativeY * croppedImageHeight;
        const originalMaxX = originalMinX + relativeWidth * croppedImageWidth;
        const originalMaxY = originalMinY + relativeHeight * croppedImageHeight;

        return {
          ...detail,
          minX: originalMinX,
          minY: originalMinY,
          maxX: originalMaxX,
          maxY: originalMaxY,
        };
      });

      const base: OcrTextResult = prev
        ? { ...prev }
        : {
            details: [],
            img: null,
            detection_size: next.detection_size,
          };

      return {
        ...base,
        detection_size: next.detection_size,
        details: [...base.details, ...originalImageDetails],
      };
    });

    // 删除等待识别框
    if (rect.waitingRect) {
      canvasRef.value.removeWaitingRect(rect.waitingRect);
    }

    // watch 会自动检测到 ocrResult 的变化，调用 loadOcrBoxes 重新绘制
  } catch (error) {
    console.error("等待识别框 OCR 识别失败:", error);
    // 即使出错也要删除等待框
    if (rect.waitingRect && canvasRef.value) {
      canvasRef.value.removeWaitingRect(rect.waitingRect);
    }
  }
};

const handleDeleteDetail = (detailIndex: number) => {
  ocrStore.deleteCurrentDetail(detailIndex);
};

const handleReOcrDetail = async (detailIndex: number) => {
  const targetImage = currentImage.value;
  if (!targetImage?.ocrResult) return;
  const detail = targetImage.ocrResult.details[detailIndex];
  if (!detail) return;

  const cropWidth = detail.maxX - detail.minX;
  const cropHeight = detail.maxY - detail.minY;
  if (cropWidth <= 0 || cropHeight <= 0) return;

  try {
    const croppedFile = await cropImage(
      targetImage.file,
      detail.minX,
      detail.minY,
      cropWidth,
      cropHeight
    );

    await ocrStore.runOcrTask(targetImage.id, croppedFile, (prev, next) => {
      const baseResult = prev || {
        details: [],
        img: null,
        detection_size: next.detection_size,
      };

      const transformedDetails = next.details.map((item) => ({
        ...item,
        minX: detail.minX + item.minX,
        minY: detail.minY + item.minY,
        maxX: detail.minX + item.maxX,
        maxY: detail.minY + item.maxY,
      }));

      const nextDetails = [...baseResult.details];
      // 用新的识别结果替换原有的这一条
      nextDetails.splice(detailIndex, 1, ...transformedDetails);

      return {
        ...baseResult,
        detection_size: next.detection_size,
        details: nextDetails,
      };
    });
  } catch (error) {
    console.error("局部重新识别失败:", error);
  }
};

const updateZoom = (event: { level: number }) => {
  zoomLevel.value = event.level;
};

onMounted(() => {
  canvasEventBus.on("canvas:zoom", updateZoom);
  uiEventBus.on("ui:sidebar-switch", handleSidebarTabChange);
  // 加载播音人列表
  loadVoiceRoleOptions();
  // 初始化时执行重置缩放，确保居中计算正确
  nextTick(() => {
    setTimeout(() => {
      handleZoomReset();
    }, 100);
  });
});

onUnmounted(() => {
  canvasEventBus.off("canvas:zoom", updateZoom);
  uiEventBus.off("ui:sidebar-switch", handleSidebarTabChange);
});

useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (event.repeat || shouldIgnoreShortcut(event)) return;

  const isModifierPressed = event.ctrlKey || event.metaKey;
  if (isModifierPressed) {
    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();
      event.stopPropagation();
      triggerUndo();
      return;
    }
    if (key === "y") {
      event.preventDefault();
      event.stopPropagation();
      triggerRedo();
      return;
    }
  }

  if (event.key === "Tab") {
    event.preventDefault();
    event.stopPropagation();
    toggleSidebarCollapse();
    return;
  }

  if (event.key === "1") {
    event.preventDefault();
    event.stopPropagation();
    handleSidebarTabChange("images");
    return;
  }

  if (event.key === "2") {
    event.preventDefault();
    event.stopPropagation();
    handleSidebarTabChange("text");
  }
});
</script>

<style scoped></style>
