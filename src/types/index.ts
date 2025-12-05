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
  audioUrl?: string | null;
  // 音频文件路径（项目模式下的本地文件路径）
  audioPath?: string;
  // 生成后的音频时长（秒），用于懒加载时提前获知时间轴
  audioDuration?: number | null;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
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
  file?: File; // Electron 项目模式下可能为 undefined
  url?: string | null;
  // Electron 项目模式专用字段
  path?: string; // 图片文件路径（仅在 Electron 项目模式下存在）
  name?: string; // 图片文件名（仅在 Electron 项目模式下存在）
  ocrResult: OcrTextResult | null;
  ocrLoading: boolean;
  // 处理好的图片 URL（如 final.png），如果存在则优先使用此图片替换原图
  processedImageUrl?: string | null;
  // 处理图片的本地路径（项目模式）
  processedImagePath?: string | null;
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
  // 音频并发数量（任务系统使用），可选字段兼容旧配置
  audio_concurrency?: number;
}
