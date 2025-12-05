import { clone } from "lodash-es";
import type { OcrConfig } from "../types";

const DEFAULT_CONFIG: OcrConfig = {
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
  audio_concurrency: 2,
};

const STORAGE_KEY = "comic-ocr-config";

/**
 * 检查是否在 Naimo 环境中
 */
function isNaimoEnv(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.naimo !== "undefined" &&
    window.naimo &&
    typeof window.naimo.storage !== "undefined" &&
    window.naimo.storage !== null
  );
}

/**
 * 从 localStorage 读取配置
 */
function getFromLocalStorage(): OcrConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const configData = JSON.parse(stored);
      return { ...DEFAULT_CONFIG, ...configData };
    }
  } catch (error) {
    console.error("从 localStorage 读取配置失败:", error);
  }
  return null;
}

/**
 * 保存配置到 localStorage
 */
function saveToLocalStorage(config: OcrConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("保存配置到 localStorage 失败:", error);
    throw error;
  }
}

export async function getOcrConfig(): Promise<OcrConfig> {
  // 优先使用 Naimo Storage
  if (isNaimoEnv()) {
    try {
      const stored = await window.naimo.storage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...stored };
      }
    } catch (error) {
      console.error("从 Naimo Storage 读取配置失败:", error);
      // 如果 Naimo Storage 读取失败，尝试从 localStorage 读取
      const localConfig = getFromLocalStorage();
      if (localConfig) {
        return localConfig;
      }
    }
  } else {
    // 浏览器环境，使用 localStorage
    const localConfig = getFromLocalStorage();
    if (localConfig) {
      return localConfig;
    }
  }

  return DEFAULT_CONFIG;
}

export async function saveOcrConfig(config: Partial<OcrConfig>): Promise<void> {
  try {
    const current = await getOcrConfig();
    const newConfig = JSON.parse(JSON.stringify({ ...current, ...config }));

    // 优先使用 Naimo Storage
    if (isNaimoEnv()) {
      try {
        await window.naimo.storage.setItem(STORAGE_KEY, newConfig);
        return;
      } catch (error) {
        console.error("保存配置到 Naimo Storage 失败:", error);
        // 如果 Naimo Storage 保存失败，尝试保存到 localStorage
        saveToLocalStorage(newConfig);
        return;
      }
    } else {
      // 浏览器环境，使用 localStorage
      saveToLocalStorage(newConfig);
    }
  } catch (error) {
    console.error("保存配置失败:", error);
    throw error;
  }
}
