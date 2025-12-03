import mitt from "mitt";

export type CanvasEvents = {
  "canvas:zoom-in": void;
  "canvas:zoom-out": void;
  "canvas:zoom-reset": void;
  "canvas:zoom": { level: number };
  "canvas:clear": void;
};

export const canvasEventBus = mitt<CanvasEvents>();
