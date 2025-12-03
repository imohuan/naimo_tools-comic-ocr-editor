import * as fabric from "fabric";
import type { RectProps } from "fabric";
import { defaultsDeep } from "lodash-es";

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
    super._render(ctx);
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

// OCR形状 - 用于绘制OCR框
export class Ocr extends fabric.Rect {
  static type = "Ocr";
  declare scanLineX?: number;
  private animationId?: number;
  private startTime?: number;

  constructor(options?: Partial<RectProps>) {
    const defaultOptions = {
      fill: "rgba(0, 0, 0, 0.4)",
      stroke: "black",
      strokeWidth: 2,
    };
    const mergedOptions = defaultsDeep({}, options, defaultOptions);
    super(mergedOptions);
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

    ctx.font = "14px Arial";
    ctx.fillStyle = "black";
    ctx.textBaseline = "middle";
    ctx.fillText("OCR", x + 2, y + 10);

    if (typeof this.scanLineX !== "undefined") {
      const gradient = ctx.createLinearGradient(
        this.scanLineX - 10,
        0,
        this.scanLineX + 10,
        0
      );
      gradient.addColorStop(0, "transparent");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.5)");
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
    return super.toObject(propertiesToInclude as any) as any;
  }

  static async fromObject<T extends Partial<fabric.SerializedRectProps>>(
    object: T,
    _options?: fabric.Abortable
  ): Promise<Ocr> {
    return new Ocr(object as any);
  }
}

// 注册自定义类到 fabric
if (fabric.classRegistry) {
  fabric.classRegistry.setClass(Badge);
  fabric.classRegistry.setClass(Ocr);
}

export function createOcrShape() {
  return Ocr;
}

export function createBadgeShape() {
  return Badge;
}
