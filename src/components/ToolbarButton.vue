<template>
  <button
    :class="[
      'w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg cursor-pointer transition-all text-gray-700 hover:bg-gray-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed relative outline-none',
      customClass,
    ]"
    :disabled="disabled"
    :title="title"
    @click="$emit('click')"
  >
    <slot />
    <!-- 快捷键提示 -->
    <span
      v-if="shortcut"
      class="absolute -bottom-1 -right-1 text-[9px] font-bold leading-none text-white bg-gray-800 rounded px-1 py-0.5 font-mono shadow-lg z-10 min-w-[14px] text-center"
    >
      {{ shortcutText }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  disabled?: boolean;
  title?: string;
  shortcut?: string;
  customClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  title: "",
  shortcut: "",
  customClass: "",
});

defineEmits<{
  (e: "click"): void;
}>();

const shortcutText = computed(() => {
  if (!props.shortcut) return "";
  // 单键快捷键直接显示
  if (props.shortcut.length === 1) {
    return props.shortcut.toUpperCase();
  }
  // 将 Ctrl 转换为平台特定的显示
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return props.shortcut.replace(/Ctrl\+/g, isMac ? "⌘" : "Ctrl+");
});
</script>

<style scoped></style>
