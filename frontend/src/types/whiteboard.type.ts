export type UserID = number;
export type ObjectID = string;

export type ToolType = "select" | "pen" | "rect" | "ellipse" | "line" | "text" | "eraser";
export type ShapeToolType = "rect" | "ellipse" | "line";
export type WhiteboardObjectType = "rect" | "ellipse" | "line" | "path" | "textbox";
export type PathData = (string | number)[][];
export type PartialSerializedObject = Omit<SerializedObject, "createdBy">;

import type { Canvas, FabricObject } from "fabric";
import type { Socket } from "socket.io-client";

export interface SerializedObject {
  id: ObjectID;
  type: WhiteboardObjectType;
  version: number;
  createdBy?: UserID;

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
  version?: number;
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
  setActiveTool?: (tool: ToolType) => void;
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

  applySnapshot: (objects: SerializedObject[], userColors: Record<UserID, string>) => void;
  applyRemoteAdd: (object: SerializedObject) => void;
  applyRemoteUpdate: (objectId: ObjectID, patch: ObjectPatch) => void;
  applyRemoteDelete: (objectId: ObjectID, version: number) => void;
  setMyColor: (color: string | null) => void;

  emitAdd: (object: SerializedObject) => void;
  emitUpdate: (objectId: ObjectID, patch: ObjectPatch) => void;
  emitDelete: (objectId: ObjectID) => void;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// useWhiteboardSync types below

export interface UseWhiteboardSyncParams {
  socket: Socket | null;
  callId: string | null;
  isActive: boolean;
  canSync: boolean;
  isReadyToApply: boolean;
  onSnapshot: (objects: SerializedObject[], userColors: Record<UserID, string>) => void;
  onSetMyColor: (color: string | null) => void;
  onRemoteAdd: (object: SerializedObject) => void;
  onRemoteUpdate: (objectId: ObjectID, patch: ObjectPatch) => void;
  onRemoteDelete: (objectId: ObjectID, version: number) => void;
  onCursorUpdate: (userId: UserID, position: CursorPosition | null, color: string) => void;
  onSyncError?: (error: string) => void;
}

export type WbAckReason = "stale" | "not_found";

export interface WbAck {
  success: boolean;
  applied?: boolean;
  objectId?: ObjectID;
  version?: number;
  reason?: WbAckReason;
  error?: string;
}

export interface WhiteboardProviderProps {
  children: React.ReactNode;
  socket?: Socket | null;
  callId?: string | null;
  canSync?: boolean;
  onStaleAck?: (ack: WbAck) => void;
}

export interface WbSnapshotPayload {
  callId: string;
  objects: SerializedObject[];
  userColors: Record<UserID, string>;
  myColor: string;
}

export interface WbAddPayload {
  callId: string;
  object: SerializedObject;
}

export interface WbUpdatePayload {
  callId: string;
  objectId: ObjectID;
  patch: ObjectPatch & { version?: number };
}

export interface WbDeletePayload {
  callId: string;
  objectId: ObjectID;
  version: number;
}

export interface WbCursorPayload {
  callId: string;
  userId: UserID;
  color: string;
  position: CursorPosition | null;
}

export type WbPendingEvent =
  | { type: "add"; payload: WbAddPayload }
  | { type: "update"; payload: WbUpdatePayload }
  | { type: "delete"; payload: WbDeletePayload }
  | { type: "cursor"; payload: WbCursorPayload };
