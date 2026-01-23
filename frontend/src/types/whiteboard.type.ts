export type UserID = number;
export type ObjectID = string;

export type ToolType = "select" | "pen" | "rect" | "ellipse" | "line" | "text" | "eraser";
export type ShapeToolType = "rect" | "ellipse" | "line";
export type WhiteboardObjectType = "rect" | "ellipse" | "line" | "path" | "textbox";
export type PathData = (string | number)[][];
export type PartialSerializedObject = Omit<SerializedObject, "createdBy">;

import type { Canvas, FabricObject } from "fabric";

export interface SerializedObject {
  id: ObjectID;
  type: WhiteboardObjectType;
  version: number;
  createdBy: UserID;

  left: number;
  top: number;
  angle: number;

  width?: number;
  height?: number;
  scaleX: number;
  scaleY: number;

  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;

  text?: string;
  path?: PathData;
}

export interface ObjectPatch {
  version: number;
  left?: number;
  top?: number;
  angle?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  text?: string;
}

export interface CursorPosition {
  x: number;
  y: number;
  tool?: ToolType;
}

export interface UseFabricOptions {
  activeTool: ToolType;
  activeColor: string;
  onAdd?: (object: Omit<SerializedObject, "createdBy">) => void;
  onUpdate?: (objectId: ObjectID, patch: ObjectPatch) => void;
  onDelete?: (objectId: ObjectID) => void;
}

export interface UseFabricReturn {
  canvas: React.RefObject<Canvas | null>;
  isReady: boolean;
  canvasCallbackRef: (element: HTMLCanvasElement | null) => void;
}

export interface ShapeCreationState {
  isCreating: boolean;
  startX: number;
  startY: number;
  hasDragged: boolean;
  previewObject: FabricObject | null;
  objectId: string;
}

export interface WhiteboardContextValue {
  isActive: boolean;
  isConnected: boolean;
  objects: Record<ObjectID, SerializedObject>;
  userColors: Record<UserID, string>;
  myColor: string | null;
  activeTool: ToolType;
  activeColor: string;

  openWhiteboard: () => void;
  closeWhiteboard: () => void;
  setActiveTool: (tool: ToolType) => void;
  setActiveColor: (color: string) => void;

  emitAdd: (object: SerializedObject) => void;
  emitUpdate: (objectId: ObjectID, patch: ObjectPatch) => void;
  emitDelete: (objectId: ObjectID) => void;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}
