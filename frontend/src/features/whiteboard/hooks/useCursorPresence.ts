import { useState, useRef, useCallback, useEffect } from "react";
import type { Socket } from "socket.io-client";
import type { UserID, CursorPosition } from "@/features/whiteboard/types/whiteboard.type";

export interface RemoteCursorPresence {
  userId: UserID;
  color: string;
  position: CursorPosition;
  lastSeenAt: number;
  staleSince: number | null;
}

export interface UseCursorPresenceParams {
  socket: Socket | null;
  callId: string | null;
  isActive: boolean;
  canSync: boolean;
  ttlMs?: number;
  removeGraceMs?: number;
  throttleMs?: number;
}

export interface UseCursorPresenceReturn {
  remoteCursors: RemoteCursorPresence[];
  handleRemoteCursor: (userId: UserID, position: CursorPosition | null, color: string) => void;
  emitCursor: (position: CursorPosition | null) => void;
  clearAllRemoteCursors: () => void;
}

const DEFAULT_TTL_MS = 3000;
const DEFAULT_REMOVE_GRACE_MS = 1500;
const DEFAULT_THROTTLE_MS = 75;
const CLEANUP_INTERVAL_MS = 250;

export function useCursorPresence({
  socket,
  callId,
  isActive,
  canSync,
  ttlMs = DEFAULT_TTL_MS,
  removeGraceMs = DEFAULT_REMOVE_GRACE_MS,
  throttleMs = DEFAULT_THROTTLE_MS,
}: UseCursorPresenceParams): UseCursorPresenceReturn {
  const [cursorsState, setCursorsState] = useState<Record<UserID, RemoteCursorPresence>>({});

  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmitTimeRef = useRef<number>(0);
  const pendingPositionRef = useRef<CursorPosition | null>(null);

  const handleRemoteCursor = useCallback(
    (userId: UserID, position: CursorPosition | null, color: string) => {
      const now = Date.now();

      if (position === null) {
        setCursorsState((prev) => {
          if (!(userId in prev)) return prev;
          const next = { ...prev };
          delete next[userId];
          return next;
        });
        return;
      }

      setCursorsState((prev) => ({
        ...prev,
        [userId]: {
          userId,
          color,
          position,
          lastSeenAt: now,
          staleSince: null,
        },
      }));
    },
    [],
  );

  const clearAllRemoteCursors = useCallback(() => {
    setCursorsState({});
  }, []);

  const emitCursor = useCallback(
    (position: CursorPosition | null) => {
      if (!socket || !callId || !isActive || !canSync) return;

      if (position === null) {
        if (throttleTimerRef.current) {
          clearTimeout(throttleTimerRef.current);
          throttleTimerRef.current = null;
        }
        pendingPositionRef.current = null;
        socket.emit("wb:cursor", { callId, position: null });
        return;
      }

      pendingPositionRef.current = position;

      const now = Date.now();
      const elapsed = now - lastEmitTimeRef.current;

      if (elapsed >= throttleMs) {
        if (throttleTimerRef.current) {
          clearTimeout(throttleTimerRef.current);
          throttleTimerRef.current = null;
        }
        lastEmitTimeRef.current = now;
        pendingPositionRef.current = null;
        socket.emit("wb:cursor", { callId, position });
        return;
      }

      if (throttleTimerRef.current) return;

      const remaining = throttleMs - elapsed;
      throttleTimerRef.current = setTimeout(() => {
        throttleTimerRef.current = null;
        lastEmitTimeRef.current = Date.now();
        const latestPosition = pendingPositionRef.current;
        pendingPositionRef.current = null;
        if (latestPosition) {
          socket.emit("wb:cursor", { callId, position: latestPosition });
        }
      }, remaining);
    },
    [socket, callId, isActive, canSync, throttleMs],
  );

  useEffect(() => {
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    lastEmitTimeRef.current = 0;
    pendingPositionRef.current = null;
    setCursorsState({});
  }, [callId, isActive, canSync]);

  useEffect(() => {
    if (!isActive) return;

    const intervalId = setInterval(() => {
      const now = Date.now();

      setCursorsState((prev) => {
        let hasChanges = false;
        const next: Record<UserID, RemoteCursorPresence> = {};

        for (const key of Object.keys(prev)) {
          const userId = Number(key) as UserID;
          if (Number.isNaN(userId)) continue;
          const cursor = prev[userId];
          const timeSinceLastSeen = now - cursor.lastSeenAt;

          if (cursor.staleSince !== null) {
            const staleDuration = now - cursor.staleSince;
            if (staleDuration >= removeGraceMs) {
              hasChanges = true;
              continue;
            }
          }

          if (timeSinceLastSeen >= ttlMs && cursor.staleSince === null) {
            hasChanges = true;
            next[userId] = { ...cursor, staleSince: now };
          } else {
            next[userId] = cursor;
          }
        }

        return hasChanges || Object.keys(next).length !== Object.keys(prev).length ? next : prev;
      });
    }, CLEANUP_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [isActive, ttlMs, removeGraceMs]);

  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, []);

  const remoteCursors = Object.values(cursorsState);

  return {
    remoteCursors,
    handleRemoteCursor,
    emitCursor,
    clearAllRemoteCursors,
  };
}
