import { useCallback, useEffect, useRef } from "react";
import type {
  UseWhiteboardSyncParams,
  WbSnapshotPayload,
  WbAddPayload,
  WbUpdatePayload,
  WbDeletePayload,
  WbCursorPayload,
  WbPendingEvent,
} from "@/types/whiteboard.type";

type TimeoutHandle = ReturnType<typeof setTimeout>;

const SNAPSHOT_TIMEOUT_MS = 5000;
const MAX_PENDING_EVENTS = 200;
const MAX_JOIN_RETRIES = 3;

export function useWhiteboardSync({
  socket,
  callId,
  isActive,
  canSync,
  isReadyToApply,
  onSnapshot,
  onSetMyColor,
  onRemoteAdd,
  onRemoteUpdate,
  onRemoteDelete,
  onCursorUpdate,
  onSyncError,
}: UseWhiteboardSyncParams): { requestJoin: () => void } {
  const callbacksRef = useRef({
    onSnapshot,
    onSetMyColor,
    onRemoteAdd,
    onRemoteUpdate,
    onRemoteDelete,
    onCursorUpdate,
    onSyncError,
  });
  const latestCallIdRef = useRef(callId);
  const latestIsActiveRef = useRef(isActive);
  const latestCanSyncRef = useRef(canSync);
  const joinEpochRef = useRef(0);
  const retryCountRef = useRef(0);
  const snapshotEpochRef = useRef(0);
  const hasSnapshotRef = useRef(false);
  const waitingForSnapshotRef = useRef(false);
  const snapshotTimeoutRef = useRef<TimeoutHandle | null>(null);
  const pendingEventsRef = useRef<WbPendingEvent[]>([]);

  useEffect(() => {
    callbacksRef.current = {
      onSnapshot,
      onSetMyColor,
      onRemoteAdd,
      onRemoteUpdate,
      onRemoteDelete,
      onCursorUpdate,
      onSyncError,
    };
  }, [onSnapshot, onSetMyColor, onRemoteAdd, onRemoteUpdate, onRemoteDelete, onCursorUpdate, onSyncError]);

  useEffect(() => {
    latestCallIdRef.current = callId;
  }, [callId]);

  useEffect(() => {
    latestIsActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    latestCanSyncRef.current = canSync;
  }, [canSync]);

  const resetState = useCallback(() => {
    pendingEventsRef.current = [];
    hasSnapshotRef.current = false;
    waitingForSnapshotRef.current = false;
    retryCountRef.current = 0;
    if (snapshotTimeoutRef.current) {
      clearTimeout(snapshotTimeoutRef.current);
      snapshotTimeoutRef.current = null;
    }
  }, []);

  const shouldProcessPayload = useCallback((payloadCallId: string) => {
    const currentCallId = latestCallIdRef.current;
    return Boolean(
      currentCallId &&
        payloadCallId === currentCallId &&
        latestIsActiveRef.current &&
        latestCanSyncRef.current,
    );
  }, []);

  const flushPending = useCallback(() => {
    if (!hasSnapshotRef.current || !isReadyToApply) return;
    const events = pendingEventsRef.current;
    pendingEventsRef.current = [];
    for (const event of events) {
      if (event.type === "add") {
        callbacksRef.current.onRemoteAdd(event.payload.object);
      } else if (event.type === "update") {
        callbacksRef.current.onRemoteUpdate(event.payload.objectId, event.payload.patch);
      } else if (event.type === "delete") {
        callbacksRef.current.onRemoteDelete(event.payload.objectId, event.payload.version);
      }
    }
  }, [isReadyToApply]);

  const requestJoin = useCallback(() => {
    if (!socket || !callId || !isActive || !canSync) return;

    joinEpochRef.current += 1;
    const currentEpoch = joinEpochRef.current;
    snapshotEpochRef.current = currentEpoch;
    resetState();
    waitingForSnapshotRef.current = true;

    if (snapshotTimeoutRef.current) {
      clearTimeout(snapshotTimeoutRef.current);
    }
    snapshotTimeoutRef.current = setTimeout(() => {
      if (!waitingForSnapshotRef.current) return;
      waitingForSnapshotRef.current = false;
      retryCountRef.current += 1;
      if (retryCountRef.current >= MAX_JOIN_RETRIES) {
        callbacksRef.current.onSyncError?.("snapshot_timeout_permanent");
        return;
      }
      callbacksRef.current.onSyncError?.("snapshot_timeout");
      requestJoin();
    }, SNAPSHOT_TIMEOUT_MS);

    socket.emit("wb:join", { callId }, (ack?: { success: boolean; error?: string }) => {
      if (joinEpochRef.current !== currentEpoch) return;
      if (!ack?.success) {
        waitingForSnapshotRef.current = false;
        if (snapshotTimeoutRef.current) {
          clearTimeout(snapshotTimeoutRef.current);
          snapshotTimeoutRef.current = null;
        }
        callbacksRef.current.onSyncError?.(ack?.error || "join_failed");
      }
    });
  }, [socket, callId, isActive, canSync, resetState]);

  const bufferOrDispatch = useCallback((event: WbPendingEvent) => {
    if (!hasSnapshotRef.current || !isReadyToApply) {
      if (pendingEventsRef.current.length >= MAX_PENDING_EVENTS) {
        pendingEventsRef.current = [];
        hasSnapshotRef.current = false;
        waitingForSnapshotRef.current = false;
        if (snapshotTimeoutRef.current) {
          clearTimeout(snapshotTimeoutRef.current);
          snapshotTimeoutRef.current = null;
        }
        requestJoin();
        return;
      }
      pendingEventsRef.current.push(event);
      return;
    }

    if (event.type === "add") {
      callbacksRef.current.onRemoteAdd(event.payload.object);
    } else if (event.type === "update") {
      callbacksRef.current.onRemoteUpdate(event.payload.objectId, event.payload.patch);
    } else if (event.type === "delete") {
      callbacksRef.current.onRemoteDelete(event.payload.objectId, event.payload.version);
    }
  }, [isReadyToApply, requestJoin]);

  useEffect(() => {
    if (!socket) return;

    const handleSnapshot = (payload: WbSnapshotPayload) => {
      const currentCallId = latestCallIdRef.current;
      if (!currentCallId || payload.callId !== currentCallId) return;
      if (!waitingForSnapshotRef.current) return;
      if (joinEpochRef.current !== snapshotEpochRef.current) return;

      waitingForSnapshotRef.current = false;
      retryCountRef.current = 0;
      if (snapshotTimeoutRef.current) {
        clearTimeout(snapshotTimeoutRef.current);
        snapshotTimeoutRef.current = null;
      }

      callbacksRef.current.onSetMyColor(payload.myColor || null);
      callbacksRef.current.onSnapshot(payload.objects, payload.userColors || {});
      hasSnapshotRef.current = true;
      flushPending();
    };

    const handleAdd = (payload: WbAddPayload) => {
      if (!shouldProcessPayload(payload.callId)) return;
      bufferOrDispatch({ type: "add", payload });
    };

    const handleUpdate = (payload: WbUpdatePayload) => {
      if (!shouldProcessPayload(payload.callId)) return;
      if (typeof payload.patch?.version !== "number") return;
      bufferOrDispatch({ type: "update", payload });
    };

    const handleDelete = (payload: WbDeletePayload) => {
      if (!shouldProcessPayload(payload.callId)) return;
      bufferOrDispatch({ type: "delete", payload });
    };

    const handleCursor = (payload: WbCursorPayload) => {
      if (!shouldProcessPayload(payload.callId)) return;
      if (!hasSnapshotRef.current || !isReadyToApply) return;
      callbacksRef.current.onCursorUpdate(payload.userId, payload.position, payload.color);
    };

    socket.on("wb:snapshot", handleSnapshot);
    socket.on("wb:add", handleAdd);
    socket.on("wb:update", handleUpdate);
    socket.on("wb:delete", handleDelete);
    socket.on("wb:cursor", handleCursor);

    return () => {
      socket.off("wb:snapshot", handleSnapshot);
      socket.off("wb:add", handleAdd);
      socket.off("wb:update", handleUpdate);
      socket.off("wb:delete", handleDelete);
      socket.off("wb:cursor", handleCursor);
    };
  }, [socket, isReadyToApply, bufferOrDispatch, flushPending, shouldProcessPayload]);

  useEffect(() => {
    flushPending();
  }, [flushPending]);

  useEffect(() => {
    if (!socket) return;
    function handleConnect() {
      if (latestIsActiveRef.current && latestCallIdRef.current && latestCanSyncRef.current) {
        requestJoin();
      }
    }
    socket.on("connect", handleConnect);
    return () => {
      socket.off("connect", handleConnect);
    };
  }, [socket, requestJoin]);

  useEffect(() => {
    if (!socket) return;
    if (isActive && callId && canSync) {
      requestJoin();
      return () => {
        resetState();
      };
    }
    resetState();
  }, [socket, callId, isActive, canSync, requestJoin, resetState]);

  useEffect(() => {
    return () => {
      resetState();
    };
  }, [resetState]);

  useEffect(() => {
    if (!socket) return;
    if (!callId || !isActive) return;
    return () => {
      socket.emit("wb:cursor", { callId, position: null });
    };
  }, [socket, callId, isActive]);

  return { requestJoin };
}
