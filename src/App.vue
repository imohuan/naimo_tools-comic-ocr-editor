<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <div class="flex h-screen overflow-hidden bg-gray-50">
      <!-- 左侧图片 / 文本双侧列表 -->
      <div class="flex h-full bg-white relative">
        <ImageList
          :is-collapsed="isImageListCollapsed"
          @toggle-collapse="toggleImageListCollapse"
        />
        <TextResultList
          :voice-role-options="voiceRoleOptions"
          :is-collapsed="isTextSidebarCollapsed"
          :width="textSidebarWidth"
          @toggle-collapse="toggleTextSidebarCollapse"
          @resize-width="(w: number) => (textSidebarWidth = w)"
        />

        <!-- absolute -bottom-1 -right-1 text-[9px] font-bold leading-none text-white bg-gray-800 rounded px-1 py-0.5 font-mono shadow-lg z-10 min-w-[14px] text-center -->
        <div
          class="absolute left-full top-1 ml-1 z-30 flex items-center justify-center cursor-pointer transition-all duration-200 select-none"
        >
          <span
            class="text-[9px] py-0.5 bg-gray-800 text-white rounded font-mono px-3 font-bold"
            >Tab</span
          >
        </div>
      </div>

      <!-- 中间画布区域 -->
      <div class="flex-1 flex flex-col relative bg-gray-50 w-full overflow-hidden">
        <!-- 画布 + 底部控制栏（在画布容器内部居中） -->
        <div class="flex-1 relative overflow-hidden">
          <Canvas
            ref="canvasRef"
            :image="displayImage"
            :original-image="originalImage"
            :ocr-result="currentImage?.ocrResult"
            :waiting-mode="isWaitingMode"
            :brush-mode-enabled="brushModeEnabled"
            @change-detail="handleChangeDetail"
            @waiting-rect-complete="handleWaitingRectComplete"
            @delete-detail="handleDeleteDetail"
            @re-ocr-detail="handleReOcrDetail"
            @compare="handleCompare"
          />

          <!-- 底部控制栏：相对于画布区域绝对定位并水平居中 -->
          <BottomToolbar
            :current-page="pageCurrent"
            :total-pages="pageTotal"
            :display-zoom="displayZoom"
            :has-image="!!currentImage"
            :ocr-loading="ocrLoading"
            :waiting-mode="isWaitingMode"
            :brush-mode-enabled="brushModeEnabled"
            :is-comparing="isComparing"
            @zoom-in="handleZoomIn"
            @zoom-out="handleZoomOut"
            @zoom-reset="handleZoomReset"
            @ocr="handleOcr"
            @clear-ocr="handleClearCanvas"
            @settings="toggleSettingsModal"
            @toggle-waiting-mode="handleToggleWaitingMode"
            @toggle-brush-mode="handleToggleBrushMode"
            @toggle-compare="handleToggleCompare"
            @open-tasks="toggleTasksModal"
          />

          <!-- 页码显示 - 左下角 -->
          <div
            v-if="pageTotal > 0"
            class="absolute bottom-4 left-4 z-50 text-gray-500 font-mono font-bold text-lg"
          >
            {{ pageCurrent }} / {{ pageTotal }}
          </div>

          <!-- 缩放值显示 - 右下角 -->
          <div
            v-if="currentImage"
            class="absolute bottom-4 right-4 z-50 text-gray-500 text-sm font-semibold"
          >
            {{ displayZoom }}
          </div>
        </div>
      </div>

      <!-- 裁剪预览 -->
      <CropPreview :image="cropPreviewImage" @close="cropPreviewImage = null" />
    </div>

    <!-- 设置对话框 -->
    <n-modal
      v-model:show="showSettings"
      preset="dialog"
      title="设置"
      :show-icon="false"
      :style="{
        width: '80vw',
        'max-width': '1200px',
        'max-height': '800px',
      }"
    >
      <SettingsPanel @close="showSettings = false" />
    </n-modal>

    <!-- 任务列表对话框 -->
    <n-modal
      v-model:show="showTasks"
      preset="card"
      title="任务列表"
      :style="{
        width: '80vw',
        height: '80vh',
        'max-width': '1200px',
        'max-height': '800px',
      }"
    >
      <TaskListPanel />
    </n-modal>

    <!-- 全局文本音频序列播放弹窗 -->
    <!-- <n-modal
      v-model:show="sequencePlayerVisible"
      :show-icon="false"
      preset="card"
      :title="sequencePlayerTitle"
      :style="{ width: '1040px' }"
    >
      <div class="w-full h-[640px]">
        <AudioSequencePlayer
          :model-value="sequencePlayerVisible"
          :playlist="sequencePlayerPlaylist"
        />
      </div>
    </n-modal> -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      v-show="sequencePlayerVisible"
    >
      <!-- 右上角添加一个关闭按钮，点击关闭弹窗 -->
      <button
        class="absolute right-3 top-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/60 transition"
        @click="sequencePlayerVisible = false"
        aria-label="关闭"
      >
        <svg width="20" height="20" fill="none" viewBox="0 0 20 20" class="w-4 h-4">
          <path
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            d="M5 5l10 10M15 5l-10 10"
          />
        </svg>
      </button>

      <div class="w-[95vw] h-[90vh] max-w-[1600px] max-h-[900px]">
        <AudioSequencePlayer
          :model-value="sequencePlayerVisible"
          :playlist="sequencePlayerPlaylist"
        />
      </div>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { useEventListener } from "@vueuse/core";
