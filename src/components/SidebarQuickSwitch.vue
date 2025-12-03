<template>
  <div
    class="flex gap-1 items-center"
    :class="isCollapsed ? 'flex-col w-full' : ''"
  >
    <button
      v-for="button in buttons"
      :key="button.tab"
      type="button"
      class="rounded-md font-semibold transition-all border text-xs focus:outline-none focus:ring-0"
      :class="[
        isCollapsed ? 'w-8 h-8' : 'w-9 h-9',
        button.tab === activeTab
          ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
          : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200',
      ]"
      :title="button.title"
      @click="handleClick(button.tab)"
    >
      {{ button.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { uiEventBus, type SidebarTab } from "../core/event-bus";

const props = defineProps<{
  activeTab: SidebarTab;
  isCollapsed: boolean;
}>();

const buttons: Array<{
  tab: SidebarTab;
  label: string;
  title: string;
}> = [
  { tab: "images", label: "1", title: "切换到图片列表（快捷键 1）" },
  { tab: "text", label: "2", title: "切换到文本结果（快捷键 2）" },
];

const handleClick = (tab: SidebarTab) => {
  if (tab === props.activeTab) return;
  uiEventBus.emit("ui:sidebar-switch", tab);
};
</script>
