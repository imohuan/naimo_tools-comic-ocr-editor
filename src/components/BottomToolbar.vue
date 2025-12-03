<template>
  <div
    class="absolute z-[50] bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xl rounded-md px-4 py-2 flex items-center gap-3 shadow-2xl border border-gray-200 flex-shrink-0 whitespace-nowrap"
  >
    <!-- 左侧页码 -->
    <div
      class="flex items-center gap-3 pr-3 border-r border-gray-200 flex-shrink-0"
    >
      <span
        class="font-mono font-bold text-lg text-gray-700 whitespace-nowrap px-3"
      >
        {{ currentPage }} / {{ totalPages }}
      </span>
    </div>

    <!-- 缩放控制 -->
    <div
      class="flex items-center gap-2 pr-3 border-r border-gray-200 flex-shrink-0"
    >
      <ToolbarButton
        :disabled="!hasImage"
        :shortcut="zoomOutShortcut"
        title="缩小"
        @click="handleZoomOut"
      >
        <span class="text-xl font-medium">−</span>
      </ToolbarButton>

      <div class="text-sm font-semibold text-gray-700 min-w-[60px] text-center">
        {{ displayZoom }}
      </div>

      <ToolbarButton
        :disabled="!hasImage"
        :shortcut="zoomInShortcut"
        title="放大"
        @click="handleZoomIn"
      >
        <span class="text-xl font-medium">+</span>
      </ToolbarButton>

      <ToolbarButton
        :disabled="!hasImage"
        :shortcut="zoomResetShortcut"
        title="重置缩放"
        @click="handleZoomReset"
      >
        <svg
          t="1764739725616"
          class="w-5 h-5"
          viewBox="0 0 1024 1024"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          p-id="4743"
        >
          <path
            d="M576.3 157.6c-174.3 0-318.9 128-345.7 294.8L175.2 397c-17.6-17.7-46.3-17.7-64 0-17.7 17.7-17.7 46.3 0 64l134.3 134.3c8.8 8.8 20.4 13.3 32 13.3 1.1 0 2.2-0.2 3.3-0.3 1.1 0.1 2.2 0.3 3.3 0.3 11.6 0 23.2-4.4 32-13.3L450.4 461c17.7-17.7 17.7-46.3 0-64-17.7-17.7-46.3-17.7-64 0l-66 66c21.5-121.9 127.9-214.9 255.9-214.9 143.4 0 260.1 116.7 260.1 260.1 0 143.4-116.7 260.1-260.1 260.1-64.9 0-127-24-175-67.6-18.5-16.8-47.1-15.5-63.9 3-16.8 18.5-15.5 47.1 3 63.9 64.7 58.8 148.4 91.2 235.9 91.2 193.3 0 350.6-157.3 350.6-350.6S769.7 157.6 576.3 157.6z"
            p-id="4744"
          ></path>
        </svg>
      </ToolbarButton>
    </div>

    <!-- 功能按钮 -->
    <div class="flex items-center gap-2 flex-shrink-0">
      <!-- OCR识别按钮 -->
      <ToolbarButton
        :disabled="!hasImage || ocrLoading"
        :shortcut="ocrShortcut"
        title="OCR识别"
        class="bg-green-500 text-white hover:bg-green-600"
        @click="handleOcr"
      >
        <svg
          v-if="!ocrLoading"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="w-4 h-4"
        >
          <path
            d="M4 7h16M4 12h16M4 17h7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          fill="none"
          class="w-4 h-4 animate-spin"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
            stroke-opacity="0.25"
          />
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </ToolbarButton>

      <!-- 清除OCR结果按钮 -->
      <ToolbarButton
        :disabled="!hasImage"
        :shortcut="clearShortcut"
        title="清除OCR识别结果"
        @click="handleClearCanvas"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="w-4 h-4"
        >
          <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
          <line x1="18" y1="9" x2="12" y2="15" />
          <line x1="12" y1="9" x2="18" y2="15" />
        </svg>
      </ToolbarButton>

      <!-- 等待识别框模式切换按钮 -->
      <ToolbarButton
        :disabled="!hasImage"
        :shortcut="waitingModeShortcut"
        :title="isWaitingMode ? '关闭等待识别框模式' : '开启等待识别框模式'"
        :class="isWaitingMode ? 'bg-blue-500 text-white hover:bg-blue-600' : ''"
        @click="handleToggleWaitingMode"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="w-4 h-4"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 9h6M9 15h6" />
        </svg>
      </ToolbarButton>

      <!-- 设置按钮 -->
      <ToolbarButton
        :shortcut="settingsShortcut"
        title="设置"
        @click="handleSettings"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="w-4 h-4"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"
          />
        </svg>
      </ToolbarButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import ToolbarButton from "./ToolbarButton.vue";
import { useKeyboardShortcuts } from "../composables/useKeyboardShortcuts.js";

interface Props {
  currentPage: number;
  totalPages: number;
  displayZoom: string;
  hasImage: boolean;
  ocrLoading: boolean;
}

interface Emits {
  (e: "zoom-in"): void;
  (e: "zoom-out"): void;
  (e: "zoom-reset"): void;
  (e: "ocr"): void;
  (e: "clear-ocr"): void;
  (e: "settings"): void;
  (e: "toggle-waiting-mode", enabled: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 按钮上显示的快捷键（空字符串表示不显示）
const zoomInShortcut = "";
const zoomOutShortcut = "";
const zoomResetShortcut = "r";
const ocrShortcut = "q";
const clearShortcut = "x";
const waitingModeShortcut = "w";
const settingsShortcut = "s";

// 实际注册的快捷键（包括不在按钮上显示的）
const zoomInKeyShortcut = "Ctrl+=";
const zoomOutKeyShortcut = "Ctrl+-";

const handleZoomIn = () => {
  if (props.hasImage) {
    emit("zoom-in");
  }
};

const handleZoomOut = () => {
  if (props.hasImage) {
    emit("zoom-out");
  }
};

const handleZoomReset = () => {
  if (props.hasImage) {
    emit("zoom-reset");
  }
};

const handleOcr = () => {
  if (props.hasImage && !props.ocrLoading) {
    emit("ocr");
  }
};

const handleClearCanvas = () => {
  if (props.hasImage) {
    emit("clear-ocr");
  }
};

const handleSettings = () => {
  emit("settings");
};

const isWaitingMode = ref(false);

const handleToggleWaitingMode = () => {
  if (props.hasImage) {
    isWaitingMode.value = !isWaitingMode.value;
    emit("toggle-waiting-mode", isWaitingMode.value);
  }
};

// 快捷键处理
const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

onMounted(() => {
  // 注册放大和缩小的快捷键（不在按钮上显示）
  registerShortcut(zoomInKeyShortcut, handleZoomIn);
  registerShortcut(zoomOutKeyShortcut, handleZoomOut);
  // 注册其他快捷键
  registerShortcut(zoomResetShortcut, handleZoomReset);
  registerShortcut(ocrShortcut, handleOcr);
  registerShortcut(clearShortcut, handleClearCanvas);
  registerShortcut(waitingModeShortcut, handleToggleWaitingMode);
  registerShortcut(settingsShortcut, handleSettings);
});

onUnmounted(() => {
  unregisterShortcut(zoomInKeyShortcut);
  unregisterShortcut(zoomOutKeyShortcut);
  unregisterShortcut(zoomResetShortcut);
  unregisterShortcut(ocrShortcut);
  unregisterShortcut(clearShortcut);
  unregisterShortcut(waitingModeShortcut);
  unregisterShortcut(settingsShortcut);
});
</script>

<style scoped></style>