import { NConfigProvider, NModal } from "naive-ui";
import { useOcrStore } from "./stores/ocrStore";
import { useTaskStore } from "./stores/taskStore";
import Canvas from "./components/Canvas.vue";
import ImageList from "./components/ImageList.vue";
import TextResultList from "./components/TextResultList.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import BottomToolbar from "./components/BottomToolbar.vue";
import CropPreview from "./components/CropPreview.vue";
import AudioSequencePlayer, {
  SequencePlaybackItem,
} from "./components/AudioSequencePlayer.vue";
import TaskListPanel from "./components/TaskListPanel.vue";
import { canvasEventBus, uiEventBus } from "./core/event-bus";
import type { OcrTextResult } from "./types/index";
import { useEdgeTts } from "./composables/useEdgeTts";

const themeOverrides = {
  common: {
    primaryColor: "#36ad6a",
    primaryColorHover: "#18a058",
  },
};

const canvasRef = ref<InstanceType<typeof Canvas>>();
const showSettings = ref(false);
// 全局文本音频序列播放器状态
const sequencePlayerVisible = ref(false);
const sequencePlayerPlaylist = ref<SequencePlaybackItem[]>([]);
const sequencePlayerTitle = ref("文本音频序列播放");
const ocrStore = useOcrStore();
const taskStore = useTaskStore();

const ocrLoading = computed(() => {
  const image = currentImage.value;
  if (!image) return false;
  return taskStore.getProgressByKey(image.id).loading;
});
const zoomLevel = ref(1);
const isWaitingMode = ref(false);
const brushModeEnabled = ref(false);
const isComparing = ref(false);
// 左侧图片列表折叠状态
const isImageListCollapsed = ref(false);
// 右侧文本结果折叠状态
const isTextSidebarCollapsed = ref(false);
const textSidebarWidth = ref(260);
// 使用 Edge TTS Hook 提供的播音人列表
const { voiceRoleOptions, loadVoiceRoleOptions } = useEdgeTts();
// 裁剪预览图片
const cropPreviewImage = ref<File | null>(null);
// 任务列表
const showTasks = ref(false);

const currentImage = computed(() => ocrStore.currentImage);

