import * as fabric from "fabric";
import type { RectProps } from "fabric";
import { defaultsDeep } from "lodash-es";

interface EnhancedRectProps extends Partial<RectProps> {
  label?: string;
  accentColor?: string;
}

const DEFAULT_ACCENT_COLOR = "#6366F1";

const hexToRgba = (hex: string, alpha: number) => {
  const sanitized = hex.replace("#", "");
  const value =
    sanitized.length === 3
      ? sanitized
          .split("")
          .map((char) => char + char)
          .join("")
      : sanitized;
  const parsed = parseInt(value, 16);
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const drawRoundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  rx = 0,
  ry = 0
) => {
  const radiusX = Math.min(rx, width / 2);
  const radiusY = Math.min(ry, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + radiusX, y);
  ctx.lineTo(x + width - radiusX, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radiusY);
  ctx.lineTo(x + width, y + height - radiusY);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radiusX, y + height);
  ctx.lineTo(x + radiusX, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radiusY);
  ctx.lineTo(x, y + radiusY);
  ctx.quadraticCurveTo(x, y, x + radiusX, y);
  ctx.closePath();
};

// Badge形状 - 用于显示OCR框编号
export class Badge extends fabric.Rect {
  static type = "Badge";
  declare text?: string | number;

  constructor(options?: Partial<RectProps>) {
    const defaultOptions = {
      fill: "rgba(0, 0, 0, 0.2)",
      stroke: "red",
      strokeWidth: 2,
    };
    const mergedOptions = defaultsDeep({}, options, defaultOptions);
    super(mergedOptions);
  }

  _render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const [x, y] = [this.width, this.height].map((m) => m / 2);

    ctx.beginPath();
    ctx.arc(-x, -y, 14, 0, 2 * Math.PI, false);
    ctx.fillStyle = "gray";
    ctx.fill();
    ctx.closePath();

    ctx.font = "14px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(this.text || ""), -x, -y);

    ctx.restore();
  }

  toObject<
    T extends Omit<Partial<RectProps>, keyof fabric.SerializedRectProps>,
    K extends keyof T = never
  >(propertiesToInclude?: K[]): Pick<T, K> & fabric.SerializedRectProps {
    const obj = super.toObject(propertiesToInclude as any);
    return { ...obj, text: this.text } as any;
  }

  static async fromObject<T extends Partial<fabric.SerializedRectProps>>(
    object: T,
    _options?: fabric.Abortable
  ): Promise<Badge> {
    return new Badge(object as any);
  }
}

// OCR形状 - 用于绘制OCR结果框
export class Ocr extends fabric.Rect {
  static type = "Ocr";
  declare scanLineX?: number;
  declare accentColor?: string;
  private animationId?: number;
  private startTime?: number;

  constructor(options?: EnhancedRectProps) {
    const { accentColor = DEFAULT_ACCENT_COLOR, ...rectOptions } =
      options || {};
    const defaultOptions: EnhancedRectProps = {
      fill: hexToRgba(accentColor, 0.06),
      stroke: accentColor,
      strokeWidth: 2,
      rx: 6,
      ry: 6,
      opacity: 1,
    };
    const mergedOptions = defaultsDeep({}, rectOptions, defaultOptions);
    super(mergedOptions);
    this.accentColor = accentColor;
    this.animateScan();
  }

