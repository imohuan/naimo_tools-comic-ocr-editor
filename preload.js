"use strict";
const electron = require("electron");
const fsp = require("fs/promises");
const path = require("path");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const fsp__namespace = /* @__PURE__ */ _interopNamespaceDefault(fsp);
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
function isElectron() {
  return typeof window !== "undefined" && window.naimo !== void 0;
}
function toRelativePath(folderPath, targetPath) {
  if (!targetPath) return "";
  if (!path__namespace.isAbsolute(targetPath)) {
    return targetPath.replace(/^[\\/]+/, "");
  }
  const relative = path__namespace.relative(folderPath, targetPath);
  return relative || path__namespace.basename(targetPath);
}
function toAbsolutePath(folderPath, targetPath) {
  if (!targetPath) return "";
  return path__namespace.isAbsolute(targetPath) ? targetPath : path__namespace.join(folderPath, targetPath);
}
async function selectFolder() {
  if (!isElectron()) return null;
  const naimo = window.naimo;
  const result = await naimo.dialog.showOpen({
    properties: ["openDirectory"]
  });
  if (Array.isArray(result) && result.length > 0) {
    return result[0];
  }
  return null;
}
function getMimeTypeFromExt(ext) {
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
  return "image/png";
}
async function getImagesInFolder(folderPath) {
  if (!isElectron()) return [];
  try {
    const files = await fsp__namespace.readdir(folderPath);
    const imageFiles = await Promise.all(
      files.filter((file) => {
        const ext = path__namespace.extname(file).toLowerCase();
        return [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(ext);
      }).map(async (file) => {
        const fullPath = path__namespace.join(folderPath, file);
        const stats = await fsp__namespace.stat(fullPath);
        if (stats.isFile()) {
          return {
            path: fullPath,
            name: file,
            url: null
          };
        }
        return null;
      })
    );
    return imageFiles.filter(Boolean);
  } catch (error) {
    console.error("读取文件夹失败:", error);
    return [];
  }
}
async function readConfig(folderPath) {
  if (!isElectron()) return null;
  const configPath = path__namespace.join(folderPath, "config.json");
  try {
    const data = await fsp__namespace.readFile(configPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("读取配置文件失败:", error);
    }
    return null;
  }
}
async function writeConfig(folderPath, config) {
  console.log("[writeConfig] 开始写入配置", { folderPath, configKeys: Object.keys(config.images || {}) });
  if (!isElectron()) {
    console.warn("[writeConfig] 非 Electron 环境，跳过");
    return false;
  }
  const configPath = path__namespace.join(folderPath, "config.json");
  console.log("[writeConfig] 配置文件路径:", configPath);
  try {
    const configStr = JSON.stringify(config, null, 2);
    console.log("[writeConfig] 配置内容长度:", configStr.length);
    await fsp__namespace.writeFile(configPath, configStr, "utf-8");
    console.log("[writeConfig] ✅ 配置文件写入成功:", configPath);
    return true;
  } catch (error) {
    console.error("[writeConfig] ❌ 写入配置文件失败:", error);
    return false;
  }
}
function createInitialConfig() {
  return {
    images: {},
    version: "1.0.0",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function saveOcrResult(folderPath, imagePath, ocrResult) {
  const relativeImagePath = toRelativePath(folderPath, imagePath);
  console.log("[saveOcrResult] 开始保存 OCR 结果", { folderPath, imagePath: relativeImagePath, detailsCount: ocrResult?.details?.length || 0 });
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
  config.images[relativeImagePath] = {
    ...config.images[relativeImagePath],
    ocrResult
  };
  config.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  console.log("[saveOcrResult] 准备写入配置，图片路径:", relativeImagePath);
  const result = await writeConfig(folderPath, config);
  console.log("[saveOcrResult]", result ? "✅ 保存成功" : "❌ 保存失败");
  return result;
}
async function getOcrResult(folderPath, imagePath) {
  if (!isElectron()) return null;
  const config = await readConfig(folderPath);
  const relativeImagePath = toRelativePath(folderPath, imagePath);
  return config?.images[relativeImagePath]?.ocrResult || null;
}
function getAudioFolderPath(folderPath) {
  return path__namespace.join(folderPath, "audio_files");
}
async function ensureAudioFolder(folderPath) {
  if (!isElectron()) return null;
  const audioFolder = getAudioFolderPath(folderPath);
  try {
    await fsp__namespace.mkdir(audioFolder, { recursive: true });
    return audioFolder;
  } catch (error) {
    console.error("创建音频文件夹失败:", error);
    return null;
  }
}
async function saveAudioFile(folderPath, detailId, audioBuffer) {
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
  const audioFilePath = path__namespace.join(audioFolder, audioFileName);
  console.log("[saveAudioFile] 音频文件路径:", audioFilePath);
  try {
    await fsp__namespace.writeFile(audioFilePath, audioBuffer);
    console.log("[saveAudioFile] ✅ 音频文件保存成功:", audioFilePath, "大小:", audioBuffer.length, "bytes");
    return toRelativePath(folderPath, audioFilePath);
  } catch (error) {
    console.error("[saveAudioFile] ❌ 保存音频文件失败:", error);
    return null;
  }
}
async function getAudioUrl(folderPath, audioFilePath) {
  if (!isElectron() || !audioFilePath || !folderPath) return null;
  try {
    const resolvedPath = toAbsolutePath(folderPath, audioFilePath);
    const audioBuffer = await fsp__namespace.readFile(resolvedPath);
    const normalizedBuffer = new Uint8Array(audioBuffer);
    const blob = new Blob([normalizedBuffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    return url;
  } catch (error) {
    console.error("获取音频 URL 失败:", error);
    return null;
  }
}
async function saveAudioFileInfo(folderPath, imagePath, detailId, audioFilePath) {
  const relativeImagePath = toRelativePath(folderPath, imagePath);
  const normalizedAudioPath = toRelativePath(folderPath, audioFilePath);
  console.log("[saveAudioFileInfo] 开始保存音频文件信息", { folderPath, imagePath: relativeImagePath, detailId, audioFilePath: normalizedAudioPath });
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
  if (!config.images[relativeImagePath]) {
    console.log("[saveAudioFileInfo] 图片配置不存在，创建新配置");
    config.images[relativeImagePath] = { ocrResult: null };
  }
  const ocrResult = config.images[relativeImagePath].ocrResult;
  if (ocrResult && Array.isArray(ocrResult.details)) {
    const detail = ocrResult.details.find((d) => d.id === detailId);
    if (detail) {
      detail.audioPath = normalizedAudioPath;
      console.log("[saveAudioFileInfo] 已更新 detail 的 audioPath", { detailId, audioFilePath: normalizedAudioPath });
    } else {
      console.warn("[saveAudioFileInfo] 未找到对应的 detail", { detailId });
    }
  } else {
    console.warn("[saveAudioFileInfo] ocrResult 不存在或格式不正确", { ocrResult });
  }
  config.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const result = await writeConfig(folderPath, config);
  console.log("[saveAudioFileInfo]", result ? "✅ 保存成功" : "❌ 保存失败");
  return result;
}
async function getAudioFilePath(folderPath, imagePath, detailId) {
  if (!isElectron()) return null;
  const config = await readConfig(folderPath);
  const relativeImagePath = toRelativePath(folderPath, imagePath);
  const ocrResult = config?.images?.[relativeImagePath]?.ocrResult;
  if (ocrResult && Array.isArray(ocrResult.details)) {
    const detail = ocrResult.details.find((d) => d.id === detailId);
    return detail?.audioPath || null;
  }
  return null;
}
async function generateAudioWithEdgeTTS(text, options) {
  if (!isElectron()) return null;
  try {
    const { Communicate } = await Promise.resolve().then(() => browser);
    const communicate = new Communicate(text, {
      voice: options?.voice || "en-US-EmmaMultilingualNeural",
      rate: options?.rate || "+0%",
      volume: options?.volume || "+0%",
      pitch: options?.pitch || "+0Hz"
    });
    const chunks = [];
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
function getProcessedImageFolderPath(folderPath) {
  return path__namespace.join(folderPath, "processed_images");
}
async function ensureProcessedImageFolder(folderPath) {
  if (!isElectron()) return null;
  const processedImageFolder = getProcessedImageFolderPath(folderPath);
  try {
    await fsp__namespace.mkdir(processedImageFolder, { recursive: true });
    return processedImageFolder;
  } catch (error) {
    console.error("创建处理图片文件夹失败:", error);
    return null;
  }
}
async function saveProcessedImage(folderPath, imagePath, imageUrl) {
  console.log("[saveProcessedImage] 开始保存处理图片", { folderPath, imagePath, imageUrlType: imageUrl?.substring(0, 20) });
  if (!isElectron()) {
    console.warn("[saveProcessedImage] 非 Electron 环境，跳过");
    return null;
  }
  try {
    const originalExt = path__namespace.extname(imagePath);
    const originalName = path__namespace.basename(imagePath, originalExt);
    const processedFileName = `${originalName}_processed.png`;
    const processedImageFolder = await ensureProcessedImageFolder(folderPath);
    if (!processedImageFolder) {
      console.error("[saveProcessedImage] 无法创建处理图片文件夹");
      return null;
    }
    const processedImagePath = path__namespace.join(processedImageFolder, processedFileName);
    console.log("[saveProcessedImage] 处理图片保存路径:", processedImagePath);
    let imageBuffer;
    if (imageUrl.startsWith("data:")) {
      const base64Data = imageUrl.split(",")[1];
      imageBuffer = Buffer.from(base64Data, "base64");
    } else if (imageUrl.startsWith("blob:")) {
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      console.error("[saveProcessedImage] 不支持的 URL 类型:", imageUrl);
      return null;
    }
    await fsp__namespace.writeFile(processedImagePath, imageBuffer);
    console.log("[saveProcessedImage] ✅ 处理图片保存成功:", processedImagePath, "大小:", imageBuffer.length, "bytes");
    return toRelativePath(folderPath, processedImagePath);
  } catch (error) {
    console.error("[saveProcessedImage] ❌ 保存处理图片失败:", error);
    return null;
  }
}
async function getProcessedImageUrl(folderPath, processedImagePath) {
  if (!isElectron() || !folderPath || !processedImagePath) return null;
  try {
    const resolvedPath = path__namespace.isAbsolute(processedImagePath) ? processedImagePath : path__namespace.join(folderPath, processedImagePath);
    await fsp__namespace.access(resolvedPath);
    const naimo = window.naimo;
    const base64 = await naimo.system.getLocalImage(resolvedPath);
    const ext = path__namespace.extname(resolvedPath);
    const mimeType = getMimeTypeFromExt(ext);
    const url = `data:${mimeType};base64,${base64}`;
    return url;
  } catch (error) {
    console.error("[getProcessedImageUrl] 获取处理图片 URL 失败:", error);
    return null;
  }
}
async function getImageUrl(imagePath) {
  if (!isElectron() || !imagePath) return null;
  try {
    const naimo = window.naimo;
    const base64 = await naimo.system.getLocalImage(imagePath);
    const ext = path__namespace.extname(imagePath);
    const mimeType = getMimeTypeFromExt(ext);
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error("[getImageUrl] 获取图片失败:", error);
    return null;
  }
}
const myPluginAPI = {
  // 基础功能
  getCurrentTime: () => (/* @__PURE__ */ new Date()).toLocaleString("zh-CN"),
  formatText: (text) => text.toUpperCase(),
  fetchData: async (url) => {
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
  getImageUrl
};
if (typeof electron.contextBridge !== "undefined") {
  electron.contextBridge.exposeInMainWorld("myPluginAPI", myPluginAPI);
} else {
  window.myPluginAPI = myPluginAPI;
}
const handlers = {
  hello: {
    onEnter: async (params) => {
      console.log("Hello World 功能被触发");
      console.log("参数:", params);
      if (typeof window !== "undefined" && window.naimo) {
        window.naimo.log.info("插件已加载", { params });
      }
    }
  }
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = handlers;
}
window.addEventListener("DOMContentLoaded", () => {
  console.log("Preload 脚本已初始化");
  console.log("当前时间:", myPluginAPI.getCurrentTime());
});
function browserConnectId() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  array[6] = array[6] & 15 | 64;
  array[8] = array[8] & 63 | 128;
  const hex = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  return uuid.replace(/-/g, "");
}
function browserEscape(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function browserUnescape(text) {
  return text.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function browserRemoveIncompatibleCharacters(text) {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
}
function browserDateToString() {
  return (/* @__PURE__ */ new Date()).toUTCString().replace("GMT", "GMT+0000 (Coordinated Universal Time)");
}
function browserMkssml(voice, rate, volume, pitch, escapedText) {
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>${escapedText}</prosody></voice></speak>`;
}
function browserSsmlHeadersPlusData(requestId, timestamp, ssml) {
  return `X-RequestId:${requestId}\r
Content-Type:application/ssml+xml\r
X-Timestamp:${timestamp}Z\r
Path:ssml\r
\r
${ssml}`;
}
var EdgeTTSException = class extends Error {
  constructor(message) {
    super(message);
    this.name = "EdgeTTSException";
  }
};
var SkewAdjustmentError = class extends EdgeTTSException {
  constructor(message) {
    super(message);
    this.name = "SkewAdjustmentError";
  }
};
var UnknownResponse = class extends EdgeTTSException {
  constructor(message) {
    super(message);
    this.name = "UnknownResponse";
  }
};
var UnexpectedResponse = class extends EdgeTTSException {
  constructor(message) {
    super(message);
    this.name = "UnexpectedResponse";
  }
};
var NoAudioReceived = class extends EdgeTTSException {
  constructor(message) {
    super(message);
    this.name = "NoAudioReceived";
  }
};
var WebSocketError = class extends EdgeTTSException {
  constructor(message) {
    super(message);
    this.name = "WebSocketError";
  }
};
var ValueError = class extends EdgeTTSException {
  constructor(message) {
    super(message);
    this.name = "ValueError";
  }
};
var TTSConfig = class _TTSConfig {
  /**
   * Creates a new TTSConfig instance with the specified parameters.
   * 
   * @param options - Configuration options
   * @param options.voice - Voice name (supports both short and full formats)
   * @param options.rate - Speech rate adjustment (default: "+0%")
   * @param options.volume - Volume adjustment (default: "+0%") 
   * @param options.pitch - Pitch adjustment (default: "+0Hz")
   * @throws {ValueError} If any parameter has an invalid format
   */
  constructor({
    voice,
    rate = "+0%",
    volume = "+0%",
    pitch = "+0Hz"
  }) {
    this.voice = voice;
    this.rate = rate;
    this.volume = volume;
    this.pitch = pitch;
    this.validate();
  }
  validate() {
    const match = /^([a-z]{2,})-([A-Z]{2,})-(.+Neural)$/.exec(this.voice);
    if (match) {
      const [, lang] = match;
      let [, , region, name] = match;
      if (name.includes("-")) {
        const parts = name.split("-");
        region += `-${parts[0]}`;
        name = parts[1];
      }
      this.voice = `Microsoft Server Speech Text to Speech Voice (${lang}-${region}, ${name})`;
    }
    _TTSConfig.validateStringParam(
      "voice",
      this.voice,
      /^Microsoft Server Speech Text to Speech Voice \(.+,.+\)$/
    );
    _TTSConfig.validateStringParam("rate", this.rate, /^[+-]\d+%$/);
    _TTSConfig.validateStringParam("volume", this.volume, /^[+-]\d+%$/);
    _TTSConfig.validateStringParam("pitch", this.pitch, /^[+-]\d+Hz$/);
  }
  static validateStringParam(paramName, paramValue, pattern) {
    if (typeof paramValue !== "string") {
      throw new TypeError(`${paramName} must be a string`);
    }
    if (!pattern.test(paramValue)) {
      throw new ValueError(`Invalid ${paramName} '${paramValue}'.`);
    }
  }
};
var BASE_URL = "speech.platform.bing.com/consumer/speech/synthesize/readaloud";
var TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
var WSS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
var DEFAULT_VOICE = "en-US-EmmaMultilingualNeural";
var CHROMIUM_FULL_VERSION = "130.0.2849.68";
CHROMIUM_FULL_VERSION.split(".")[0];
var SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
var WIN_EPOCH = 11644473600;
var S_TO_NS = 1e9;
var _BrowserDRM = class _BrowserDRM2 {
  static adjClockSkewSeconds(skewSeconds) {
    _BrowserDRM2.clockSkewSeconds += skewSeconds;
  }
  static getUnixTimestamp() {
    return Date.now() / 1e3 + _BrowserDRM2.clockSkewSeconds;
  }
  static parseRfc2616Date(date) {
    try {
      return new Date(date).getTime() / 1e3;
    } catch (e) {
      return null;
    }
  }
  static handleClientResponseError(response) {
    if (!response.headers) {
      throw new SkewAdjustmentError("No headers in response.");
    }
    const serverDate = response.headers["date"] || response.headers["Date"];
    if (!serverDate) {
      throw new SkewAdjustmentError("No server date in headers.");
    }
    const serverDateParsed = _BrowserDRM2.parseRfc2616Date(serverDate);
    if (serverDateParsed === null) {
      throw new SkewAdjustmentError(`Failed to parse server date: ${serverDate}`);
    }
    const clientDate = _BrowserDRM2.getUnixTimestamp();
    _BrowserDRM2.adjClockSkewSeconds(serverDateParsed - clientDate);
  }
  static async generateSecMsGec() {
    let ticks = _BrowserDRM2.getUnixTimestamp();
    ticks += WIN_EPOCH;
    ticks -= ticks % 300;
    ticks *= S_TO_NS / 100;
    const strToHash = `${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(strToHash);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  }
};
_BrowserDRM.clockSkewSeconds = 0;
var BrowserDRM = _BrowserDRM;
var BrowserBuffer = class {
  static from(input, encoding) {
    if (typeof input === "string") {
      return new TextEncoder().encode(input);
    } else if (input instanceof ArrayBuffer) {
      return new Uint8Array(input);
    } else if (input instanceof Uint8Array) {
      return input;
    }
    throw new Error("Unsupported input type for BrowserBuffer.from");
  }
  static concat(arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }
};
function browserGetHeadersAndDataFromText(message) {
  const messageString = new TextDecoder().decode(message);
  const headerEndIndex = messageString.indexOf("\r\n\r\n");
  const headers = {};
  if (headerEndIndex !== -1) {
    const headerString = messageString.substring(0, headerEndIndex);
    const headerLines = headerString.split("\r\n");
    for (const line of headerLines) {
      const [key, value] = line.split(":", 2);
      if (key && value) {
        headers[key] = value.trim();
      }
    }
  }
  const headerByteLength = new TextEncoder().encode(messageString.substring(0, headerEndIndex + 4)).length;
  return [headers, message.slice(headerByteLength)];
}
function browserGetHeadersAndDataFromBinary(message) {
  if (message.length < 2) {
    throw new Error("Message too short to contain header length");
  }
  const headerLength = message[0] << 8 | message[1];
  const headers = {};
  if (headerLength > 0 && headerLength + 2 <= message.length) {
    const headerBytes = message.slice(2, headerLength + 2);
    const headerString = new TextDecoder().decode(headerBytes);
    const headerLines = headerString.split("\r\n");
    for (const line of headerLines) {
      const [key, value] = line.split(":", 2);
      if (key && value) {
        headers[key] = value.trim();
      }
    }
  }
  return [headers, message.slice(headerLength + 2)];
}
function browserSplitTextByByteLength(text, byteLength) {
  return (function* () {
    let buffer = new TextEncoder().encode(text);
    while (buffer.length > byteLength) {
      let splitAt = byteLength;
      const slice = buffer.slice(0, byteLength);
      const sliceText = new TextDecoder().decode(slice);
      const lastNewline = sliceText.lastIndexOf("\n");
      const lastSpace = sliceText.lastIndexOf(" ");
      if (lastNewline > 0) {
        splitAt = new TextEncoder().encode(sliceText.substring(0, lastNewline)).length;
      } else if (lastSpace > 0) {
        splitAt = new TextEncoder().encode(sliceText.substring(0, lastSpace)).length;
      }
      const chunk = buffer.slice(0, splitAt);
      const chunkText = new TextDecoder().decode(chunk).trim();
      if (chunkText) {
        yield new TextEncoder().encode(chunkText);
      }
      buffer = buffer.slice(splitAt);
    }
    const remainingText = new TextDecoder().decode(buffer).trim();
    if (remainingText) {
      yield new TextEncoder().encode(remainingText);
    }
  })();
}
var BrowserCommunicate = class {
  /**
   * Creates a new browser Communicate instance for text-to-speech synthesis.
   * 
   * @param text - The text to synthesize
   * @param options - Configuration options for synthesis
   */
  constructor(text, options = {}) {
    this.state = {
      partialText: BrowserBuffer.from(""),
      offsetCompensation: 0,
      lastDurationOffset: 0,
      streamWasCalled: false
    };
    this.ttsConfig = new TTSConfig({
      voice: options.voice || DEFAULT_VOICE,
      rate: options.rate,
      volume: options.volume,
      pitch: options.pitch
    });
    if (typeof text !== "string") {
      throw new TypeError("text must be a string");
    }
    this.texts = browserSplitTextByByteLength(
      browserEscape(browserRemoveIncompatibleCharacters(text)),
      // browserCalcMaxMesgSize(this.ttsConfig.voice, this.ttsConfig.rate, this.ttsConfig.volume, this.ttsConfig.pitch),
      4096
    );
    this.connectionTimeout = options.connectionTimeout;
  }
  parseMetadata(data) {
    const metadata = JSON.parse(new TextDecoder().decode(data));
    for (const metaObj of metadata["Metadata"]) {
      const metaType = metaObj["Type"];
      if (metaType === "WordBoundary") {
        const currentOffset = metaObj["Data"]["Offset"] + this.state.offsetCompensation;
        const currentDuration = metaObj["Data"]["Duration"];
        return {
          type: metaType,
          offset: currentOffset,
          duration: currentDuration,
          text: browserUnescape(metaObj["Data"]["text"]["Text"])
        };
      }
      if (metaType === "SessionEnd") {
        continue;
      }
      throw new UnknownResponse(`Unknown metadata type: ${metaType}`);
    }
    throw new UnexpectedResponse("No WordBoundary metadata found");
  }
  async *_stream() {
    const url = `${WSS_URL}&Sec-MS-GEC=${await BrowserDRM.generateSecMsGec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${browserConnectId()}`;
    const websocket = new WebSocket(url);
    const messageQueue = [];
    let resolveMessage = null;
    let timeoutId;
    if (this.connectionTimeout) {
      timeoutId = window.setTimeout(() => {
        websocket.close();
        messageQueue.push(new WebSocketError("Connection timeout"));
        if (resolveMessage) resolveMessage();
      }, this.connectionTimeout);
    }
    websocket.onmessage = (event) => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = void 0;
      }
      const data = event.data;
      if (typeof data === "string") {
        const [headers, parsedData] = browserGetHeadersAndDataFromText(BrowserBuffer.from(data));
        const path2 = headers["Path"];
        if (path2 === "audio.metadata") {
          try {
            const parsedMetadata = this.parseMetadata(parsedData);
            this.state.lastDurationOffset = parsedMetadata.offset + parsedMetadata.duration;
            messageQueue.push(parsedMetadata);
          } catch (e) {
            messageQueue.push(e);
          }
        } else if (path2 === "turn.end") {
          this.state.offsetCompensation = this.state.lastDurationOffset;
          websocket.close();
        } else if (path2 !== "response" && path2 !== "turn.start") {
          messageQueue.push(new UnknownResponse(`Unknown path received: ${path2}`));
        }
      } else if (data instanceof ArrayBuffer) {
        const bufferData = BrowserBuffer.from(data);
        if (bufferData.length < 2) {
          messageQueue.push(new UnexpectedResponse("We received a binary message, but it is missing the header length."));
        } else {
          const [headers, audioData] = browserGetHeadersAndDataFromBinary(bufferData);
          if (headers["Path"] !== "audio") {
            messageQueue.push(new UnexpectedResponse("Received binary message, but the path is not audio."));
          } else {
            const contentType = headers["Content-Type"];
            if (contentType !== "audio/mpeg") {
              if (audioData.length > 0) {
                messageQueue.push(new UnexpectedResponse("Received binary message, but with an unexpected Content-Type."));
              }
            } else if (audioData.length === 0) {
              messageQueue.push(new UnexpectedResponse("Received binary message, but it is missing the audio data."));
            } else {
              messageQueue.push({ type: "audio", data: audioData });
            }
          }
        }
      } else if (data instanceof Blob) {
        data.arrayBuffer().then((arrayBuffer) => {
          const bufferData = BrowserBuffer.from(arrayBuffer);
          if (bufferData.length < 2) {
            messageQueue.push(new UnexpectedResponse("We received a binary message, but it is missing the header length."));
          } else {
            const [headers, audioData] = browserGetHeadersAndDataFromBinary(bufferData);
            if (headers["Path"] !== "audio") {
              messageQueue.push(new UnexpectedResponse("Received binary message, but the path is not audio."));
            } else {
              const contentType = headers["Content-Type"];
              if (contentType !== "audio/mpeg") {
                if (audioData.length > 0) {
                  messageQueue.push(new UnexpectedResponse("Received binary message, but with an unexpected Content-Type."));
                }
              } else if (audioData.length === 0) {
                messageQueue.push(new UnexpectedResponse("Received binary message, but it is missing the audio data."));
              } else {
                messageQueue.push({ type: "audio", data: audioData });
              }
            }
          }
          if (resolveMessage) resolveMessage();
        });
      }
      if (resolveMessage) resolveMessage();
    };
    websocket.onerror = (error) => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = void 0;
      }
      messageQueue.push(new WebSocketError("WebSocket error occurred"));
      if (resolveMessage) resolveMessage();
    };
    websocket.onclose = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = void 0;
      }
      messageQueue.push("close");
      if (resolveMessage) resolveMessage();
    };
    await new Promise((resolve, reject) => {
      websocket.onopen = () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          timeoutId = void 0;
        }
        resolve();
      };
      if (this.connectionTimeout) {
        setTimeout(() => {
          if (websocket.readyState === WebSocket.CONNECTING) {
            websocket.close();
            reject(new WebSocketError("Connection timeout"));
          }
        }, this.connectionTimeout);
      }
    });
    websocket.send(
      `X-Timestamp:${browserDateToString()}\r
Content-Type:application/json; charset=utf-8\r
Path:speech.config\r
\r
{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r
`
    );
    websocket.send(
      browserSsmlHeadersPlusData(
        browserConnectId(),
        browserDateToString(),
        browserMkssml(this.ttsConfig.voice, this.ttsConfig.rate, this.ttsConfig.volume, this.ttsConfig.pitch, new TextDecoder().decode(this.state.partialText))
      )
    );
    let audioWasReceived = false;
    while (true) {
      if (messageQueue.length > 0) {
        const message = messageQueue.shift();
        if (message === "close") {
          if (!audioWasReceived) {
            throw new NoAudioReceived("No audio was received.");
          }
          break;
        } else if (message instanceof Error) {
          throw message;
        } else {
          if (message.type === "audio") audioWasReceived = true;
          yield message;
        }
      } else {
        await new Promise((resolve) => {
          resolveMessage = resolve;
          setTimeout(resolve, 50);
        });
      }
    }
  }
  /**
   * Streams text-to-speech synthesis results using native browser WebSocket.
   * Uses only browser-native APIs, avoiding Node.js dependencies.
   * 
   * @yields BrowserTTSChunk - Audio data or word boundary information
   * @throws {Error} If called more than once
   * @throws {NoAudioReceived} If no audio data is received
   * @throws {WebSocketError} If WebSocket connection fails
   */
  async *stream() {
    if (this.state.streamWasCalled) {
      throw new Error("stream can only be called once.");
    }
    this.state.streamWasCalled = true;
    for (const partialText of this.texts) {
      this.state.partialText = partialText;
      for await (const message of this._stream()) {
        yield message;
      }
    }
  }
};
const browser = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Communicate: BrowserCommunicate,
  DRM: BrowserDRM,
  EdgeTTSException,
  NoAudioReceived,
  SkewAdjustmentError,
  UnexpectedResponse,
  UnknownResponse,
  ValueError,
  WebSocketError
}, Symbol.toStringTag, { value: "Module" }));
