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
  onSyncError,
}: UseWhiteboardOrchestrationParams): { requestJoin: () => void; handleStaleAck: (ack?: WbAck) => void } {
  const onCursorUpdate = useCallback(
    (_userId: UserID, _position: CursorPosition | null, _color: string) => {
      // Phase 2a: cursors
    },
    [],
  );

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
    onCursorUpdate,
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