  animateScan() {
    if (this.animationId !== undefined) {
      cancelAnimationFrame(this.animationId);
    }

    const obj = this;
    const duration = 1000;

    const animate = (currentTime: number) => {
      if (obj.startTime === undefined) {
        obj.startTime = currentTime;
      }
      const elapsed = currentTime - obj.startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeInOutQuad =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const value = -obj.width + obj.width * 2 * easeInOutQuad;
      obj.scanLineX = value;
      obj.dirty = true;
      obj.setCoords();
      obj.canvas && obj.canvas.requestRenderAll();

      if (progress < 1) {
        obj.animationId = requestAnimationFrame(animate);
      } else {
        obj.startTime = undefined;
        obj.animationId = requestAnimationFrame(animate);
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  stopAnimation() {
    if (this.animationId !== undefined) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
      this.startTime = undefined;
    }
  }

  _render(ctx: CanvasRenderingContext2D) {
    super._render(ctx);
    ctx.save();

    const x = -this.width / 2;
    const y = -this.height / 2;

    if (typeof this.scanLineX !== "undefined") {
      const gradient = ctx.createLinearGradient(
        this.scanLineX - 10,
        0,
        this.scanLineX + 10,
        0
      );
      gradient.addColorStop(0, "transparent");
      gradient.addColorStop(
        0.5,
        hexToRgba(this.accentColor || DEFAULT_ACCENT_COLOR, 0.45)
      );
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, this.width, this.height);
    }

    ctx.restore();
  }

  toObject<
    T extends Omit<Partial<RectProps>, keyof fabric.SerializedRectProps>,
    K extends keyof T = never
  >(propertiesToInclude?: K[]): Pick<T, K> & fabric.SerializedRectProps {
    const obj = super.toObject(propertiesToInclude as any) as any;
    return {
      ...obj,
      accentColor: this.accentColor,
    };
  }

  static async fromObject<T extends Partial<fabric.SerializedRectProps>>(
    object: T,
    _options?: fabric.Abortable
  ): Promise<Ocr> {
    return new Ocr(object as any);
  }
}

export class WaitingRect extends fabric.Rect {
  static type = "WaitingRect";
  declare scanLineX?: number;
  declare label?: string;
  declare accentColor?: string;
  private animationId?: number;
  private startTime?: number;

  constructor(options?: EnhancedRectProps) {
    const {
      label,
      accentColor = DEFAULT_ACCENT_COLOR,
      ...rectOptions
    } = options || {};
    const defaultOptions: EnhancedRectProps = {
      fill: hexToRgba(accentColor, 0.08),
      stroke: accentColor,
      strokeWidth: 2,
      strokeDashArray: [14, 10],
      rx: 8,
      ry: 8,
      opacity: 0.95,
      objectCaching: false,
    };
    const mergedOptions = defaultsDeep({}, rectOptions, defaultOptions);
    super(mergedOptions);
    this.label = label ?? "等待OCR";
    this.accentColor = accentColor;
    if (!this.shadow) {
      this.set(
        "shadow",
        new fabric.Shadow({
          color: hexToRgba(this.accentColor, 0.35),
          blur: 18,
          offsetX: 0,
          offsetY: 6,
        })
      );
    }
    this.animateScan();
  }

