import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { RTCContext } from "@/features/call/providers/rtc/rtcContext";
import type {
  RTCContextValue,
  RemoteStreamsMap,
  ConnectionStatesMap,
  ErrorStatesMap,
  CallCandidatePayload,
} from "@/features/call/types/rtc.type";
import { useMeshManager } from "@/features/call/hooks/rtc/useMeshManager";
import { useMediaStore, selectUserStream } from "@/features/call/stores/mediaStore";
import useSocket from "@/hooks/context/useSocket";

/**
 * Provides WebRTC state and actions for a call session.
 * Manages the MeshRTCManager instance and exposes remote streams.
 */
interface RTCProviderProps {
  children: React.ReactNode;
  callId: string | null;
  currentUserId: number | null;
}

export function RTCProvider({ children, callId, currentUserId }: RTCProviderProps): React.JSX.Element {
  // Get userStream from media store for sync
  const userStream = useMediaStore(selectUserStream);
  // Get socket for emitting ICE candidates
  const { socket } = useSocket();

  // Use refs for socket and callId to avoid recreating manager on every change
  const socketRef = useRef(socket);
  const callIdRef = useRef(callId);
  const currentUserIdRef = useRef(currentUserId);
  socketRef.current = socket;
  callIdRef.current = callId;
  currentUserIdRef.current = currentUserId;

  // State for remote streams and connection statuses must be defined before callbacks
  const [remoteStreams] = useState<RemoteStreamsMap>(() => new Map());
  const [connectionStates] = useState<ConnectionStatesMap>(() => new Map());
  const [errorStates] = useState<ErrorStatesMap>(() => new Map());

  // Track manager ready state to trigger re-render for dependent effects
  const [isManagerReady, setIsManagerReady] = useState(false);

  // Track when local stream has been synced to manager (required before creating offers)
  const [isLocalStreamSynced, setIsLocalStreamSynced] = useState(false);

  // Version counter for force re-render when Maps are mutated
  const [version, setVersion] = useState(0);
  const invalidate = useCallback(() => setVersion((v) => v + 1), []);

  // Stable callback for manager ready state changes
  const handleManagerReady = useCallback((ready: boolean) => {
    setIsManagerReady(ready);
  }, []);

  // Callback handlers for MeshRTCManager events (defined before passing to hook)
  const handleTrackUpdate = useCallback(
    (userId: number, stream: MediaStream | null) => {
      remoteStreams.set(userId, stream);
      invalidate();
    },
    [remoteStreams, invalidate]
  );

  const handleConnectionStateChange = useCallback(
    (userId: number, state: RTCPeerConnectionState) => {
      connectionStates.set(userId, state);
      invalidate();
      if (state === "failed") {
        errorStates.set(userId, "Connection failed");
        invalidate();
      }
    },
    [connectionStates, errorStates, invalidate]
  );

  const handleIceConnectionStateChange = useCallback(
    (userId: number, state: RTCIceConnectionState) => {
      if (state === "failed") {
        errorStates.set(userId, "ICE connection failed");
        invalidate();
      } else if (state === "disconnected") {
        errorStates.set(userId, "Connection lost");
        invalidate();
      } else if (state === "connected" || state === "completed") {
        errorStates.delete(userId);
        invalidate();
      }
    },
    [errorStates, invalidate]
  );

  const handlePeerRemoved = useCallback(
    (userId: number) => {
      // Cleanup all state for this peer to prevent memory leaks and stale data
      remoteStreams.delete(userId);
      connectionStates.delete(userId);
      errorStates.delete(userId);
      invalidate();
    },
    [remoteStreams, connectionStates, errorStates, invalidate]
  );

  // Handle ICE candidate: emit to signaling server
  // Uses refs to avoid recreating callback when socket/callId/currentUserId change
  const handleIceCandidate = useCallback((peerId: string, candidate: RTCIceCandidate) => {
    const currentSocket = socketRef.current;
    const currentCallId = callIdRef.current;
    const userId = currentUserIdRef.current;

    if (!currentSocket || !currentCallId || userId === null) {
      console.warn("[RTCProvider] Cannot emit ICE candidate: socket/callId/userId not ready");
      return;
    }

    // Parse toUserId from peerId (format: "callId_userId")
    const parts = peerId.split("_");
    const toUserId = parseInt(parts[1], 10);

    const payload: CallCandidatePayload = {
      callId: currentCallId,
      fromUserId: userId,
      toUserId,
      candidate: candidate.toJSON(),
    };
    currentSocket.emit("call:candidate", payload);
  }, []);

  // Manager lifecycle with callbacks
  const manager = useMeshManager({
    callId,
    onTrackUpdate: handleTrackUpdate,
    onConnectionStateChange: handleConnectionStateChange,
    onIceConnectionStateChange: handleIceConnectionStateChange,
    onPeerRemoved: handlePeerRemoved,
    onIceCandidate: handleIceCandidate,
    onReady: handleManagerReady,
  });

  // Sync userStream from MediaProvider to MeshRTCManager (manual sync, not autoSyncMesh)
  // Set isLocalStreamSynced flag after sync to gate offer creation
  useEffect(() => {
    if (!manager.current) {
      setIsLocalStreamSynced(false);
      return;
    }

    // Sync the stream and mark as synced when done
    void manager.current.setLocalStream(userStream).then(() => {
      // Only mark as synced if we have a stream (tracks attached)
      // This ensures offers are only created after tracks are ready
      setIsLocalStreamSynced(userStream !== null);
    });
  }, [userStream, manager]);

  // Stable helper to get a remote stream for a specific user
  const getRemoteStream = useCallback(
    (userId: number): MediaStream | null => {
      return remoteStreams.get(userId) ?? null;
    },
    [remoteStreams]
  );

  // Stable helper to get a connection state for a specific user
  const getConnectionState = useCallback(
    (userId: number): RTCPeerConnectionState | null => {
      return connectionStates.get(userId) ?? null;
    },
    [connectionStates]
  );

  // Stable helper to get an error state for a specific user
  const getErrorState = useCallback(
    (userId: number): string | null => {
      return errorStates.get(userId) ?? null;
    },
    [errorStates]
  );

  // Memoize the context value to prevent unnecessary re-renders for consumers
  const value = useMemo<RTCContextValue>(
    () => ({
      remoteStreams,
      connectionStates,
      errorStates,
      remoteStreamsVersion: version,
      isManagerReady,
      isLocalStreamSynced,
      getManager: () => manager.current,
      getRemoteStream,
      getConnectionState,
      getErrorState,
    }),
    [
      version, // cache buster: force new object when map mutate
      manager,
      remoteStreams,
      connectionStates,
      errorStates,
      isManagerReady,
      isLocalStreamSynced,
      getRemoteStream,
      getConnectionState,
      getErrorState,
    ]
  );

  return <RTCContext.Provider value={value}>{children}</RTCContext.Provider>;
}
