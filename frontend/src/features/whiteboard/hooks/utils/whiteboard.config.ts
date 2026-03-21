export const CANVAS_WIDTH = 2560;
export const CANVAS_HEIGHT = 1440;
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_SHAPE_SIZE = 100;
export const DRAG_THRESHOLD = 5;

export const DEFAULT_FONT_SIZE = 20;
export const DEFAULT_FONT_FAMILY = "Arial";
export const DEFAULT_TEXT_WIDTH = 200;

export const SELECTION_COLOR = "rgba(45, 127, 249, 0.08)";
export const SELECTION_BORDER_COLOR = "#4c91fa";
export const SELECTION_LINE_WIDTH = 1.5;
export const EDITING_BORDER_COLOR = "#f59e0b";

export const OBJECT_CONTROL_CONFIG = {
  cornerColor: "#ffffff",
  cornerStrokeColor: "#4c91fa",
  cornerStyle: "rect" as const,
  cornerSize: 9,
  transparentCorners: false,
  borderColor: "#4c91fa",
  borderScaleFactor: 1.5,
};

export const CANVAS_OPTIONS = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  backgroundColor: "#ffffff",
  selection: true,
  preserveObjectStacking: true,
  stopContextMenu: true,
  fireRightClick: false,
};

export const INITIAL_SHAPE_STATE = {
  isCreating: false,
  startX: 0,
  startY: 0,
  hasDragged: false,
  previewObject: null,
  objectId: "",
} as const;