  animateScan() {
    if (this.animationId !== undefined) {
      cancelAnimationFrame(this.animationId);
    }

    const obj = this;
    const duration = 1000;

    const animate = (currentTime: number) => {
      if (obj.startTime === undefined) {
        obj.startTime = currentTime;
      }
      const elapsed = currentTime - obj.startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeInOutQuad =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const value = -obj.width + obj.width * 2 * easeInOutQuad;
      obj.scanLineX = value;
      obj.dirty = true;
      obj.setCoords();
      obj.canvas && obj.canvas.requestRenderAll();

      if (progress < 1) {
        obj.animationId = requestAnimationFrame(animate);
      } else {
        obj.startTime = undefined;
        obj.animationId = requestAnimationFrame(animate);
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  stopAnimation() {
    if (this.animationId !== undefined) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
      this.startTime = undefined;
    }
  }

  _render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    const x = -this.width / 2;
    const y = -this.height / 2;
    const radiusX = this.rx || 0;
    const radiusY = this.ry || 0;

    const accent = this.accentColor || DEFAULT_ACCENT_COLOR;
    const baseFill =
      (typeof this.fill === "string" && this.fill) || hexToRgba(accent, 0.08);

    // 绘制基础填充
    ctx.save();
    drawRoundedRectPath(ctx, x, y, this.width, this.height, radiusX, radiusY);
    ctx.fillStyle = baseFill;
    ctx.fill();
    ctx.restore();

    // 绘制柔和斜纹背景
    ctx.save();
    drawRoundedRectPath(ctx, x, y, this.width, this.height, radiusX, radiusY);
    ctx.clip();
    const stripeColor = hexToRgba(accent, 0.12);
    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 18;
    const stripeSpacing = 36;
    for (
      let stripeX = -this.height;
      stripeX < this.width + this.height;
      stripeX += stripeSpacing
    ) {
      ctx.beginPath();
      ctx.moveTo(x + stripeX, y);
      ctx.lineTo(x + stripeX - this.height, y + this.height);
      ctx.stroke();
    }
    ctx.restore();

    // 绘制顶端标签胶囊
    const labelText = this.label || "等待OCR";
    ctx.font = "12px 'PingFang SC', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelPaddingX = 12;
    const labelHeight = 24;
    const textWidth = ctx.measureText(labelText).width;
    const labelWidth = textWidth + labelPaddingX * 2;
    const radius = labelHeight / 2;
    const labelX = x + 14;
    const labelY = y + 10;

    ctx.beginPath();
    ctx.moveTo(labelX + radius, labelY);
    ctx.lineTo(labelX + labelWidth - radius, labelY);
    ctx.quadraticCurveTo(
      labelX + labelWidth,
      labelY,
      labelX + labelWidth,
      labelY + radius
    );
    ctx.lineTo(labelX + labelWidth, labelY + labelHeight - radius);
    ctx.quadraticCurveTo(
      labelX + labelWidth,
      labelY + labelHeight,
      labelX + labelWidth - radius,
      labelY + labelHeight
    );
    ctx.lineTo(labelX + radius, labelY + labelHeight);
    ctx.quadraticCurveTo(labelX, labelY + labelHeight, labelX, labelY + radius);
    ctx.lineTo(labelX, labelY + radius);
    ctx.quadraticCurveTo(labelX, labelY, labelX + radius, labelY);
    ctx.closePath();
    ctx.fillStyle = accent;
    ctx.shadowColor = hexToRgba(accent, 0.35);
    ctx.shadowBlur = 10;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(labelText, labelX + labelWidth / 2, labelY + labelHeight / 2);

    if (typeof this.scanLineX !== "undefined") {
      ctx.save();
      drawRoundedRectPath(ctx, x, y, this.width, this.height, radiusX, radiusY);
      ctx.clip();
      const gradient = ctx.createLinearGradient(
        this.scanLineX - 10,
        0,
        this.scanLineX + 10,
        0
      );
      gradient.addColorStop(0, "transparent");
      gradient.addColorStop(0.5, hexToRgba(accent, 0.45));
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, this.width, this.height);
      ctx.restore();
    }

    // 绘制虚线边框
    ctx.save();
    ctx.setLineDash(this.strokeDashArray || [14, 10]);
    ctx.lineWidth = this.strokeWidth || 2;
    ctx.strokeStyle = accent;
    drawRoundedRectPath(ctx, x, y, this.width, this.height, radiusX, radiusY);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  toObject<
    T extends Omit<Partial<RectProps>, keyof fabric.SerializedRectProps>,
    K extends keyof T = never
  >(propertiesToInclude?: K[]): Pick<T, K> & fabric.SerializedRectProps {
    const obj = super.toObject(propertiesToInclude as any) as any;
    return {
      ...obj,
      label: this.label,
      accentColor: this.accentColor,
    };
  }

  static async fromObject<T extends Partial<fabric.SerializedRectProps>>(
    object: T,
    _options?: fabric.Abortable
  ): Promise<WaitingRect> {
    return new WaitingRect(object as any);
  }
}

// 注册自定义类到 fabric
if (fabric.classRegistry) {
  fabric.classRegistry.setClass(Badge);
  fabric.classRegistry.setClass(Ocr);
  fabric.classRegistry.setClass(WaitingRect);
}
