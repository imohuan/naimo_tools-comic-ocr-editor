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
          <div class="flex items-center space-x-1">
            <n-select
              v-model:value="localDetail.voiceRole"
              size="tiny"
              class="w-40"
              :options="voiceRoleOptions"
              placeholder="配音角色"
              @update:value="(val) => emit('update-voice-role', index, val)"
            />
            <n-button
              size="tiny"
              quaternary
              type="error"
              @click="emit('delete-detail', index)"
            >
              删除
            </n-button>
          </div>
        </div>
      </template>

      <!-- 翻译后的内容（默认显示，可编辑） -->
      <n-input
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 4 }"
        v-model:value="localTranslatedText"
        placeholder="翻译后的内容"
        @update:value="handleUpdateTranslated"
        clearable
        show-count
      />

      <!-- 折叠原始内容 -->
      <n-collapse class="mt-2">
        <n-collapse-item name="origin">
          <template #header>
            <span class="text-xs text-gray-500">原始内容</span>
          </template>
          <n-input
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 6 }"
            v-model:value="localOriginText"
            placeholder="原始识别内容"
            @update:value="handleUpdateOrigin"
            clearable
            show-count
          />
        </n-collapse-item>
      </n-collapse>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import {
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NInput,
  NSelect,
} from "naive-ui";
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

// 本地副本：仅用于 voiceRole
const localDetail = ref<OcrTextDetail>({ ...props.detail });

// 单独维护用于输入框的本地字符串
const localTranslatedText = ref(
  normalizeText(props.detail.translatedText ?? props.detail.text)
);
const localOriginText = ref(
  normalizeText(props.detail.originText ?? props.detail.text)
);

// 当外部 detail 变化时同步本地
watch(
  () => props.detail,
  (val) => {
    localDetail.value = { ...val };
    localTranslatedText.value = normalizeText(val.translatedText ?? val.text);
    localOriginText.value = normalizeText(val.originText ?? val.text);
  },
  { deep: true }
);

const handleUpdateTranslated = (val: string) => {
  localTranslatedText.value = val;
  emit("update-translated", props.index, val);
};

const handleUpdateOrigin = (val: string) => {
  localOriginText.value = val;
  emit("update-origin", props.index, val);
};
</script>

<style scoped></style>
