import { defineStore } from "pinia";
import { ref } from "vue";
import type { OcrConfig } from "../types";
import { getOcrConfig, saveOcrConfig } from "../utils/config";
import { useTaskStore } from "./taskStore";

export const useOcrConfigStore = defineStore("ocr-config-store", () => {
  const config = ref<OcrConfig | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const applySideEffects = (cfg: OcrConfig | null | undefined) => {
    if (!cfg) return;
    // 将配置中的音频并发数同步到任务 Store
    const taskStore = useTaskStore();
    if (cfg.audio_concurrency && cfg.audio_concurrency > 0) {
      taskStore.setAudioConcurrency(cfg.audio_concurrency);
    }
  };

  const loadConfig = async () => {
    if (loading.value) return;
    loading.value = true;
    error.value = null;
    try {
      const cfg = await getOcrConfig();
      config.value = cfg ?? null;
      applySideEffects(cfg ?? null);
    } catch (e: any) {
      console.error("加载 OCR 配置失败:", e);
      error.value = e?.message || "加载配置失败";
    } finally {
      loading.value = false;
    }
  };

  const saveConfigSafe = async (patch: Partial<OcrConfig>) => {
    error.value = null;
    try {
      const current = config.value ?? (await getOcrConfig());
      const next: OcrConfig = {
        ...current,
        ...patch,
      };

      await saveOcrConfig(next);
      config.value = next;
      applySideEffects(next);
    } catch (e: any) {
      console.error("保存 OCR 配置失败:", e);
      error.value = e?.message || "保存配置失败";
      throw e;
    }
  };

  return {
    config,
    loading,
    error,
    loadConfig,
    saveConfig: saveConfigSafe,
  };
});
