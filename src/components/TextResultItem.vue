<template>
  <div class="mb-2 last:mb-0">
    <n-card size="small" class="border border-gray-100">
      <template #header>
        <div class="flex items-center justify-between space-x-2">
          <div class="flex items-center space-x-2">
            <span
              class="drag-handle cursor-move text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
            >
              #{{ index + 1 }}
            </span>
          </div>
          <div class="flex items-center space-x-1.5">
            <div class="w-28">
              <n-select
                v-model:value="localVoiceRole"
                size="small"
                :options="voiceRoleOptions"
                placeholder="配音角色"
                @update:value="handleUpdateVoiceRole"
              />
            </div>
            <button
              type="button"
              class="w-8 h-8 p-0 rounded-md text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center flex-shrink-0"
              aria-label="删除文本"
              @click="emit('delete-detail', index)"
            >
              <svg
                viewBox="0 0 24 24"
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 4h6m-8 4h10l-1 12H8L7 8zm3 3v6m4-6v6"
                />
              </svg>
            </button>
            <button
              type="button"
              class="w-8 h-8 p-0 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center flex-shrink-0"
              aria-label="折叠原文"
              @click="toggleOrigin"
            >
              <svg
                viewBox="0 0 24 24"
                class="w-4 h-4 transition-transform duration-200"
                :class="showOrigin ? 'rotate-180' : 'rotate-0'"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 9l6 6 6-6"
                />
              </svg>
            </button>
          </div>
        </div>
      </template>

      <!-- 翻译后的内容（默认显示，可编辑） -->
      <n-input
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 4 }"
        v-model:value="localTranslatedText"
        placeholder="翻译后的内容"
        @blur="handleBlurTranslated"
        @clear="handleClearTranslated"
        clearable
        show-count
      />

      <!-- 可折叠的原始内容 -->
      <div v-if="showOrigin" class="mt-2">
        <div class="mb-1 text-xs text-gray-500">原始内容</div>
        <n-input
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
          v-model:value="localOriginText"
          placeholder="原始识别内容"
          @blur="handleBlurOrigin"
          @clear="handleClearOrigin"
          clearable
          show-count
        />
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NCard, NInput, NSelect } from "naive-ui";
import type { OcrTextDetail } from "../types";

interface Props {
  detail: OcrTextDetail;
  index: number;
  voiceRoleOptions: Array<{ label: string; value: string }>;
}

interface Emits {
  (e: "update-translated", index: number, value: string): void;
  (e: "update-origin", index: number, value: string): void;
  (e: "update-voice-role", index: number, value: string | null): void;
  (e: "delete-detail", index: number): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 文本字段有可能是对象（如 { CHS, zh }），统一转成字符串
const normalizeText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.CHS === "string") return obj.CHS;
    const firstStr = Object.values(obj).find((v) => typeof v === "string");
    if (typeof firstStr === "string") return firstStr;
    return JSON.stringify(obj);
  }
  return "";
};

// 单独维护用于输入框的本地字符串
const localTranslatedText = ref("");
const localOriginText = ref("");
const localVoiceRole = ref("");
const showOrigin = ref(false);

const syncLocalFromDetail = () => {
  localTranslatedText.value = normalizeText(
    props.detail.translatedText ?? props.detail.text
  );
  localOriginText.value = normalizeText(
    props.detail.originText ?? props.detail.text
  );
  localVoiceRole.value = props.detail.voiceRole ?? "";
};

// 当外部 detail 变化时同步本地
watch(
  () => [
    props.detail.text,
    props.detail.translatedText,
    props.detail.originText,
    props.detail.voiceRole,
  ],
  () => {
    syncLocalFromDetail();
  },
  { immediate: true }
);

const handleBlurTranslated = () => {
  emit("update-translated", props.index, localTranslatedText.value);
};

const handleClearTranslated = () => {
  localTranslatedText.value = "";
  handleBlurTranslated();
};

const handleBlurOrigin = () => {
  emit("update-origin", props.index, localOriginText.value);
};

const handleClearOrigin = () => {
  localOriginText.value = "";
  handleBlurOrigin();
};

const handleUpdateVoiceRole = (val: string | null) => {
  const next = val ?? "";
  localVoiceRole.value = next;
  emit("update-voice-role", props.index, next);
};

const toggleOrigin = () => {
  showOrigin.value = !showOrigin.value;
};
</script>

<style scoped></style>
