import { ref } from "vue";
import { getOcrConfig } from "../utils/config";
import type { OcrTextResult } from "../types";

const BASE_URI = "http://127.0.0.1:5003/";

export function useOcr() {
  const isLoading = ref(false);

  const handleOcr = async (
    file: File,
    onProcessedImage?: (imageUrl: string) => void
  ): Promise<OcrTextResult> => {
    isLoading.value = true;
    try {
      const config = await getOcrConfig();
      const formData = new FormData();
      formData.append("image", file);
      formData.append("config", JSON.stringify(config));

      const response = await fetch(
        `${BASE_URI}translate/with-form/json/stream`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 解析流式响应
      const reader = response.body.getReader();
      let buffer = new Uint8Array();
      let currentFolder: string | null = null;
      let ocrResult: OcrTextResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;

          // 解析消息格式：1字节状态码 + 4字节长度 + 数据
          while (buffer.length >= 5) {
            const dataSize = new DataView(buffer.buffer).getUint32(1, false);
            const totalSize = 5 + dataSize;
            if (buffer.length < totalSize) break;

            const statusCode = buffer[0];
            const decoder = new TextDecoder("utf-8");
            const data = buffer.slice(5, totalSize);

            if (statusCode === 0) {
              // JSON数据
              try {
                const jsonText = decoder.decode(data);
                const jsonData = JSON.parse(jsonText);

                console.log({ jsonData });

                // 转换 API 返回的数据格式：translations -> details
                if (
                  jsonData.translations &&
                  Array.isArray(jsonData.translations)
                ) {
                  const targetLang = config?.translator?.target_lang;

                  const pickText = (
                    field: unknown,
                    preferredLang?: string,
                    excludedLang?: string
                  ): string => {
                    if (!field) return "";
                    if (typeof field === "string") return field;
                    if (typeof field === "object") {
                      const obj = field as Record<string, unknown>;
                      if (
                        preferredLang &&
                        typeof obj[preferredLang] === "string"
                      ) {
                        return obj[preferredLang] as string;
                      }
                      const first = Object.entries(obj).find(
                        ([lang, val]) =>
                          lang.toUpperCase?.() !== excludedLang &&
                          typeof val === "string"
                      );
                      if (first && typeof first[1] === "string") {
                        return first[1];
                      }
                      const anyVal = Object.values(obj).find(
                        (val) => typeof val === "string"
                      );
                      if (typeof anyVal === "string") return anyVal;
                      return JSON.stringify(obj);
                    }
                    return "";
                  };

                  ocrResult = {
                    details: jsonData.translations.map((trans: any) => {
                      let translatedText = pickText(trans.text, targetLang);
                      // 删除 translatedText 所有标点符号，只保留英文中文数字，其他的内容替换成空格，并且如果出现多个空格的话统一替换成一个空格
                      translatedText = translatedText.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ");

                      const originFromText = pickText(
                        trans.text,
                        undefined,
                        targetLang
                      );
                      const originText =
                        trans.origin_text ||
                        trans.source ||
                        originFromText ||
                        translatedText;

                      return {
                        text: translatedText,
                        translatedText,
                        originText,
                        minX: trans.minX,
                        minY: trans.minY,
                        maxX: trans.maxX,
                        maxY: trans.maxY,
                        textColor: trans.text_color
                          ? {
                              fg: trans.text_color.fg || [0],
                              bg: trans.text_color.bg || [255],
                            }
                          : undefined,
                        language: trans.language,
                        background: trans.background || null,
                      };
                    }),
                    img: null,
                    detection_size: jsonData.detection_size || 1536,
                  };

                  // 如果 JSON 数据中包含 debug_folder，设置文件夹
                  if (jsonData.debug_folder) {
                    currentFolder = jsonData.debug_folder;
                    const processedImageUrl = `${BASE_URI}result/${currentFolder}/final.png`;
                    if (onProcessedImage) {
                      onProcessedImage(processedImageUrl);
                    }
                  }
                } else if (
                  jsonData.details &&
                  Array.isArray(jsonData.details)
                ) {
                  // 如果已经是 details 格式，直接使用
                  ocrResult = jsonData as OcrTextResult;
                } else {
                  // 如果都不匹配，返回空结果
                  console.warn("OCR结果格式不正确，无法解析", jsonData);
                  ocrResult = {
                    details: [],
                    img: null,
                    detection_size: jsonData.detection_size || 1536,
                  };
                }
              } catch (error) {
                console.error("解析JSON失败:", error);
              }
            } else if (statusCode === 1) {
              // 状态文本
              const newStatus = decoder.decode(data);
              console.log("状态更新:", newStatus);

              // rendering_folder:xxx / final_ready:xxx / 或普通状态文本
              if (newStatus.startsWith("rendering_folder:")) {
                currentFolder = newStatus.substring(17);
              } else if (newStatus.startsWith("final_ready:")) {
                const readyFolder = newStatus.substring(12);
                if (!currentFolder) {
                  currentFolder = readyFolder;
                }
                // final.png 已就绪，通知处理好的图片 URL
                const processedImageUrl = `${BASE_URI}result/${currentFolder}/final.png`;
                if (onProcessedImage) {
                  onProcessedImage(processedImageUrl);
                }
              }
            } else if (statusCode === 2) {
              // 错误信息
              const errText = decoder.decode(data);
              console.error("OCR 错误:", errText);
              throw new Error(errText);
            }
            // statusCode === 3 和 4 是队列相关，可以忽略

            buffer = buffer.slice(totalSize);
          }
        }
      }

      if (!ocrResult) {
        throw new Error("未收到OCR结果");
      }

      return ocrResult;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    handleOcr,
  };
}
