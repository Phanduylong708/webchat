import { useCallback } from "react";
import type { Socket } from "socket.io-client";
import { useWhiteboardSync } from "@/hooks/whiteboard/useWhiteboardSync";
import type {
  CursorPosition,
  ObjectID,
  ObjectPatch,
  SerializedObject,
  UserID,
  WbAck,
} from "@/types/whiteboard.type";

export interface UseWhiteboardOrchestrationParams {
  socket: Socket | null;
  callId: string | null;
  isActive: boolean;
  canSync: boolean;
  isReadyToApply: boolean;

  applySnapshot: (objects: SerializedObject[], userColors: Record<UserID, string>) => void;
  setMyColor: (color: string | null) => void;
  applyRemoteAdd: (object: SerializedObject) => void;
  applyRemoteUpdate: (objectId: ObjectID, patch: ObjectPatch) => void;
  applyRemoteDelete: (objectId: ObjectID, version: number) => void;
  onCursorUpdate?: (userId: UserID, position: CursorPosition | null, color: string) => void;

  onSyncError?: (error: string) => void;
}

export function useWhiteboardOrchestration({
  socket,
  callId,
  isActive,
  canSync,
  isReadyToApply,
  applySnapshot,
  setMyColor,
  applyRemoteAdd,
  applyRemoteUpdate,
  applyRemoteDelete,
  onCursorUpdate,
  onSyncError,
}: UseWhiteboardOrchestrationParams): { requestJoin: () => void; handleStaleAck: (ack?: WbAck) => void } {
  const cursorUpdateCallback = onCursorUpdate ?? (() => {});

  const { requestJoin } = useWhiteboardSync({
    socket,
    callId,
    isActive,
    canSync,
    isReadyToApply,
    onSnapshot: applySnapshot,
    onSetMyColor: setMyColor,
    onRemoteAdd: applyRemoteAdd,
    onRemoteUpdate: applyRemoteUpdate,
    onRemoteDelete: applyRemoteDelete,
    onCursorUpdate: cursorUpdateCallback,
    onSyncError,
  });

  const handleStaleAck = useCallback(
    (ack?: WbAck) => {
      if (!ack) return;
      if (!ack.success || ack.applied === false) {
        requestJoin();
      }
    },
    [requestJoin],
  );

  return { requestJoin, handleStaleAck };
}
