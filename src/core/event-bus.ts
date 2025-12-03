import mitt from "mitt";

export type CanvasEvents = {
  "canvas:zoom-in": void;
  "canvas:zoom-out": void;
  "canvas:zoom-reset": void;
  "canvas:zoom": { level: number };
  "canvas:clear": void;
};

export type SidebarTab = "images" | "text";

export type UiEvents = {
  "ui:sidebar-switch": SidebarTab;
};

export const canvasEventBus = mitt<CanvasEvents>();

export const uiEventBus = mitt<UiEvents>();
