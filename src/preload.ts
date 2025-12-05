/// <reference path="../typings/naimo.d.ts" />
/// <reference path="../typings/node.d.ts" />

import { contextBridge } from "electron";
import * as fsp from "fs/promises";
import * as path from "path";

// const fsp = fs.promises;

// ==================== 类型定义 ====================

/**
 * 配置数据结构
 */
interface ProjectConfig {
  images: {
    [imagePath: string]: {
      processedImagePath?: string;
      ocrResult: any;
    };
  };
  version: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 图片文件信息
 */
interface ImageFileInfo {
  path: string;
  name: string;
  url: string; // blob url
}

/**
 * 检测是否为 Electron 环境
 */
function isElectron(): boolean {
  return typeof window !== "undefined" && (window as any).naimo !== undefined;
}

// ==================== 文件系统操作 ====================

/**
 * 选择文件夹
 */
async function selectFolder(): Promise<string | null> {
  if (!isElectron()) return null;
  const naimo = (window as any).naimo as any;
  const result = await naimo.dialog.showOpen({
    properties: ["openDirectory"],
  });
  // naimo.dialog.showOpen 返回 string[] | undefined
  if (Array.isArray(result) && result.length > 0) {
    return result[0];
  }
  return null;
}

/**
 * 根据文件扩展名获取 MIME 类型
 */
function getMimeTypeFromExt(ext: string): string {
  const extLower = ext.toLowerCase();
  if (extLower === ".jpg" || extLower === ".jpeg") {
    return "image/jpeg";
  } else if (extLower === ".png") {
    return "image/png";
  } else if (extLower === ".gif") {
    return "image/gif";
  } else if (extLower === ".webp") {
    return "image/webp";
  } else if (extLower === ".bmp") {
    return "image/bmp";
  }
  return "image/png"; // 默认
}

/**
 * 获取文件夹中所有图片文件
 */
async function getImagesInFolder(folderPath: string): Promise<ImageFileInfo[]> {
  if (!isElectron()) return [];

  try {
    const files = await fsp.readdir(folderPath);
    const imageFiles = await Promise.all(
      files
        .filter((file: string) => {
          const ext = path.extname(file).toLowerCase();
          return [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(ext);
        })
        .map(async (file: string) => {
          const fullPath = path.join(folderPath, file);
          const stats = await fsp.stat(fullPath);
          if (stats.isFile()) {
            const naimo = (window as any).naimo as any;
            // getLocalImage 返回纯 base64（无前缀），需要添加 data URL 前缀
            const base64 = await naimo.system.getLocalImage(fullPath);
            const ext = path.extname(file);
            const mimeType = getMimeTypeFromExt(ext);
            const url = `data:${mimeType};base64,${base64}`;
            return {
              path: fullPath,
              name: file,
              url,
            } as ImageFileInfo;
          }
          return null;
        })
    );

    return imageFiles.filter(Boolean) as ImageFileInfo[];
  } catch (error) {
    console.error("读取文件夹失败:", error);
    return [];
  }
}

/**
 * 读取配置文件
 */
async function readConfig(folderPath: string): Promise<ProjectConfig | null> {
  if (!isElectron()) return null;

  const configPath = path.join(folderPath, "config.json");

  try {
    const data = await fsp.readFile(configPath, "utf-8");
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      console.error("读取配置文件失败:", error);
    }
    return null;
  }
}

/**
 * 写入配置文件
 */
async function writeConfig(folderPath: string, config: ProjectConfig): Promise<boolean> {
  console.log("[writeConfig] 开始写入配置", { folderPath, configKeys: Object.keys(config.images || {}) });

  if (!isElectron()) {
    console.warn("[writeConfig] 非 Electron 环境，跳过");
    return false;
  }

  const configPath = path.join(folderPath, "config.json");
  console.log("[writeConfig] 配置文件路径:", configPath);

  try {
    const configStr = JSON.stringify(config, null, 2);
    console.log("[writeConfig] 配置内容长度:", configStr.length);
    await fsp.writeFile(configPath, configStr, "utf-8");
    console.log("[writeConfig] ✅ 配置文件写入成功:", configPath);
    return true;
  } catch (error) {
    console.error("[writeConfig] ❌ 写入配置文件失败:", error);
    return false;
  }
}

/**
 * 初始化配置
 */
function createInitialConfig(): ProjectConfig {
  return {
    images: {},
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 保存 OCR 结果到配置
 */
async function saveOcrResult(
  folderPath: string,
  imagePath: string,
  ocrResult: any
): Promise<boolean> {
  console.log("[saveOcrResult] 开始保存 OCR 结果", { folderPath, imagePath, detailsCount: ocrResult?.details?.length || 0 });

  if (!isElectron()) {
    console.warn("[saveOcrResult] 非 Electron 环境，跳过");
    return false;
  }

  let config = await readConfig(folderPath);
  if (!config) {
    console.log("[saveOcrResult] 配置文件不存在，创建新配置");
    config = createInitialConfig();
  } else {
    console.log("[saveOcrResult] 读取到现有配置，图片数量:", Object.keys(config.images || {}).length);
  }

  config.images[imagePath] = {
    ...config.images[imagePath],
    ocrResult,
  };
  config.updatedAt = new Date().toISOString();

  console.log("[saveOcrResult] 准备写入配置，图片路径:", imagePath);
  const result = await writeConfig(folderPath, config);
  console.log("[saveOcrResult]", result ? "✅ 保存成功" : "❌ 保存失败");
  return result;
}

/**
 * 获取 OCR 结果
 */
async function getOcrResult(folderPath: string, imagePath: string): Promise<any | null> {
  if (!isElectron()) return null;

  const config = await readConfig(folderPath);
  return config?.images[imagePath]?.ocrResult || null;
}

// ==================== 音频文件管理 ====================

/**
 * 获取音频文件夹路径
 */
function getAudioFolderPath(folderPath: string): string {
  return path.join(folderPath, "audio_files");
}

/**
 * 确保音频文件夹存在
 */
async function ensureAudioFolder(folderPath: string): Promise<string | null> {
  if (!isElectron()) return null;

  const audioFolder = getAudioFolderPath(folderPath);

  try {
    await fsp.mkdir(audioFolder, { recursive: true });
    return audioFolder;
  } catch (error) {
    console.error("创建音频文件夹失败:", error);
    return null;
  }
}

/**
 * 保存音频文件
 */
async function saveAudioFile(
  folderPath: string,
  detailId: string,
  audioBuffer: Buffer
): Promise<string | null> {
  console.log("[saveAudioFile] 开始保存音频文件", { folderPath, detailId, bufferSize: audioBuffer?.length || 0 });

  if (!isElectron()) {
    console.warn("[saveAudioFile] 非 Electron 环境，跳过");
    return null;
  }

  const audioFolder = await ensureAudioFolder(folderPath);
  if (!audioFolder) {
    console.error("[saveAudioFile] 无法创建音频文件夹");
    return null;
  }

  const audioFileName = `${detailId}.mp3`;
  const audioFilePath = path.join(audioFolder, audioFileName);
  console.log("[saveAudioFile] 音频文件路径:", audioFilePath);

  try {
    await fsp.writeFile(audioFilePath, audioBuffer);
    console.log("[saveAudioFile] ✅ 音频文件保存成功:", audioFilePath, "大小:", audioBuffer.length, "bytes");
    return audioFilePath;
  } catch (error) {
    console.error("[saveAudioFile] ❌ 保存音频文件失败:", error);
    return null;
  }
}

/**
 * 获取音频文件 URL（读取文件并创建 blob URL）
 */
async function getAudioUrl(audioFilePath: string): Promise<string | null> {
  if (!isElectron() || !audioFilePath) return null;

  try {
    // 读取音频文件
    const audioBuffer = await fsp.readFile(audioFilePath);
    // 转换为标准 TypedArray，避免类型不兼容
    const normalizedBuffer = new Uint8Array(audioBuffer);
    // 创建 Blob
    const blob = new Blob([normalizedBuffer], { type: "audio/mpeg" });
    // 创建 blob URL
    const url = URL.createObjectURL(blob);
    return url;
  } catch (error) {
    console.error("获取音频 URL 失败:", error);
    return null;
  }
}

/**
 * 保存音频文件信息到配置
 */
async function saveAudioFileInfo(
  folderPath: string,
  imagePath: string,
  detailId: string,
  audioFilePath: string
): Promise<boolean> {
  console.log("[saveAudioFileInfo] 开始保存音频文件信息", { folderPath, imagePath, detailId, audioFilePath });

  if (!isElectron()) {
    console.warn("[saveAudioFileInfo] 非 Electron 环境，跳过");
    return false;
  }

  let config = await readConfig(folderPath);
  if (!config) {
    console.log("[saveAudioFileInfo] 配置文件不存在，创建新配置");
    config = createInitialConfig();
  } else {
    console.log("[saveAudioFileInfo] 读取到现有配置");
  }

  if (!config.images[imagePath]) {
    console.log("[saveAudioFileInfo] 图片配置不存在，创建新配置");
    config.images[imagePath] = { ocrResult: null };
  }

  // 更新 ocrResult 中对应 detail 的 audioPath
  const ocrResult = config.images[imagePath].ocrResult;
  if (ocrResult && Array.isArray(ocrResult.details)) {
    const detail = ocrResult.details.find((d: any) => d.id === detailId);
    if (detail) {
      detail.audioPath = audioFilePath;
      console.log("[saveAudioFileInfo] 已更新 detail 的 audioPath", { detailId, audioFilePath });
    } else {
      console.warn("[saveAudioFileInfo] 未找到对应的 detail", { detailId });
    }
  } else {
    console.warn("[saveAudioFileInfo] ocrResult 不存在或格式不正确", { ocrResult });
  }

  config.updatedAt = new Date().toISOString();

  const result = await writeConfig(folderPath, config);
  console.log("[saveAudioFileInfo]", result ? "✅ 保存成功" : "❌ 保存失败");
  return result;
}

/**
 * 获取音频文件路径
 */
async function getAudioFilePath(
  folderPath: string,
  imagePath: string,
  detailId: string
): Promise<string | null> {
  if (!isElectron()) return null;

  const config = await readConfig(folderPath);
  const ocrResult = config?.images?.[imagePath]?.ocrResult;
  if (ocrResult && Array.isArray(ocrResult.details)) {
    const detail = ocrResult.details.find((d: any) => d.id === detailId);
    return detail?.audioPath || null;
  }
  return null;
}

// ==================== 音频生成 ====================

/**
 * 使用 edge-tts-universal 生成音频
 */
async function generateAudioWithEdgeTTS(
  text: string,
  options?: {
    voice?: string;
    rate?: string;
    volume?: string;
    pitch?: string;
  }
): Promise<Buffer | null> {
  if (!isElectron()) return null;

  try {
    const { Communicate } = await import("edge-tts-universal");

    const communicate = new Communicate(text, {
      voice: options?.voice || "en-US-EmmaMultilingualNeural",
      rate: options?.rate || "+0%",
      volume: options?.volume || "+0%",
      pitch: options?.pitch || "+0Hz",
    });

    const chunks: Buffer[] = [];
    for await (const chunk of communicate.stream()) {
      if (chunk.type === "audio" && chunk.data) {
        chunks.push(chunk.data);
      }
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error("音频生成失败:", error);
    return null;
  }
}

// ==================== 处理图片管理 ====================

/**
 * 获取处理图片文件夹路径
 */
function getProcessedImageFolderPath(folderPath: string): string {
  return path.join(folderPath, "processed_images");
}

/**
 * 确保处理图片文件夹存在
 */
async function ensureProcessedImageFolder(folderPath: string): Promise<string | null> {
  if (!isElectron()) return null;

  const processedImageFolder = getProcessedImageFolderPath(folderPath);

  try {
    await fsp.mkdir(processedImageFolder, { recursive: true });
    return processedImageFolder;
  } catch (error) {
    console.error("创建处理图片文件夹失败:", error);
    return null;
  }
}

/**
 * 保存处理后的图片到本地
 * @param folderPath 项目文件夹路径
 * @param imagePath 原始图片路径
 * @param imageUrl 处理后的图片 URL（可以是 HTTP URL、data URL 或 blob URL）
 * @returns 保存的图片文件路径，失败返回 null
 */
async function saveProcessedImage(
  folderPath: string,
  imagePath: string,
  imageUrl: string
): Promise<string | null> {
  console.log("[saveProcessedImage] 开始保存处理图片", { folderPath, imagePath, imageUrlType: imageUrl?.substring(0, 20) });

  if (!isElectron()) {
    console.warn("[saveProcessedImage] 非 Electron 环境，跳过");
    return null;
  }

  try {
    // 获取原始图片的文件名（不含扩展名）和扩展名
    const originalExt = path.extname(imagePath);
    const originalName = path.basename(imagePath, originalExt);

    // 处理后的图片文件名：原图片名_processed.png
    const processedFileName = `${originalName}_processed.png`;

    const processedImageFolder = await ensureProcessedImageFolder(folderPath);
    if (!processedImageFolder) {
      console.error("[saveProcessedImage] 无法创建处理图片文件夹");
      return null;
    }

    const processedImagePath = path.join(processedImageFolder, processedFileName);
    console.log("[saveProcessedImage] 处理图片保存路径:", processedImagePath);

    // 根据 URL 类型获取图片数据
    let imageBuffer: Buffer;

    if (imageUrl.startsWith("data:")) {
      // data URL: data:image/png;base64,xxx
      const base64Data = imageUrl.split(",")[1];
      imageBuffer = Buffer.from(base64Data, "base64");
    } else if (imageUrl.startsWith("blob:")) {
      // blob URL: 需要先 fetch 转换为 ArrayBuffer
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      // HTTP URL: 需要先 fetch 转换为 ArrayBuffer
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      console.error("[saveProcessedImage] 不支持的 URL 类型:", imageUrl);
      return null;
    }

    // 保存图片文件
    await fsp.writeFile(processedImagePath, imageBuffer);
    console.log("[saveProcessedImage] ✅ 处理图片保存成功:", processedImagePath, "大小:", imageBuffer.length, "bytes");

    return processedImagePath;
  } catch (error) {
    console.error("[saveProcessedImage] ❌ 保存处理图片失败:", error);
    return null;
  }
}

/**
 * 获取处理图片 URL（从本地文件路径读取并创建 blob URL 或 data URL）
 * @param processedImagePath 处理图片的文件路径
 * @returns 图片 URL，失败返回 null
 */
async function getProcessedImageUrl(folderPath: string, processedImagePath: string): Promise<string | null> {
  if (!isElectron() || !folderPath || !processedImagePath) return null;

  try {
    // 优先使用绝对路径，如果是相对路径则基于项目目录解析
    const resolvedPath = path.isAbsolute(processedImagePath)
      ? processedImagePath
      : path.join(folderPath, processedImagePath);

    // 检查文件是否存在
    await fsp.access(resolvedPath);

    // 使用 naimo API 读取本地图片（返回 base64）
    const naimo = (window as any).naimo as any;
    const base64 = await naimo.system.getLocalImage(resolvedPath);

    const ext = path.extname(resolvedPath);
    const mimeType = getMimeTypeFromExt(ext);

    // 创建 data URL
    const url = `data:${mimeType};base64,${base64}`;
    return url;
  } catch (error) {
    console.error("[getProcessedImageUrl] 获取处理图片 URL 失败:", error);
    return null;
  }
}

// ==================== 暴露插件 API ====================

const myPluginAPI = {
  // 基础功能
  getCurrentTime: () => new Date().toLocaleString("zh-CN"),
  formatText: (text: string) => text.toUpperCase(),
  fetchData: async (url: string) => {
    try {
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error("数据获取失败:", error);
      throw error;
    }
  },
  // Electron 专用功能
  isElectron,
  selectFolder,
  getImagesInFolder,
  readConfig,
  writeConfig,
  saveOcrResult,
  getOcrResult,
  generateAudioWithEdgeTTS,
  saveAudioFile,
  getAudioUrl,
  saveAudioFileInfo,
  getAudioFilePath,
  saveProcessedImage,
  getProcessedImageUrl,
};

// 通过 contextBridge 暴露 API 到渲染进程
if (typeof contextBridge !== "undefined") {
  contextBridge.exposeInMainWorld("myPluginAPI", myPluginAPI);
} else {
  // 降级方案：直接挂载到 window（非 Electron 环境或旧版本）
  (window as any).myPluginAPI = myPluginAPI;
}

// ==================== 功能处理器导出 ====================

/**
 * 导出功能处理器
 * 类型定义来自 naimo.d.ts
 */
const handlers = {
  hello: {
    onEnter: async (params: any) => {
      console.log("Hello World 功能被触发");
      console.log("参数:", params);

      // 这里可以做一些初始化工作
      // 例如：加载数据、设置状态等

      // 发送日志
      if (typeof window !== "undefined" && (window as any).naimo) {
        (window as any).naimo.log.info("插件已加载", { params });
      }
    },
  },
};

// 使用 CommonJS 导出（Electron 环境）
if (typeof module !== "undefined" && module.exports) {
  module.exports = handlers;
}

// ==================== 初始化 ====================

window.addEventListener("DOMContentLoaded", () => {
  console.log("Preload 脚本已初始化");
  console.log("当前时间:", myPluginAPI.getCurrentTime());
});

// ==================== 类型扩展 ====================

declare global {
  const customApi: typeof myPluginAPI;
}
