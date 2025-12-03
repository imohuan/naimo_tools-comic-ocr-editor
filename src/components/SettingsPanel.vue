<template>
  <div class="settings-panel">
    <n-form label-placement="top" size="medium" :show-feedback="false">
      <div class="form-grid">
        <!-- 检测配置 -->
        <n-form-item label="检测分辨率">
          <n-select
            v-model:value="config.detector.detection_size"
            :options="detectionSizeOptions"
            placeholder="请选择检测分辨率"
          />
        </n-form-item>

        <n-form-item label="文本检测器">
          <n-select
            v-model:value="config.detector.detector"
            :options="detectorOptions"
            placeholder="请选择文本检测器"
          />
        </n-form-item>

        <n-form-item label="Box阈值">
          <n-input-number
            v-model:value="config.detector.box_threshold"
            :precision="1"
            :min="0"
            :max="1"
            :step="0.1"
            :show-button="false"
            placeholder="Box阈值"
            style="width: 100%"
          />
        </n-form-item>

        <n-form-item label="Unclip比率">
          <n-input-number
            v-model:value="config.detector.unclip_ratio"
            :precision="1"
            :min="0"
            :step="0.1"
            :show-button="false"
            placeholder="Unclip比率"
            style="width: 100%"
          />
        </n-form-item>

        <!-- 渲染配置 -->
        <n-form-item label="渲染方向">
          <n-select
            v-model:value="config.render.direction"
            :options="directionOptions"
            placeholder="请选择渲染方向"
          />
        </n-form-item>

        <!-- 翻译配置 -->
        <n-form-item label="翻译器">
          <n-select
            v-model:value="config.translator.translator"
            :options="translatorOptions"
            placeholder="请选择翻译器"
          />
        </n-form-item>

        <n-form-item label="目标语言">
          <n-select
            v-model:value="config.translator.target_lang"
            :options="targetLangOptions"
            placeholder="请选择目标语言"
          />
        </n-form-item>

        <!-- 修复配置 -->
        <n-form-item label="修复尺寸">
          <n-select
            v-model:value="config.inpainter.inpainting_size"
            :options="inpaintingSizeOptions"
            placeholder="请选择修复尺寸"
          />
        </n-form-item>

        <n-form-item label="修复器">
          <n-select
            v-model:value="config.inpainter.inpainter"
            :options="inpainterOptions"
            placeholder="请选择修复器"
          />
        </n-form-item>

        <n-form-item label="遮罩扩展偏移">
          <n-input-number
            v-model:value="config.mask_dilation_offset"
            :min="0"
            :step="1"
            :show-button="false"
            placeholder="遮罩扩展偏移"
            style="width: 100%"
          />
        </n-form-item>
      </div>

      <!-- 操作按钮 -->
      <div class="action-section">
        <n-button @click="handleCancel" size="large">取消</n-button>
        <n-button type="primary" @click="handleSave" size="large"
          >保存</n-button
        >
      </div>
    </n-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { NForm, NFormItem, NSelect, NInputNumber, NButton } from "naive-ui";
import { getOcrConfig, saveOcrConfig } from "../utils/config";
import type { OcrConfig } from "../types";

const emits = defineEmits<{
  close: [];
}>();

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

<style scoped>
.settings-panel {
  max-height: 80vh;
  overflow-y: auto;
  background: #ffffff;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.action-section {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

/* 滚动条样式 */
.settings-panel::-webkit-scrollbar {
  width: 8px;
}

.settings-panel::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 4px;
}

.settings-panel::-webkit-scrollbar-thumb {
  background: #d9d9d9;
  border-radius: 4px;
}

.settings-panel::-webkit-scrollbar-thumb:hover {
  background: #bfbfbf;
}
</style>