const runWithOcrProgress = async (imageId: string, runner: () => Promise<void>) => {
  if (!imageId) return runner();
  taskStore.setOcrProgress(imageId, { loading: true, error: null });
  try {
    await runner();
    taskStore.clearTaskProgress(imageId);
  } catch (error: any) {
    const msg =
      error?.name === "AbortError"
        ? "任务已取消"
        : typeof error?.message === "string"
        ? error.message
        : "OCR 任务执行失败";
    taskStore.setOcrProgress(imageId, { loading: false, error: msg });
    throw error;
  }
};

// 计算原始图片（用于对比功能）
const originalImage = computed(() => {
  return currentImage.value?.file || currentImage.value?.url;
});

// 计算当前应该显示的图片（优先使用处理好的图片）
const displayImage = computed(() => {
  return currentImage.value?.processedImageUrl || originalImage.value;
});

// 防御性：在 store 尚未就绪时避免 length 访问报错
const pageTotal = computed(() => ocrStore.images?.length ?? 0);
const pageCurrent = computed(() => (pageTotal.value > 0 ? ocrStore.currentIndex + 1 : 0));

const displayZoom = computed(() => {
  const zoom = zoomLevel.value;
  if (typeof zoom !== "number" || isNaN(zoom) || !isFinite(zoom)) {
    return "100%";
  }
  return Math.round(zoom * 100) + "%";
});

const handleOcr = () => {
  if (!currentImage.value) return;
  const image = currentImage.value;
  taskStore.startOcrForImage(image, (_prev, next) => ({
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

const handleToggleBrushMode = (enabled: boolean) => {
  brushModeEnabled.value = enabled;
};

const handleToggleCompare = () => {
  canvasRef.value?.toggleCompare();
};

const handleCompare = (enabled: boolean) => {
  isComparing.value = enabled;
};

const toggleImageListCollapse = () => {
  isImageListCollapsed.value = !isImageListCollapsed.value;
};

const toggleTextSidebarCollapse = () => {
  isTextSidebarCollapsed.value = !isTextSidebarCollapsed.value;
};

const toggleSettingsModal = () => {
  showSettings.value = !showSettings.value;
};

const toggleTasksModal = () => {
  showTasks.value = !showTasks.value;
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
  imageSource: File | string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl: string | null = null;

    img.onload = () => {
      // 验证坐标和尺寸，确保都是非负数且在图片范围内
      const imgWidth = img.width;
      const imgHeight = img.height;

      // 确保坐标非负数
      const clampedX = Math.max(0, Math.floor(x));
      const clampedY = Math.max(0, Math.floor(y));

      // 确保宽度和高度为正数，且不超出图片边界
      const clampedWidth = Math.max(1, Math.min(Math.floor(width), imgWidth - clampedX));
      const clampedHeight = Math.max(
        1,
        Math.min(Math.floor(height), imgHeight - clampedY)
      );

      // 如果裁剪区域无效，拒绝
      if (
        clampedWidth <= 0 ||
        clampedHeight <= 0 ||
        clampedX >= imgWidth ||
        clampedY >= imgHeight
      ) {
        // 清理 blob URL
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
        reject(new Error("裁剪区域无效：坐标超出图片范围"));
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = clampedWidth;
      canvas.height = clampedHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // 清理 blob URL
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
        reject(new Error("无法创建画布上下文"));
        return;
      }
      ctx.drawImage(
        img,
        clampedX,
        clampedY,
        clampedWidth,
        clampedHeight,
        0,
        0,
        clampedWidth,
        clampedHeight
      );

      // 确定文件类型和名称
      const fileType =
        typeof imageSource === "string" ? "image/png" : imageSource.type || "image/png";
      let fileName = "cropped.png";
      if (typeof imageSource === "string") {
        // 尝试从 URL 中提取文件名（排除 blob: 和 data: URL）
        if (!imageSource.startsWith("blob:") && !imageSource.startsWith("data:")) {
          const urlPath = imageSource.split("?")[0]; // 移除查询参数
          const pathParts = urlPath.split("/");
          const extractedName = pathParts[pathParts.length - 1];
          if (extractedName && extractedName.includes(".")) {
            fileName = extractedName;
          }
        }
      } else {
        fileName = imageSource.name || "cropped.png";
      }

      canvas.toBlob(
        (blob) => {
          // 清理 blob URL
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
          }
          if (!blob) {
            reject(new Error("裁剪失败"));
            return;
          }
          const croppedFile = new File([blob], fileName, {
            type: fileType,
          });
          resolve(croppedFile);
        },
        fileType,
        1.0
      );
    };
    img.onerror = () => {
      // 清理 blob URL
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      reject(new Error("图片加载失败"));
    };

    // 根据输入类型设置图片源
    if (typeof imageSource === "string") {
      img.src = imageSource;
    } else {
      objectUrl = URL.createObjectURL(imageSource);
      img.src = objectUrl;
    }
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
      canvasRef.value.removeWaitingRect(rect.waitingRect);
      console.error("无法转换坐标");
      return;
    }

    // 裁剪图片
    const croppedFile = await cropImage(
      targetImage.file || targetImage.url,
      imageCoords.x,
      imageCoords.y,
      imageCoords.width,
      imageCoords.height
    );

    // 显示裁剪预览
    cropPreviewImage.value = croppedFile;

    // 提交 OCR 识别请求（结果通过 imageId 绑定到对应图片）
    await runWithOcrProgress(targetImage.id, () =>
      ocrStore.runOcrTask(
        targetImage.id,
        croppedFile,
        (prev, next) => {
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
        },
        {
          // 传入裁剪区域信息，用于局部替换图片
          patchArea: {
            x: imageCoords.x,
            y: imageCoords.y,
            width: imageCoords.width,
            height: imageCoords.height,
          },
        }
      )
    );

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
      targetImage.file || targetImage.url,
      detail.minX,
      detail.minY,
      cropWidth,
      cropHeight
    );

    await runWithOcrProgress(targetImage.id, () =>
      ocrStore.runOcrTask(
        targetImage.id,
        croppedFile,
        (prev, next) => {
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
        },
        {
          // 传入裁剪区域信息，用于局部替换图片
          patchArea: {
            x: detail.minX,
            y: detail.minY,
            width: cropWidth,
            height: cropHeight,
          },
        }
      )
    );
  } catch (error) {
    console.error("局部重新识别失败:", error);
  }
};

