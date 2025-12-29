import { useMemo, useState, useCallback, useEffect } from "react";
import { RTCContext } from "@/contexts/rtcContext";
import type {
  RTCContextValue,
  RemoteStreamsMap,
  ConnectionStatesMap,
  ErrorStatesMap,
} from "@/types/rtc.type";
import { useMeshManager } from "@/hooks/rtc/useMeshManager";
import { useMedia } from "@/hooks/context/useMedia";

/**
 * Provides WebRTC state and actions for a call session.
 * Manages the MeshRTCManager instance and exposes remote streams.
 */
interface RTCProviderProps {
  children: React.ReactNode;
  callId: string | null;
}

export function RTCProvider({ children, callId }: RTCProviderProps): React.JSX.Element {
  // Get userStream from MediaProvider for sync
  const { userStream } = useMedia();

  // State for remote streams and connection statuses must be defined before callbacks
  const [remoteStreams] = useState<RemoteStreamsMap>(() => new Map());
  const [connectionStates] = useState<ConnectionStatesMap>(() => new Map());
  const [errorStates] = useState<ErrorStatesMap>(() => new Map());

  // Track manager ready state to trigger re-render for dependent effects
  const [isManagerReady, setIsManagerReady] = useState(false);

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
      console.log("[RTCProvider] Peer removed, cleaned up state for userId:", userId);
    },
    [remoteStreams, connectionStates, errorStates, invalidate]
  );

  // Manager lifecycle with callbacks
  const manager = useMeshManager(
    callId,
    handleTrackUpdate,
    handleConnectionStateChange,
    handleIceConnectionStateChange,
    handlePeerRemoved,
    handleManagerReady
  );

  // Sync userStream from MediaProvider to MeshRTCManager (manual sync, not autoSyncMesh)
  useEffect(() => {
    if (!manager.current) return;
    void manager.current.setLocalStream(userStream);
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
      isManagerReady,
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
      getRemoteStream,
      getConnectionState,
      getErrorState,
    ]
  );

  return <RTCContext.Provider value={value}>{children}</RTCContext.Provider>;
}
