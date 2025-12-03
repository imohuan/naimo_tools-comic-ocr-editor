import mitt from "mitt";

export type CanvasEvents = {
  "canvas:zoom-in": void;
  "canvas:zoom-out": void;
  "canvas:zoom-reset": void;
  "canvas:zoom": { level: number };
  "canvas:pan": void;
  "canvas:clear": void;
  // 右键菜单事件：在画布上短按右键松开时触发
  "canvas:context-menu": {
    clientX: number;
    clientY: number;
    target: any;
  };
};

export type SidebarTab = "images" | "text";

export type UiEvents = {
  "ui:sidebar-switch": SidebarTab;
};

export const canvasEventBus = mitt<CanvasEvents>();

export const uiEventBus = mitt<UiEvents>();
