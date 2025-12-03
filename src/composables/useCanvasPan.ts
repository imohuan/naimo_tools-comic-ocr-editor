import { watch, onUnmounted, type Ref } from "vue";

export function useCanvasPan(fabricCanvas: Ref<any>) {
  let isPanning = false;
  let lastPanPoint = { x: 0, y: 0 };
  let isRightMouseDown = false;

  const handleMouseDown = (opt: any) => {
    if (!fabricCanvas.value) return;

    const e = opt.e as MouseEvent;
    if (!e) return;

    // 支持 Alt+左键 或 右键拖拽
    if (e.altKey === true || e.button === 2) {
      isPanning = true;
      isRightMouseDown = e.button === 2;
      lastPanPoint = { x: e.clientX, y: e.clientY };
      fabricCanvas.value.defaultCursor = "move";
      fabricCanvas.value.selection = false;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleMouseMove = (opt: any) => {
    if (!fabricCanvas.value || !isPanning) return;

    const e = opt.e as MouseEvent;
    if (!e) return;

    const vpt = fabricCanvas.value.viewportTransform;
    if (vpt) {
      vpt[4] += e.clientX - lastPanPoint.x;
      vpt[5] += e.clientY - lastPanPoint.y;
      fabricCanvas.value.setViewportTransform(vpt);
      fabricCanvas.value.requestRenderAll();
    }
    lastPanPoint = { x: e.clientX, y: e.clientY };
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseUp = (opt: any) => {
    if (!fabricCanvas.value) return;

    if (isPanning) {
      // 确保 viewportTransform 被正确设置
      fabricCanvas.value.setViewportTransform(
        fabricCanvas.value.viewportTransform
      );
    }

    isPanning = false;
    fabricCanvas.value.selection = true;
    fabricCanvas.value.defaultCursor = "default";

    // 延迟重置 isRightMouseDown，确保 contextmenu 事件能被正确阻止
    if (isRightMouseDown) {
      setTimeout(() => {
        isRightMouseDown = false;
      }, 100);
    } else {
      isRightMouseDown = false;
    }

    if (opt?.e) {
      opt.e.preventDefault();
      opt.e.stopPropagation();
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    // 始终阻止右键菜单，因为需要右键拖拽功能
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // 原生 mousedown 事件处理器，用于处理右键拖拽
  const handleNativeMouseDown = (e: MouseEvent) => {
    if (!fabricCanvas.value) return;

    // 如果是右键，直接处理拖拽逻辑
    if (e.button === 2) {
      isPanning = true;
      isRightMouseDown = true;
      lastPanPoint = { x: e.clientX, y: e.clientY };
      fabricCanvas.value.defaultCursor = "move";
      fabricCanvas.value.selection = false;
      e.preventDefault();
      e.stopPropagation();

      // 立即阻止 contextmenu
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
    }
    lastPanPoint = { x: e.clientX, y: e.clientY };
    e.preventDefault();
    e.stopPropagation();
  };

  // 原生 mouseup 事件处理器，用于处理右键拖拽
  const handleNativeMouseUp = (e: MouseEvent) => {
    if (!fabricCanvas.value) return;

    if (isPanning && e.button === 2) {
      // 确保 viewportTransform 被正确设置
      fabricCanvas.value.setViewportTransform(
        fabricCanvas.value.viewportTransform
      );

      isPanning = false;
      fabricCanvas.value.selection = true;
      fabricCanvas.value.defaultCursor = "default";

      // 延迟重置 isRightMouseDown
      setTimeout(() => {
        isRightMouseDown = false;
      }, 100);

      e.preventDefault();
      e.stopPropagation();
    }
  };

  const setupPan = () => {
    if (!fabricCanvas.value) return;

    fabricCanvas.value.on("mouse:down", handleMouseDown);
    fabricCanvas.value.on("mouse:move", handleMouseMove);
    fabricCanvas.value.on("mouse:up", handleMouseUp);

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

    fabricCanvas.value.off("mouse:down", handleMouseDown);
    fabricCanvas.value.off("mouse:move", handleMouseMove);
    fabricCanvas.value.off("mouse:up", handleMouseUp);

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
