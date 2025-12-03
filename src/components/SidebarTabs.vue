<template>
  <aside class="w-16 bg-gray-50 flex flex-col items-center py-2 gap-3">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="w-12 h-16 rounded-md flex flex-col items-center justify-center text-2xs font-medium transition-all duration-200 focus:outline-none focus:ring-0"
      :class="
        tab.key === activeTab
          ? 'bg-blue-500/10 text-blue-600'
          : 'text-gray-500 hover:bg-white hover:text-gray-700'
      "
      :aria-pressed="tab.key === activeTab"
      type="button"
      @click="emit('change', tab.key)"
    >
      <svg
        v-if="tab.key === 'images'"
        class="w-5 h-5 mb-1"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 15l4-4 5 5" />
        <circle cx="14" cy="9" r="1.2" />
      </svg>
      <svg
        v-else
        class="w-5 h-5 mb-1"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
      >
        <path d="M5 7h14" />
        <path d="M5 12h10" />
        <path d="M5 17h7" />
      </svg>
      <span>{{ tab.label }}</span>
    </button>
  </aside>
</template>

<script setup lang="ts">
type SidebarTab = "images" | "text";

interface SidebarTabItem {
  key: SidebarTab;
  label: string;
}

defineProps<{
  tabs: SidebarTabItem[];
  activeTab: SidebarTab;
}>();

const emit = defineEmits<{
  (e: "change", value: SidebarTab): void;
}>();
</script>
