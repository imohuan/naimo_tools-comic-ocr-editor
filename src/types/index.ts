export interface OcrTextDetail {
  text: string;
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
  file: File;
  url: string;
  ocrResult: OcrTextResult | null;
  ocrLoading: boolean;
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
