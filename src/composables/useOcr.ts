import { ref } from "vue";
import { getOcrConfig } from "../utils/config";
import type { OcrTextResult } from "../types";

const BASE_URI = "http://127.0.0.1:5003/";

export function useOcr() {
  const isLoading = ref(false);

  const handleOcr = async (file: File): Promise<OcrTextResult> => {
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

                // 转换 API 返回的数据格式：translations -> details
                if (
                  jsonData.translations &&
                  Array.isArray(jsonData.translations)
                ) {
                  const result: OcrTextResult = {
                    details: jsonData.translations.map((trans: any) => {
                      // 优先使用后端提供的原文/译文字段，如果没有则退化为同一字段
                      const translatedText = trans.text || "";
                      const originText =
                        trans.origin_text || trans.source || translatedText;

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
                  return result;
                }

                // 如果已经是 details 格式，直接返回
                if (jsonData.details && Array.isArray(jsonData.details)) {
                  return jsonData as OcrTextResult;
                }

                // 如果都不匹配，返回空结果
                console.warn("OCR结果格式不正确，无法解析", jsonData);
                return {
                  details: [],
                  img: null,
                  detection_size: jsonData.detection_size || 1536,
                };
              } catch (error) {
                console.error("解析JSON失败:", error);
              }
            }

            buffer = buffer.slice(totalSize);
          }
        }
      }

      throw new Error("未收到OCR结果");
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    handleOcr,
  };
}
