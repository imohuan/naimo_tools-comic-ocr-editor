import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Naimo } from '../../typings/naimo';
import type { OcrTextResult, OcrTextDetail } from '../types';

export interface ImageFileInfo {
  path: string;
  name: string;
  url: string;
}

export interface ProjectConfig {
  images: {
    [imagePath: string]: {
      processedImagePath?: string;
      ocrResult: OcrTextDetail[];
    };
  };
  version: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Naimo API Store
 * 提供 naimo API 实例、可用性检查和所有项目相关功能
 */
export const useNaimoStore = defineStore('naimo', () => {
  /**
   * 检查 naimo 是否可用
   */
  const isAvailable = computed(() => {
    return typeof window !== 'undefined' &&
      (window as any).naimo !== undefined &&
      (window as any).naimo !== null;
  });

  /**
   * 获取 naimo API 实例
   * 在浏览器环境中返回 null
   */
  const getNaimo = (): Naimo | null => {
    if (!isAvailable.value) {
      return null;
    }
    return (window as any).naimo as Naimo;
  };

  /**
   * 在 Electron 模式下执行回调
   */
  const runInElectron = async <T>(
    callback: (naimo: Naimo) => Promise<T>
  ): Promise<T | null> => {
    const naimo = getNaimo();
    if (!naimo) {
      console.warn('Naimo API 不可用，当前运行在浏览器模式');
      return null;
    }
    try {
      return await callback(naimo);
    } catch (error) {
      console.error('Electron 操作失败:', error);
      throw error;
    }
  };

  // ==================== 项目相关状态 ====================

  // 当前选中的文件夹路径
  const currentFolder = ref<string | null>(null);
  // 当前文件夹中的图片文件
  const folderImages = ref<ImageFileInfo[]>([]);
  // 配置加载状态
  const configLoading = ref(false);
  // 错误信息
  const error = ref<string | null>(null);

  // 检查是否处于 Electron 模式且有文件夹打开
  const isProjectMode = computed(() => {
    return isAvailable.value && currentFolder.value !== null;
  });

  // ==================== 项目相关方法 ====================

  /**
   * 选择文件夹
   */
  const selectFolder = async (): Promise<boolean> => {
    if (!isAvailable.value) {
      error.value = '浏览器模式不支持文件夹操作';
      return false;
    }

    try {
      const api = window.myPluginAPI;
      const folderPath = await api.selectFolder();

      if (!folderPath) {
        return false;
      }

      currentFolder.value = folderPath;
      await loadFolderImages();
      error.value = null;
      return true;
    } catch (err: any) {
      error.value = err.message || '选择文件夹失败';
      return false;
    }
  };

  /**
   * 加载文件夹中的图片
   */
  const loadFolderImages = async () => {
    if (!currentFolder.value || !isAvailable.value) {
      folderImages.value = [];
      return;
    }

    try {
      configLoading.value = true;
      const api = window.myPluginAPI;
      const images = await api.getImagesInFolder(currentFolder.value);
      folderImages.value = images;
    } catch (err: any) {
      error.value = err.message || '加载图片失败';
      folderImages.value = [];
    } finally {
      configLoading.value = false;
    }
  };

  /**
   * 读取配置
   */
  const readConfig = async (): Promise<ProjectConfig | null> => {
    if (!currentFolder.value || !isAvailable.value) {
      return null;
    }

    try {
      const api = window.myPluginAPI;
      return await api.readConfig(currentFolder.value);
    } catch (err: any) {
      error.value = err.message || '读取配置失败';
      return null;
    }
  };

  /**
   * 写入配置
   */
  const writeConfig = async (config: ProjectConfig): Promise<boolean> => {
    if (!currentFolder.value || !isAvailable.value) {
      return false;
    }

    try {
      configLoading.value = true;
      const api = window.myPluginAPI;
      if (!api) {
        throw new Error('API 不存在');
      }
      const success = await api.writeConfig(currentFolder.value, config);

      if (!success) {
        throw new Error('写入配置失败');
      }

      error.value = null;
      return true;
    } catch (err: any) {
      error.value = err.message || '写入配置失败';
      return false;
    } finally {
      configLoading.value = false;
    }
  };

  /**
   * 保存 OCR 结果
   */
  const saveOcrResult = async (imagePath: string, ocrResult: OcrTextResult): Promise<boolean> => {
    if (!currentFolder.value || !isAvailable.value) {
      return false;
    }

    try {
      const api = window.myPluginAPI;
      if (!api) {
        throw new Error('API 不存在');
      }
      const success = await api.saveOcrResult(currentFolder.value, imagePath, ocrResult);

      if (!success) {
        throw new Error('保存 OCR 结果失败');
      }

      error.value = null;
      return true;
    } catch (err: any) {
      error.value = err.message || '保存 OCR 结果失败';
      return false;
    }
  };

  /**
   * 获取 OCR 结果
   */
  const getOcrResult = async (imagePath: string): Promise<OcrTextResult | null> => {
    if (!currentFolder.value || !isAvailable.value) {
      return null;
    }

    try {
      const api = window.myPluginAPI;
      return await api.getOcrResult(currentFolder.value, imagePath);
    } catch (err: any) {
      error.value = err.message || '获取 OCR 结果失败';
      return null;
    }
  };

  /**
   * 生成音频
   */
  const generateAudio = async (
    text: string,
    options?: {
      voice?: string;
      rate?: string;
      volume?: string;
      pitch?: string;
    }
  ): Promise<Buffer | null> => {
    if (!isAvailable.value) {
      throw new Error('浏览器模式不支持音频生成');
    }

    try {
      const api = window.myPluginAPI;
      return await api.generateAudioWithEdgeTTS(text, options);
    } catch (err: any) {
      error.value = err.message || '音频生成失败';
      return null;
    }
  };

  /**
   * 保存音频文件
   */
  const saveAudioFile = async (detailId: string, audioBuffer: Buffer): Promise<string | null> => {
    if (!currentFolder.value || !isAvailable.value) {
      return null;
    }

    try {
      const api = window.myPluginAPI;
      if (!api) {
        throw new Error('API 不存在');
      }
      const result = await api.saveAudioFile(currentFolder.value, detailId, audioBuffer);
      return result;
    } catch (err: any) {
      error.value = err.message || '保存音频文件失败';
      return null;
    }
  };

  /**
   * 获取音频 URL
   */
  const getAudioUrl = async (audioFilePath: string): Promise<string | null> => {
    if (!isAvailable.value) {
      return null;
    }

    try {
      const api = window.myPluginAPI;
      return await api.getAudioUrl(audioFilePath);
    } catch (err: any) {
      error.value = err.message || '获取音频 URL 失败';
      return null;
    }
  };

  /**
   * 保存音频文件信息
   */
  const saveAudioFileInfo = async (
    imagePath: string,
    detailId: string,
    audioFilePath: string
  ): Promise<boolean> => {
    if (!currentFolder.value || !isAvailable.value) {
      return false;
    }

    try {
      const api = window.myPluginAPI;
      if (!api) {
        throw new Error('API 不存在');
      }
      const success = await api.saveAudioFileInfo(currentFolder.value, imagePath, detailId, audioFilePath);

      if (!success) {
        throw new Error('保存音频信息失败');
      }

      error.value = null;
      return true;
    } catch (err: any) {
      error.value = err.message || '保存音频信息失败';
      return false;
    }
  };

  /**
   * 获取音频文件路径
   */
  const getAudioFilePath = async (imagePath: string, detailId: string): Promise<string | null> => {
    if (!currentFolder.value || !isAvailable.value) {
      return null;
    }

    try {
      const api = window.myPluginAPI;
      return await api.getAudioFilePath(currentFolder.value, imagePath, detailId);
    } catch (err: any) {
      error.value = err.message || '获取音频文件路径失败';
      return null;
    }
  };

  /**
   * 保存处理后的图片到本地
   */
  const saveProcessedImage = async (imagePath: string, processedImageUrl: string): Promise<string | null> => {
    if (!currentFolder.value || !isAvailable.value) {
      return null;
    }

    try {
      const api = window.myPluginAPI;
      if (!api) {
        throw new Error('API 不存在');
      }
      const result = await api.saveProcessedImage(currentFolder.value, imagePath, processedImageUrl);
      return result;
    } catch (err: any) {
      error.value = err.message || '保存处理图片失败';
      return null;
    }
  };

  /**
   * 获取处理图片 URL
   */
  const getProcessedImageUrl = async (processedImagePath: string): Promise<string | null> => {
    if (!currentFolder.value || !isAvailable.value) {
      return null;
    }

    try {
      const api = window.myPluginAPI;
      return await api.getProcessedImageUrl(currentFolder.value, processedImagePath);
    } catch (err: any) {
      error.value = err.message || '获取处理图片 URL 失败';
      return null;
    }
  };

  /**
   * 关闭项目
   */
  const closeProject = () => {
    currentFolder.value = null;
    folderImages.value = [];
    error.value = null;
  };

  return {
    // Naimo API 相关
    isAvailable,
    getNaimo,
    runInElectron,

    // 项目状态
    currentFolder,
    folderImages,
    configLoading,
    error,
    isProjectMode,

    // 项目方法
    selectFolder,
    loadFolderImages,
    readConfig,
    writeConfig,
    saveOcrResult,
    getOcrResult,
    generateAudio,
    saveAudioFile,
    getAudioUrl,
    saveAudioFileInfo,
    getAudioFilePath,
    saveProcessedImage,
    getProcessedImageUrl,
    closeProject,
  };
});
