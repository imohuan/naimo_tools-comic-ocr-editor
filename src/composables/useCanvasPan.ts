import { watch, onUnmounted, type Ref } from "vue";
import * as fabric from "fabric";
import { canvasEventBus } from "../core/event-bus";

export function useCanvasPan(
  fabricCanvas: Ref<any>,
  isWaitingMode?: Ref<boolean>
) {
  let isPanning = false;
  let lastPanPoint = { x: 0, y: 0 };
  let isRightMouseDown = false;
  let rightClickStartTime: number | null = null;
  let rightClickMoved = false;

  const handleContextMenu = (e: MouseEvent) => {
    // 始终阻止浏览器默认右键菜单，右键单击由 mouseup + mitt 触发
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // 原生 mousedown 事件处理器，用于处理平移（Alt+左键 / 右键拖拽）和 selection
  const handleNativeMouseDown = (e: MouseEvent) => {
    if (!fabricCanvas.value) return;

    // Alt + 左键 或 右键 => 进入平移模式
    const isAltLeft = e.altKey && e.button === 0;
    const isRight = e.button === 2;
    if (isAltLeft || isRight) {
      isPanning = true;
      isRightMouseDown = isRight;
      lastPanPoint = { x: e.clientX, y: e.clientY };
      // 仅记录右键的点击时间，用于区分点击和拖拽；Alt+左键不参与右键菜单逻辑
      if (isRight) {
        rightClickStartTime = Date.now();
        rightClickMoved = false;
      }
      fabricCanvas.value.defaultCursor = "move";
      // 仅在拖拽时临时关闭 selection，防止出现框选高亮
      fabricCanvas.value.selection = false;
      e.preventDefault();
      e.stopPropagation();

      // 立即阻止 contextmenu（右键时）
      if (isRight) {
        const preventContextMenu = (ev: Event) => {
          ev.preventDefault();
          ev.stopPropagation();
        };
        if (e.target) {
          e.target.addEventListener("contextmenu", preventContextMenu, {
            once: true,
            capture: true,
          });
        }
      }
      return;
    }

    // 普通左键行为：根据等待模式决定是否允许框选
    if (e.button === 0) {
      // const disableSelection = isWaitingMode?.value === true;
      // fabricCanvas.value.selection = !disableSelection;
      fabricCanvas.value.selection = false;
    }
  };

  // 原生 mousemove 事件处理器，用于处理右键拖拽
  const handleNativeMouseMove = (e: MouseEvent) => {
    if (!fabricCanvas.value || !isPanning) return;

    const vpt = fabricCanvas.value.viewportTransform;
    if (vpt) {
      vpt[4] += e.clientX - lastPanPoint.x;
      vpt[5] += e.clientY - lastPanPoint.y;
      fabricCanvas.value.setViewportTransform(vpt);
      fabricCanvas.value.requestRenderAll();
      canvasEventBus.emit("canvas:pan");
    }
    if (isRightMouseDown) {
      rightClickMoved = true;
    }
    lastPanPoint = { x: e.clientX, y: e.clientY };
    e.preventDefault();
    e.stopPropagation();
  };

  // 原生 mouseup 事件处理器，用于处理平移结束及右键菜单
  const handleNativeMouseUp = (e: MouseEvent) => {
    if (!fabricCanvas.value) return;

    // 右键抬起：处理右键拖拽结束 + 短按菜单
    if (e.button === 2) {
      // 先完成平移收尾（如果有）
      if (isPanning) {
        fabricCanvas.value.setViewportTransform(
          fabricCanvas.value.viewportTransform
        );
      }

      // 右键点击（短按且未明显移动）触发自定义右键菜单
      if (rightClickStartTime !== null) {
        const duration = Date.now() - rightClickStartTime;
        const isClick = duration < 250 && !rightClickMoved;
        if (isClick) {
          // 使用 fabric 的 hit-test 根据坐标找到当前点击到的 Ocr 对象
          let hitTarget: any = null;
          try {
            const pointer = fabricCanvas.value.getPointer(e);
            const point = new fabric.Point(pointer.x, pointer.y);
            fabricCanvas.value.forEachObject((obj: any) => {
              if (obj.type === "ocr" && obj.containsPoint(point)) {
                hitTarget = obj;
              }
            });
          } catch (error) {
            console.error("计算右键命中对象失败:", error);
          }

          canvasEventBus.emit("canvas:context-menu", {
            clientX: e.clientX,
            clientY: e.clientY,
            target: hitTarget,
          });
        }
      }

      isPanning = false;
      fabricCanvas.value.defaultCursor = "default";

      // 延迟重置 isRightMouseDown
      setTimeout(() => {
        isRightMouseDown = false;
      }, 100);

      e.preventDefault();
      e.stopPropagation();

      rightClickStartTime = null;
      rightClickMoved = false;
      return;
    }

    // Alt + 左键平移：左键抬起时结束平移
    if (e.button === 0 && isPanning && !isRightMouseDown) {
      fabricCanvas.value.setViewportTransform(
        fabricCanvas.value.viewportTransform
      );
      isPanning = false;
      fabricCanvas.value.defaultCursor = "default";
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const setupPan = () => {
    if (!fabricCanvas.value) return;

    // 在画布的所有相关 DOM 元素上监听右键菜单事件
    // Fabric.js 有多个 canvas 元素（lower-canvas 和 upper-canvas）以及容器
    const lowerCanvas = fabricCanvas.value.getElement();

    // 通过 DOM 查询获取所有相关元素
    const elements: (HTMLElement | null)[] = [lowerCanvas];

    if (lowerCanvas) {
      // 获取容器（wrapper）
      const container = lowerCanvas.closest(
        '[data-fabric="wrapper"]'
      ) as HTMLElement;
      if (container) {
        elements.push(container);
      }

      // 获取上层 canvas
      const upperCanvas = lowerCanvas.parentElement?.querySelector(
        ".upper-canvas"
      ) as HTMLCanvasElement;
      if (upperCanvas) {
        elements.push(upperCanvas);
      }

      // 也尝试通过父元素获取
      const parent = lowerCanvas.parentElement;
      if (parent) {
        elements.push(parent);
      }
    }

    // 在所有元素上绑定 contextmenu 和 mousedown 事件
    elements.forEach((element) => {
      if (element) {
        // 阻止右键菜单
        element.addEventListener("contextmenu", handleContextMenu, true);
        element.addEventListener("contextmenu", handleContextMenu, false);
        element.oncontextmenu = handleContextMenu;
        // 原生 mousedown 事件，用于处理右键拖拽
        element.addEventListener("mousedown", handleNativeMouseDown, true);
      }
    });

    // 在 window 上监听 mousemove 和 mouseup，确保即使鼠标移出画布也能正常工作
    window.addEventListener("mousemove", handleNativeMouseMove, true);
    window.addEventListener("mouseup", handleNativeMouseUp, true);
  };

  const cleanupPan = () => {
    if (!fabricCanvas.value) return;

    // 移除所有元素上的右键菜单事件监听
    const lowerCanvas = fabricCanvas.value.getElement();

    const elements: (HTMLElement | null)[] = [lowerCanvas];

    if (lowerCanvas) {
      const container = lowerCanvas.closest(
        '[data-fabric="wrapper"]'
      ) as HTMLElement;
      if (container) {
        elements.push(container);
      }

      const upperCanvas = lowerCanvas.parentElement?.querySelector(
        ".upper-canvas"
      ) as HTMLCanvasElement;
      if (upperCanvas) {
        elements.push(upperCanvas);
      }

      const parent = lowerCanvas.parentElement;
      if (parent) {
        elements.push(parent);
      }
    }

    elements.forEach((element) => {
      if (element) {
        element.removeEventListener("contextmenu", handleContextMenu, true);
        element.removeEventListener("contextmenu", handleContextMenu, false);
        element.removeEventListener("mousedown", handleNativeMouseDown, true);
        element.oncontextmenu = null;
      }
    });

    // 移除 window 上的监听器
    window.removeEventListener("mousemove", handleNativeMouseMove, true);
    window.removeEventListener("mouseup", handleNativeMouseUp, true);
  };

  watch(
    fabricCanvas,
    (canvas) => {
      if (canvas) {
        setupPan();
      } else {
        cleanupPan();
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    cleanupPan();
  });

  return {
    isPanning: () => isPanning,
  };
}
