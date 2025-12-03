<template>
  <div
    v-if="previewUrl"
    class="fixed bottom-16 right-4 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
    style="min-width: 150px; max-width: 300px; max-height: 300px"
  >
    <div
      class="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200"
    >
      <span class="text-sm font-medium text-gray-700">裁剪预览</span>
      <button
        type="button"
        class="text-gray-400 hover:text-gray-600 transition-colors"
        @click="close"
      >
        <svg
          class="w-4 h-4"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 4L4 12M4 4l8 8"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
    <div class="flex-1 p-2 overflow-hidden">
      <img
        :src="previewUrl"
        alt="裁剪预览"
        class="max-w-full max-h-[240px] object-contain rounded m-auto"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";

interface Props {
  image?: File | string | null;
}

const props = withDefaults(defineProps<Props>(), {
  image: null,
});

const emit = defineEmits<{
  close: [];
}>();

const previewUrl = ref<string | null>(null);

const updatePreview = () => {
  // 清理旧的 URL
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
  }

  if (!props.image) {
    return;
  }

  if (typeof props.image === "string") {
    previewUrl.value = props.image;
  } else if (props.image instanceof File) {
    previewUrl.value = URL.createObjectURL(props.image);
  }
};

const close = () => {
  if (
    previewUrl.value &&
    typeof props.image === "object" &&
    props.image instanceof File
  ) {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewUrl.value = null;
  emit("close");
};

watch(() => props.image, updatePreview, { immediate: true });

onUnmounted(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
});
</script>

<style scoped></style>
