import { watch, onUnmounted, type Ref } from "vue";
import * as fabric from "fabric";
import { useOcrStore } from "../stores/ocrStore";

// Z 键画笔：使用 Fabric 自带自由绘制（单一 fabric.Canvas），
// 只在绘制过程中做 OCR 命中检测，不自己维护 Polyline，避免缩放/裁剪问题。
export function useCanvasBrush(
  fabricCanvas: Ref<any>,
  brushModeEnabled: Ref<boolean>
) {
  // 是否正在拖动画布
  let isDragging = false;
  // 本次按住 Z 绘制过程中命中的 OCR 明细索引，按首次命中顺序去重记录
  let hitIndexOrder = new Set<number>();
  // 本次按住 Z 绘制过程中生成的路径对象，鼠标松开后统一删除
  let tempPaths: fabric.Object[] = [];
  // 全局 OCR store，用于在一次绘制完成后更新 OCR 结果顺序
  const ocrStore = useOcrStore();

  const getOcrIndex = (obj: any) => {
    const raw = Number(obj.label ?? obj.text);
    return Number.isFinite(raw) ? raw - 1 : -1;
  };

  const markOcrHitAtPoint = (canvas: any, point: fabric.Point) => {
    try {
      canvas.forEachObject((obj: any) => {
        const type = obj.type || (obj.constructor && obj.constructor.name);
        const isOcrType = type === "ocr" || type === "Ocr";
        if (
          isOcrType &&
          typeof obj.containsPoint === "function" &&
          obj.containsPoint(point)
        ) {
          // 根据 label 推导出明细索引（从 1 开始编号 -> 数组索引）
          const idx = getOcrIndex(obj);
          if (idx >= 0 && !hitIndexOrder.has(idx)) hitIndexOrder.add(idx);
          if ("accentColor" in obj) obj.accentColor = "#9CA3AF";
          if ("stroke" in obj) obj.stroke = "#9CA3AF";
          obj.dirty = true;
        }
      });
    } catch (error) {
      console.error("Z 画笔命中 OCR 失败:", error);
    }
  };

  const handleMouseMove = (opt: any) => {
    const canvas = fabricCanvas.value;
    if (!canvas || !brushModeEnabled.value || !isDragging) return;
    const e = opt.e as MouseEvent;
    if (!e) return;
    const pointer = canvas.getPointer(e);
    const p = new fabric.Point(pointer.x, pointer.y);
    markOcrHitAtPoint(canvas, p);
    // 立即重绘底层 canvas，保证 OCR 颜色在绘制过程中实时更新
    canvas.requestRenderAll();
  };

  const handleMouseDown = () => {
    const canvas = fabricCanvas.value;
    if (!canvas) return;
    if (!brushModeEnabled.value) return;

    isDragging = true;
    hitIndexOrder.clear();
    tempPaths = [];
  };

  const handleMouseUp = () => {
    const canvas = fabricCanvas.value;
    if (!canvas) return;
    if (!brushModeEnabled.value) return;

    isDragging = false;

    // 计算本次绘制后 OCR 的排序结果：先是被命中的，按命中先后；其余保持原顺序
    if (hitIndexOrder.size > 0) {
      // 按命中顺序 + 其余保持原顺序，重排当前图片的 OCR 明细
      const details = ocrStore.currentDetails as any[];
      if (details && details.length > 0) {
        const hitDetails = Array.from(hitIndexOrder)
          .map((i) => details[i])
          .filter((d) => d != null);
        const restDetails = details.filter(
          (_d, idx) => !hitIndexOrder.has(idx)
        );
        const orderedDetails = [...hitDetails, ...restDetails];
        ocrStore.replaceCurrentDetails(orderedDetails);
      }
    }

    // 删除本次绘制产生的路径，仅保留 OCR 颜色变化
    if (tempPaths.length > 0) {
      tempPaths.forEach((p) => canvas.remove(p));
      tempPaths = [];
    }

    // 恢复OCR颜色
    canvas.forEachObject((obj: any) => {
      if ("accentColor" in obj) obj.accentColor = "#EF4444";
      if ("stroke" in obj) obj.stroke = "#EF4444";
      obj.dirty = true;
    });

    canvas.requestRenderAll();
  };

  const handlePathCreated = (opt: any) => {
    if (!fabricCanvas.value || !brushModeEnabled.value) return;
    const path = opt.path as fabric.Object | undefined;
    if (path) tempPaths.push(path);
  };

  const setupBrush = () => {
    if (!fabricCanvas.value) return;
    const canvas = fabricCanvas.value;

    // 在 Fabric 的 mouse:move 事件中做命中检测，绘制由 isDrawingMode 负责
    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);
    canvas.on("path:created", handlePathCreated);
  };

  const cleanupBrush = () => {
    if (fabricCanvas.value) {
      const canvas = fabricCanvas.value;
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
      canvas.off("path:created", handlePathCreated);
      canvas.isDrawingMode = false;

      // 清理拖拽状态
      isDragging = false;

      // 清理命中记录
      hitIndexOrder.clear();

      // 删除临时路径
      if (tempPaths.length > 0) {
        tempPaths.forEach((p) => canvas.remove(p));
        tempPaths = [];
      }

      // 恢复OCR颜色
      canvas.forEachObject((obj: any) => {
        if ("accentColor" in obj) obj.accentColor = "#EF4444";
        if ("stroke" in obj) obj.stroke = "#EF4444";
        obj.dirty = true;
      });

      canvas.requestRenderAll();
    }
  };

  // 监听画笔模式启用状态，控制绘制模式
  watch(
    [fabricCanvas, brushModeEnabled],
    ([canvas, enabled]) => {
      if (!canvas) {
        cleanupBrush();
        return;
      }

      if (enabled) {
        setupBrush();
        // 启用自由绘制模式
        canvas.isDrawingMode = true;
        if (!canvas.freeDrawingBrush) {
          if (fabric?.PencilBrush) {
            canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
          }
        }
        const brush = canvas.freeDrawingBrush;
        if (brush) {
          brush.color = "rgba(244,114,182,0.9)"; // 粉色
          brush.width = 3;
        }
      } else {
        canvas.isDrawingMode = false;
        cleanupBrush();
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    cleanupBrush();
  });
}
