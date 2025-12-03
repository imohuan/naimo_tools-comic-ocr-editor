import { ref, watch, type Ref } from "vue";
import * as fabric from "fabric";
import type { ImageRect } from "../core/canvas-utils";
import { nextTick } from "vue";

export function useCanvasCompare(
  fabricCanvas: Ref<any>,
  imageRect: Ref<ImageRect>,
  container: Ref<HTMLElement | undefined>
) {
  const isComparing = ref(false);
  const comparePosition = ref(50); // 分割线位置百分比（相对于容器）
  const isDraggingDivider = ref(false);

  // 对比模式下的图片对象
  const originalImageObj = ref<fabric.Image | null>(null);
  const processedImageObj = ref<fabric.Image | null>(null);

  // 防抖标志，避免重复调用
  let isRedrawing = false;

  // 重新绘制对比canvas（带防抖）
  const redrawCompareCanvas = () => {
    if (isRedrawing) return;
    if (!isComparing.value || !fabricCanvas.value) return;
    if (!originalImageObj.value || !processedImageObj.value) return;
    if (!imageRect.value || imageRect.value.w === 0) return;
    if (!container.value) return;

    isRedrawing = true;

    try {
      const canvas = fabricCanvas.value;
      const canvasElement = canvas.getElement();
      if (!canvasElement) return;

      // 获取容器的实际显示位置（统一使用容器宽度）
      const containerRect = container.value.getBoundingClientRect();

      // 计算分割线在容器中的绝对屏幕位置（基于容器宽度百分比）
      // comparePosition 是相对于容器的百分比，所以使用 containerRect.width
      const dividerScreenX =
        containerRect.left +
        (containerRect.width * comparePosition.value) / 100;
      const dividerScreenY = containerRect.top + containerRect.height / 2;

      // 获取图片在画布上的位置和尺寸（画布坐标）
      const imgLeft = imageRect.value.x;
      const imgTop = imageRect.value.y;
      const imgWidth = imageRect.value.w;
      const imgHeight = imageRect.value.h;

      // 使用 fabric.js 的 getPointer 方法将屏幕坐标转换为画布坐标
      // 这会自动处理 viewportTransform（缩放和平移）
      const virtualEvent = {
        clientX: dividerScreenX,
        clientY: dividerScreenY,
      } as MouseEvent;

      const pointer = canvas.getPointer(virtualEvent);
      const splitXInCanvas = pointer.x;

      // 计算分割线相对于图片的位置（clipPath 是相对于对象本身的）
      const splitXRelativeToImage = splitXInCanvas - imgLeft;

      // 确保分割线位置在图片范围内
      const clampedSplitX = Math.max(
        0,
        Math.min(imgWidth, splitXRelativeToImage)
      );

      // 为原图设置裁剪区域（左侧）
      const originalClip = new fabric.Rect({
        left: imgLeft,
        top: imgTop,
        width: clampedSplitX,
        height: imgHeight,
        absolutePositioned: true,
      });
      originalImageObj.value.set({ clipPath: originalClip });

      // 为处理后的图设置裁剪区域（右侧）
      const processedClip = new fabric.Rect({
        left: imgLeft + clampedSplitX,
        top: imgTop,
        width: imgWidth - clampedSplitX,
        height: imgHeight,
        absolutePositioned: true,
      });
      processedImageObj.value.set({ clipPath: processedClip });

      canvas.renderAll();
    } catch (error) {
      console.error("重绘对比canvas时出错:", error);
    } finally {
      // 使用 nextTick 确保在下一次事件循环中重置标志
      nextTick(() => {
        isRedrawing = false;
      });
    }
  };

  // 加载对比图片
  const loadCompareImages = async (
    original: File | string,
    processed: File | string
  ) => {
    if (!fabricCanvas.value) return;

    // 清空画布和图片对象
    fabricCanvas.value.clear();
    originalImageObj.value = null;
    processedImageObj.value = null;

    // 加载原图
    const originalUrl: string =
      typeof original === "string" ? original : URL.createObjectURL(original);
    const originalImg = await fabric.Image.fromURL(originalUrl);
    if (typeof original !== "string") {
      URL.revokeObjectURL(originalUrl);
    }

    // 加载处理后的图（如果原图和处理后的图是同一个，则复用）
    let processedImg: fabric.Image;
    if (original === processed) {
      processedImg = (await originalImg.clone()) as fabric.Image;
    } else {
      const processedUrl: string =
        typeof processed === "string"
          ? processed
          : URL.createObjectURL(processed);
      processedImg = await fabric.Image.fromURL(processedUrl);
      if (typeof processed !== "string") {
        URL.revokeObjectURL(processedUrl);
      }
    }

    // 计算缩放和位置（与原图加载逻辑保持一致）
    const canvasWidth = fabricCanvas.value.getWidth();
    const canvasHeight = fabricCanvas.value.getHeight() - 55;

    const imgWidth =
      (originalImg.width as number) * (originalImg.scaleX as number);
    const imgHeight =
      (originalImg.height as number) * (originalImg.scaleY as number);

    const scaleX = canvasWidth / imgWidth;
    const scaleY = canvasHeight / imgHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    const imageWidth = imgWidth * scale;
    const imageHeight = imgHeight * scale;

    const left = (canvasWidth - imageWidth) / 2;
    const top = (canvasHeight - imageHeight) / 2;

    // 设置原图
    originalImg.set({
      scaleX: scale,
      scaleY: scale,
      left,
      top,
      selectable: false,
      lock: true,
    } as any);

    // 设置处理后的图
    processedImg.set({
      scaleX: scale,
      scaleY: scale,
      left,
      top,
      selectable: false,
      lock: true,
    } as any);

    // 更新 imageRect（必须在添加到画布之前）
    imageRect.value = {
      x: left,
      y: top,
      w: imageWidth,
      h: imageHeight,
      ow: imgWidth,
      oh: imgHeight,
    };

    // 保存图片对象引用
    originalImageObj.value = originalImg;
    processedImageObj.value = processedImg;

    // 添加到画布
    fabricCanvas.value.add(originalImg);
    fabricCanvas.value.add(processedImg);

    // 渲染画布
    fabricCanvas.value.renderAll();

    // 应用裁剪（延迟执行，确保画布已渲染）
    await nextTick();
    redrawCompareCanvas();
  };

  // 分割线拖动处理
  const handleDividerMouseDown = (e: MouseEvent) => {
    e.stopPropagation();
    isDraggingDivider.value = true;
  };

  // 分割线拖动的全局事件处理
  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (isDraggingDivider.value && container.value) {
      const rect = container.value.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = (x / rect.width) * 100;
      comparePosition.value = Math.max(0, Math.min(100, percentage));
      redrawCompareCanvas();
    }
  };

  const handleGlobalMouseUp = () => {
    isDraggingDivider.value = false;
  };

  // 切换对比模式
  const toggleCompare = () => {
    isComparing.value = !isComparing.value;
    comparePosition.value = 50;
  };

  // 监听分割线位置变化
  watch(
    () => comparePosition.value,
    () => {
      if (isComparing.value) {
        redrawCompareCanvas();
      }
    }
  );

  // 监听 imageRect 变化，重新绘制对比效果（仅在对比模式下）
  watch(
    () => imageRect.value,
    () => {
      if (isComparing.value && imageRect.value && imageRect.value.w > 0) {
        nextTick(() => {
          redrawCompareCanvas();
        });
      }
    },
    { deep: true }
  );

  // 监听画布视口变化（缩放或平移）
  const handleViewportChange = () => {
    if (isComparing.value) {
      nextTick(() => {
        redrawCompareCanvas();
      });
    }
  };

  return {
    isComparing,
    comparePosition,
    isDraggingDivider,
    originalImageObj,
    processedImageObj,
    loadCompareImages,
    redrawCompareCanvas,
    handleDividerMouseDown,
    handleGlobalMouseMove,
    handleGlobalMouseUp,
    toggleCompare,
    handleViewportChange,
  };
}
