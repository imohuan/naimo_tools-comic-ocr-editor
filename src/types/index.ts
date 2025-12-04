// OCR 文本明细
export interface OcrTextDetail {
  // 唯一标识，用于任务管理和跨组件精确更新
  id?: string;
  text: string;
  // 翻译后的文本（默认与 text 同步，用于右侧编辑区域）
  translatedText?: string;
  // 原始识别文本（用于折叠展示原文）
  originText?: string;
  // 人物配音角色标识（微软 TTS 角色）
  voiceRole?: string;
  // 文本转语音生成状态
  audioLoading?: boolean;
  audioUrl?: string | null;
  audioError?: string | null;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  textColor?: {
    fg: [number];
    bg: [number];
  };
  language?: string;
  background?: string | null;
}

// API 返回的原始格式
export interface OcrApiResponse {
  translations?: Array<{
    text: string;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    angle?: number;
    prob?: number;
    is_bulleted_list?: boolean;
    text_color?: {
      fg: [number];
      bg: [number];
    };
    background?: string | null;
    language?: string;
  }>;
  debug_folder?: string;
  details?: OcrTextDetail[];
  img?: null;
  detection_size?: number;
}

export interface OcrTextResult {
  details: OcrTextDetail[];
  img: null;
  detection_size: number;
}

export interface ImageItem {
  // 每张图片的唯一标识，用于异步 OCR 结果与图片一一对应
  id: string;
  file: File;
  url: string;
  ocrResult: OcrTextResult | null;
  ocrLoading: boolean;
  // 处理好的图片 URL（如 final.png），如果存在则优先使用此图片替换原图
  processedImageUrl?: string | null;
}

export interface OcrConfig {
  detector: {
    detector: string;
    detection_size: number;
    box_threshold: number;
    unclip_ratio: number;
  };
  render: {
    direction: string;
  };
  translator: {
    translator: string;
    target_lang: string;
  };
  inpainter: {
    inpainter: string;
    inpainting_size: number;
  };
  mask_dilation_offset: number;
}
