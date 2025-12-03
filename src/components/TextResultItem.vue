<template>
  <div class="mb-2 last:mb-0">
    <div class="border border-gray-100 rounded-md bg-white overflow-hidden">
      <!-- 头部 -->
      <div
        class="flex items-center justify-between space-x-2 px-2 py-1.5 border-b border-gray-100 bg-gray-50"
      >
        <div class="flex items-center space-x-2">
          <span
            class="drag-handle cursor-move text-xs px-1.5 py-0.5 rounded bg-gray-400 text-white"
          >
            #{{ index + 1 }}
          </span>
        </div>
        <div class="flex items-center space-x-1.5">
          <div class="w-28">
            <n-popover
              v-model:show="voicePopoverVisible"
              trigger="click"
              placement="bottom-start"
              :show-arrow="false"
            >
              <template #trigger>
                <button
                  type="button"
                  class="w-full h-7 px-2 rounded border border-gray-300 bg-white text-xs flex items-center justify-between text-gray-700 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
                >
                  <span class="truncate">
                    {{ currentVoiceLabel }}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    class="w-3 h-3 ml-1 text-gray-400 flex-shrink-0"
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
              </template>
              <div class="min-w-[150px] max-h-64 overflow-y-auto text-xs">
                <div
                  v-for="item in voiceRoleOptions"
                  :key="item.value || 'default'"
                  class="px-2 py-1.5 flex items-center justify-between cursor-pointer hover:bg-emerald-50"
                  @click="handleSelectVoice(item.value)"
                >
                  <span class="truncate">{{ item.label }}</span>
                  <span
                    v-if="item.value === localVoiceRole"
                    class="ml-2 text-emerald-500 flex-shrink-0"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      class="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                </div>
              </div>
            </n-popover>
          </div>
          <!-- 生成音频按钮 -->
          <button
            type="button"
            class="w-7 h-7 p-0 rounded-md text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-60 disabled:cursor-default"
            aria-label="生成音频"
            :disabled="detail.audioLoading"
            @click="handleGenerateAudio"
          >
            <!-- 加载中：小圆环 spinner -->
            <div
              v-if="detail.audioLoading"
              class="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"
            ></div>
            <!-- 默认播放图标 -->
            <svg
              v-else
              viewBox="0 0 24 24"
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8 5v14l11-7-11-7z"
              />
            </svg>
          </button>
          <button
            type="button"
            class="w-7 h-7 p-0 rounded-md text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center flex-shrink-0"
            aria-label="删除文本"
            @click="emit('delete-detail', index)"
          >
            <svg
              viewBox="0 0 24 24"
              class="w-3.5 h-3.5"
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
            class="w-7 h-7 p-0 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center flex-shrink-0"
            aria-label="折叠原文"
            @click="toggleOrigin"
          >
            <svg
              viewBox="0 0 24 24"
              class="w-3.5 h-3.5 transition-transform duration-200"
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

      <!-- 内容区域 -->
      <div class="p-2 space-y-2">
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

        <!-- 生成后的音频播放器 -->
        <div v-if="detail.audioUrl" class="mt-1">
          <audio
            class="w-full h-[30px]"
            :src="detail.audioUrl"
            controls
            preload="metadata"
          ></audio>
        </div>

        <!-- 可折叠的原始内容 -->
        <div
          v-if="showOrigin"
          class="pt-1 border-t border-dashed border-gray-200"
        >
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { NInput, NPopover } from "naive-ui";
import type { OcrTextDetail } from "../types";
import { useEdgeTts } from "../composables/useEdgeTts";

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
  (e: "update-audio-state", index: number, value: Partial<OcrTextDetail>): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const { audioUrl, generateAudioUrl } = useEdgeTts();

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
const voicePopoverVisible = ref(false);

const currentVoiceLabel = computed(() => {
  const value =
    localVoiceRole.value || props.voiceRoleOptions?.[0]?.value || "";
  const found = props.voiceRoleOptions.find((item) => item.value === value);
  return found?.label ?? "自动选择";
});

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

const handleSelectVoice = (value: string) => {
  handleUpdateVoiceRole(value);
  voicePopoverVisible.value = false;
};

const toggleOrigin = () => {
  showOrigin.value = !showOrigin.value;
};

// 生成音频并更新当前明细的音频状态到 Store
const handleGenerateAudio = async () => {
  const textSource =
    localTranslatedText.value ||
    localOriginText.value ||
    normalizeText(props.detail.text);

  const voice =
    localVoiceRole.value ||
    props.detail.voiceRole ||
    props.voiceRoleOptions?.[0]?.value ||
    "zh-CN-XiaoxiaoNeural";

  const content = textSource.trim();
  if (!content) return;

  // 开始生成：更新当前条目的音频状态（存到 ocrStore 中）
  emit("update-audio-state", props.index, {
    audioLoading: true,
    audioError: null,
  });

  try {
    const url = await generateAudioUrl(content, voice);
    emit("update-audio-state", props.index, {
      audioLoading: false,
      audioUrl: url ?? audioUrl.value ?? null,
      audioError: null,
    });
  } catch (error: any) {
    const msg =
      typeof error?.message === "string" ? error.message : "生成音频失败";
    emit("update-audio-state", props.index, {
      audioLoading: false,
      audioError: msg,
    });
  }
};
</script>

<style scoped></style>
