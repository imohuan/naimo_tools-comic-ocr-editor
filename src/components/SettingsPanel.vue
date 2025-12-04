<template>
  <div class="space-y-4 text-sm text-gray-600">
    <div class="text-xs text-gray-400">
      调整 OCR、翻译、修复与任务等运行参数
    </div>

    <div class="grid gap-4 md:grid-cols-3 auto-rows-min items-start">
      <!-- 检测配置 -->
      <div class="col-span-full text-xs font-semibold text-gray-500 mb-1">
        检测配置
      </div>

      <label class="flex flex-col gap-1 text-xs text-gray-500">
        <span class="text-[13px] font-medium text-gray-700">检测分辨率</span>
        <select
          v-model.number="config.detector.detection_size"
          class="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option
            v-for="option in detectionSizeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-xs text-gray-500">
        <span class="text-[13px] font-medium text-gray-700">文本检测器</span>
        <select
          v-model="config.detector.detector"
          class="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option
            v-for="option in detectorOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-xs text-gray-500">
        <span class="text-[13px] font-medium text-gray-700">Box 阈值</span>
        <input
          v-model.number="config.detector.box_threshold"
          type="number"
          step="0.1"
          min="0"
          max="1"
          class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </label>

      <label class="flex flex-col gap-1 text-xs text-gray-500">
        <span class="text-[13px] font-medium text-gray-700">Unclip 比率</span>
        <input
          v-model.number="config.detector.unclip_ratio"
          type="number"
          step="0.1"
          min="0"
          class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </label>

      <!-- 渲染配置 -->
      <div class="col-span-full mt-2 text-xs font-semibold text-gray-500 mb-1">
        渲染配置
      </div>

      <label class="flex flex-col gap-1 text-xs text-gray-500">
        <span class="text-[13px] font-medium text-gray-700">渲染方向</span>
        <select
          v-model="config.render.direction"
          class="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option
            v-for="option in directionOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <!-- 翻译配置 -->
      <div class="col-span-full mt-2 text-xs font-semibold text-gray-500 mb-1">
        翻译配置
      </div>

      <label class="flex flex-col gap-1 text-xs text-gray-500">
        <span class="text-[13px] font-medium text-gray-700">翻译器</span>
        <select
          v-model="config.translator.translator"
          class="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option
            v-for="option in translatorOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-xs text-gray-500">
        <span class="text-[13px] font-medium text-gray-700">目标语言</span>
        <select
          v-model="config.translator.target_lang"
          class="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option
            v-for="option in targetLangOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <!-- 修复配置 -->
      <div class="col-span-full mt-2 text-xs font-semibold text-gray-500 mb-1">
        修复配置
      </div>

      <label class="flex flex-col gap-1 text-xs text-gray-500">
        <span class="text-[13px] font-medium text-gray-700">修复尺寸</span>
        <select
          v-model.number="config.inpainter.inpainting_size"
          class="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option
            v-for="option in inpaintingSizeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-xs text-gray-500">
        <span class="text-[13px] font-medium text-gray-700">修复器</span>
        <select
          v-model="config.inpainter.inpainter"
          class="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option
            v-for="option in inpainterOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-xs text-gray-500">
        <span class="text-[13px] font-medium text-gray-700">遮罩扩展偏移</span>
        <input
          v-model.number="config.mask_dilation_offset"
          type="number"
          min="0"
          step="1"
          class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </label>

      <!-- 任务与音频 -->
      <div class="col-span-full mt-2 text-xs font-semibold text-gray-500 mb-1">
        任务与音频
      </div>

      <div class="col-span-full space-y-2">
        <div class="mb-1 text-[13px] font-medium text-gray-700">
          音频并发数量
        </div>
        <p class="text-[11px] text-gray-400 mb-1">
          并发越高占用越大，请根据机器性能合理选择
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="value in audioConcurrencyOptions"
            :key="value"
            type="button"
            class="px-3 py-1 rounded border text-xs transition-colors"
            :class="
              taskStore.audioConcurrency === value
                ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            "
            @click="taskStore.setAudioConcurrency(value)"
          >
            {{ value }}
          </button>
        </div>
      </div>
    </div>

    <!-- 底部操作区域：右下角对齐 -->
    <div
      class="pt-4 mt-2 border-t border-dashed border-gray-200 flex justify-end gap-2"
    >
      <button
        type="button"
        class="px-4 py-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        @click="handleCancel"
      >
        取消
      </button>
      <button
        type="button"
        class="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-sm"
        @click="handleSave"
      >
        保存
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getOcrConfig, saveOcrConfig } from "../utils/config";
import type { OcrConfig } from "../types";
import { useTaskStore } from "../stores/taskStore";

const emits = defineEmits<{
  close: [];
}>();

const taskStore = useTaskStore();

const config = ref<OcrConfig>({
  detector: {
    detector: "default",
    detection_size: 1536,
    box_threshold: 0.7,
    unclip_ratio: 2.3,
  },
  render: {
    direction: "auto",
  },
  translator: {
    translator: "youdao",
    target_lang: "CHS",
  },
  inpainter: {
    inpainter: "lama_large",
    inpainting_size: 2048,
  },
  mask_dilation_offset: 30,
});

const detectionSizeOptions = [
  { label: "1024px", value: 1024 },
  { label: "1536px", value: 1536 },
  { label: "2048px", value: 2048 },
  { label: "2560px", value: 2560 },
];

const detectorOptions = [
  { label: "Default", value: "default" },
  { label: "CTD", value: "ctd" },
  { label: "Paddle", value: "paddle" },
];

const directionOptions = [
  { label: "Auto", value: "auto" },
  { label: "水平 (Horizontal)", value: "horizontal" },
  { label: "垂直 (Vertical)", value: "vertical" },
];

const translatorOptions = [
  "youdao",
  "baidu",
  "deepl",
  "papago",
  "caiyun",
  "sakura",
  "offline",
  "openai",
  "deepseek",
  "groq",
  "gemini",
  "custom_openai",
  "nllb",
  "nllb_big",
  "sugoi",
  "jparacrawl",
  "jparacrawl_big",
  "m2m100",
  "m2m100_big",
  "mbart50",
  "qwen2",
  "qwen2_big",
  "none",
  "original",
].map((key) => ({
  label: key === "none" ? "No Text" : key[0].toUpperCase() + key.slice(1),
  value: key,
}));

const targetLangOptions = [
  { label: "简体中文", value: "CHS" },
  { label: "繁體中文", value: "CHT" },
  { label: "English", value: "ENG" },
  { label: "日本語", value: "JPN" },
  { label: "한국어", value: "KOR" },
];

const inpaintingSizeOptions = [
  { label: "516px", value: 516 },
  { label: "1024px", value: 1024 },
  { label: "2048px", value: 2048 },
  { label: "2560px", value: 2560 },
];

const inpainterOptions = [
  { label: "Default", value: "default" },
  { label: "Lama Large", value: "lama_large" },
  { label: "Lama MPE", value: "lama_mpe" },
  { label: "SD", value: "sd" },
  { label: "None", value: "none" },
  { label: "Original", value: "original" },
];

const audioConcurrencyOptions = [1, 2, 3, 5, 8];

const handleSave = async () => {
  try {
    await saveOcrConfig(config.value);
    emits("close");
  } catch (error) {
    console.error("保存配置失败:", error);
  }
};

const handleCancel = () => {
  emits("close");
};

onMounted(async () => {
  const savedConfig = await getOcrConfig();
  config.value = savedConfig;
});
</script>
