import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { WhiteboardContext } from "@/contexts/whiteboardContext";
import type {
  WhiteboardContextValue,
  ToolType,
  ObjectID,
  SerializedObject,
  ObjectPatch,
  UserID,
  WhiteboardProviderProps,
  WbAck,
} from "@/types/whiteboard.type";

const DEFAULT_COLOR = "#000000";

export function WhiteboardProvider({ ...props }: WhiteboardProviderProps): React.JSX.Element {
  const { children, socket, callId, canSync, onStaleAck } = props;
  const [isActive, setIsActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTool, setActiveToolState] = useState<ToolType>("select");
  const [activeColor, setActiveColorState] = useState(DEFAULT_COLOR);
  const [myColor, setMyColor] = useState<string | null>(null);
  const [objects, setObjects] = useState<Record<ObjectID, SerializedObject>>({});
  const [userColors, setUserColors] = useState<Record<UserID, string>>({});

  const objectsRef = useRef(objects); // to access latest objects in callbacks
  useEffect(() => {
    // keep ref updated
    objectsRef.current = objects;
  }, [objects]);

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

  const applySnapshot = useCallback(
    // applied on initial join. Snapshot means full state replacement.
    (nextObjects: SerializedObject[], nextUserColors: Record<UserID, string>) => {
      const record: Record<ObjectID, SerializedObject> = {};
      for (const obj of nextObjects) {
        record[obj.id] = obj;
      }
      setObjects(record);
      setUserColors(nextUserColors);
      setIsConnected(true);
    },
    [],
  );

  const applyRemoteAdd = useCallback((object: SerializedObject) => {
    setObjects((prev) => {
      const existing = prev[object.id];
      if (existing && object.version <= existing.version) return prev; // ignore stale add meaning re-add of existing object
      return { ...prev, [object.id]: object };
    });
  }, []);

  const applyRemoteUpdate = useCallback((objectId: ObjectID, patch: ObjectPatch) => {
    setObjects((prev) => {
      const existing = prev[objectId];
      if (!existing) return prev;
      if (typeof patch.version === "number" && patch.version <= existing.version) return prev;
      return {
        ...prev,
        [objectId]: { ...existing, ...patch },
      };
    });
  }, []);

  const applyRemoteDelete = useCallback((objectId: ObjectID, _version: number) => {
    // This function removes an object from the whiteboard based on its object ID and version.
    setObjects((prev) => {
      const existing = prev[objectId];
      if (existing && _version <= existing.version) return prev;
      const next = { ...prev };
      delete next[objectId];
      return next;
    });
  }, []);

  const emitAdd = useCallback(
    // send add object event to server
    (object: SerializedObject) => {
      setObjects((prev) => ({ ...prev, [object.id]: object }));
      if (!canSync || !socket || !callId) return;

      socket.emit("wb:add", { callId, object }, (ack?: WbAck) => {
        if (!ack) return;
        if (!ack.success || ack.applied === false) {
          onStaleAck?.(ack);
        }
      });
    },
    [canSync, socket, callId, onStaleAck],
  );

  const emitUpdate = useCallback(
    // send update object event to server
    (objectId: ObjectID, patch: ObjectPatch) => {
      const current = objectsRef.current[objectId]; // read latest version without stale closure
      if (!current) {
        onStaleAck?.({ success: true, applied: false, objectId, reason: "not_found" }); // orchestration should requestJoin()
        return;
      }

      const nextVersion = current.version + 1;
      const nextObject = { ...current, ...patch, version: nextVersion };
      objectsRef.current = { ...objectsRef.current, [objectId]: nextObject }; // sync ref immediately for same-tick updates
      setObjects((prev) => {
        const existing = prev[objectId];
        if (!existing) return prev;
        return {
          ...prev,
          [objectId]: nextObject,
        };
      });

      if (!canSync || !socket || !callId) return;
      socket.emit(
        "wb:update",
        { callId, objectId, patch: { ...patch, version: nextVersion } },
        (ack?: WbAck) => {
          if (!ack) return;
          if (!ack.success || ack.applied === false) {
            onStaleAck?.(ack);
          }
        },
      );
    },
    [canSync, socket, callId, onStaleAck],
  );

  const emitDelete = useCallback(
    // send delete object event to server
    (objectId: ObjectID) => {
      const current = objectsRef.current[objectId];
      if (!current) {
        // object not found
        onStaleAck?.({ success: true, applied: false, objectId, reason: "not_found" }); // orchestration should requestJoin()
        return;
      }

      const nextVersion = current.version + 1;
      objectsRef.current = (() => {
        const next = { ...objectsRef.current };
        delete next[objectId];
        return next;
      })(); // sync ref immediately for same-tick deletes
      setObjects((prev) => {
        if (!prev[objectId]) return prev;
        const next = { ...prev };
        delete next[objectId];
        return next;
      });

      if (!canSync || !socket || !callId) return;
      socket.emit("wb:delete", { callId, objectId, version: nextVersion }, (ack?: WbAck) => {
        if (!ack) return;
        if (!ack.success || ack.applied === false) {
          onStaleAck?.(ack);
        }
      });
    },
    [canSync, socket, callId, onStaleAck],
  );

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

      applySnapshot,
      applyRemoteAdd,
      applyRemoteUpdate,
      applyRemoteDelete,
      setMyColor,

      emitAdd,
      emitUpdate,
      emitDelete,
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
      applySnapshot,
      applyRemoteAdd,
      applyRemoteUpdate,
      applyRemoteDelete,
      setMyColor,
      emitAdd,
      emitUpdate,
      emitDelete,
    ],
  );

  return <WhiteboardContext.Provider value={value}>{children}</WhiteboardContext.Provider>;
}
