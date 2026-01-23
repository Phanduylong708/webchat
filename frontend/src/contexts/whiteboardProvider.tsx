import { useState, useMemo, useCallback } from "react";
import { WhiteboardContext } from "@/contexts/whiteboardContext";
import type {
  WhiteboardContextValue,
  ToolType,
  ObjectID,
  SerializedObject,
  ObjectPatch,
} from "@/types/whiteboard.type";

const DEFAULT_COLOR = "#000000";

export function WhiteboardProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [isActive, setIsActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTool, setActiveToolState] = useState<ToolType>("select");
  const [activeColor, setActiveColorState] = useState(DEFAULT_COLOR);
  const [myColor, setMyColor] = useState<string | null>(null);
  const [objects, setObjects] = useState<Record<ObjectID, SerializedObject>>({});
  const [userColors, setUserColors] = useState<Record<number, string>>({});

  const [undoStack, setUndoStack] = useState<unknown[]>([]);
  const [redoStack, setRedoStack] = useState<unknown[]>([]);

  const openWhiteboard = useCallback(() => {
    setIsActive(true);
  }, []);

  const closeWhiteboard = useCallback(() => {
    setIsActive(false);
  }, []);

  const setActiveTool = useCallback((tool: ToolType) => {
    setActiveToolState(tool);
  }, []);

  const setActiveColor = useCallback((color: string) => {
    setActiveColorState(color);
  }, []);

  const emitAdd = useCallback((object: SerializedObject) => {
    setObjects((prev) => ({ ...prev, [object.id]: object }));
  }, []);

  const emitUpdate = useCallback((objectId: ObjectID, patch: ObjectPatch) => {
    setObjects((prev) => {
      const existing = prev[objectId];
      if (!existing) return prev;
      return {
        ...prev,
        [objectId]: { ...existing, ...patch },
      };
    });
  }, []);

  const emitDelete = useCallback((objectId: ObjectID) => {
    setObjects((prev) => {
      const next = { ...prev };
      delete next[objectId];
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    // Stub - will be implemented in Phase 2b
  }, []);

  const redo = useCallback(() => {
    // Stub - will be implemented in Phase 2b
  }, []);

  const value = useMemo<WhiteboardContextValue>(
    () => ({
      isActive,
      isConnected,
      objects,
      userColors,
      myColor,
      activeTool,
      activeColor,

      openWhiteboard,
      closeWhiteboard,
      setActiveTool,
      setActiveColor,

      emitAdd,
      emitUpdate,
      emitDelete,

      undo,
      redo,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
    }),
    [
      isActive,
      isConnected,
      objects,
      userColors,
      myColor,
      activeTool,
      activeColor,
      openWhiteboard,
      closeWhiteboard,
      setActiveTool,
      setActiveColor,
      emitAdd,
      emitUpdate,
      emitDelete,
      undo,
      redo,
      undoStack.length,
      redoStack.length,
    ]
  );

  return <WhiteboardContext.Provider value={value}>{children}</WhiteboardContext.Provider>;
}