const updateZoom = (event: { level: number }) => {
  zoomLevel.value = event.level;
};

onMounted(() => {
  canvasEventBus.on("canvas:zoom", updateZoom);
  // 监听来自侧边栏的序列播放请求
  uiEventBus.on("sequence-player:open", (payload) => {
    sequencePlayerTitle.value =
      payload.source === "all-images" ? "全部图片文本音频序列播放" : "文本音频序列播放";
    sequencePlayerPlaylist.value = payload.playlist;
    sequencePlayerVisible.value = true;
  });
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
  uiEventBus.all.clear();
});

useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (event.repeat || shouldIgnoreShortcut(event)) return;

  const isModifierPressed = event.ctrlKey || event.metaKey;
  if (isModifierPressed) {
    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();
      event.stopPropagation();
      ocrStore.undoDetails();
      return;
    }
    if (key === "y") {
      event.preventDefault();
      event.stopPropagation();
      ocrStore.redoDetails();
      return;
    }
  }

  if (event.key === "Tab") {
    event.preventDefault();
    event.stopPropagation();
    toggleTextSidebarCollapse();
    return;
  }

  if (event.key === "Escape") {
    // 当全局文本音频序列播放器打开时，按下 ESC 关闭
    if (sequencePlayerVisible.value) {
      event.preventDefault();
      event.stopPropagation();
      sequencePlayerVisible.value = false;
    }
  }
});
</script>

<style scoped></style>
