import { useEffect, useRef } from "react";
import { MeshRTCManager } from "@/lib/videocall/webrtcManager";
import { parsePeerId } from "@/utils/helper.util";

/**
 * Custom hook to manage MeshRTCManager lifecycle.
 * Initializes the manager when callId is present, cleans up when null or unmount.
 *
 * @param callId - The active call ID (null when not in a call)
 * @param onTrackUpdate - Callback when remote track is received (userId, stream)
 * @param onConnectionStateChange - Callback when peer connection state changes (userId, state)
 * @param onIceConnectionStateChange - Callback when ICE connection state changes (userId, state)
 * @param onPeerRemoved - Callback when peer is removed (userId)
 * @param onReady - Callback when manager ready state changes (true = ready, false = not ready)
 * @returns Ref to the MeshRTCManager instance (null when not initialized)
 */
export function useMeshManager(
  callId: string | null,
  onTrackUpdate: (userId: number, stream: MediaStream | null) => void,
  onConnectionStateChange: (userId: number, state: RTCPeerConnectionState) => void,
  onIceConnectionStateChange: (userId: number, state: RTCIceConnectionState) => void,
  onPeerRemoved: (userId: number) => void,
  onReady?: (ready: boolean) => void
) {
  const managerRef = useRef<MeshRTCManager | null>(null);

  useEffect(() => {
    // Guard: no callId means no active call, signal not ready and skip initialization
    if (!callId) {
      onReady?.(false);
      return;
    }

    // Hardcoded ICE servers for dev (STUN + TURN)
    const rtcConfig: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:global.relay.metered.ca:80",
          username: "2e443680734afc39881f13d1",
          credential: "Nf1eMJCl71r4alsd",
        },
        {
          urls: "turn:global.relay.metered.ca:80?transport=tcp",
          username: "2e443680734afc39881f13d1",
          credential: "Nf1eMJCl71r4alsd",
        },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: "2e443680734afc39881f13d1",
          credential: "Nf1eMJCl71r4alsd",
        },
        {
          urls: "turns:global.relay.metered.ca:443?transport=tcp",
          username: "2e443680734afc39881f13d1",
          credential: "Nf1eMJCl71r4alsd",
        },
      ],
    };

    // Initialize the MeshRTCManager instance with callbacks
    managerRef.current = new MeshRTCManager({
      rtcConfig,
      // Register callbacks that bridge manager events to React state updates
      onTrack: (peerId, stream) => {
        const userId = parsePeerId(peerId);
        onTrackUpdate(userId, stream);
        console.log("[useMeshManager] Track received from userId:", userId);
      },
      onPeerConnectionStateChange: (peerId, state) => {
        const userId = parsePeerId(peerId);
        onConnectionStateChange(userId, state);
        console.log("[useMeshManager] Connection state changed for userId:", userId, "state:", state);
      },
      onIceConnectionStateChange: (peerId, state) => {
        const userId = parsePeerId(peerId);
        onIceConnectionStateChange(userId, state);
        console.log("[useMeshManager] ICE connection state changed for userId:", userId, "state:", state);
      },
      onPeerRemoved: (peerId) => {
        const userId = parsePeerId(peerId);
        onPeerRemoved(userId);
        console.log("[useMeshManager] Peer removed for userId:", userId);
      },
    });
    console.log("[useMeshManager] Manager initialized for callId:", callId, managerRef.current);

    // Signal manager is ready
    onReady?.(true);

    // Cleanup: disconnect all peers and clear manager reference
    return () => {
      if (managerRef.current) {
        managerRef.current.disconnectAll();
        console.log("[useMeshManager] Manager disposed for callId:", callId);
        managerRef.current = null;
      }
      onReady?.(false);
    };
  }, [callId, onTrackUpdate, onConnectionStateChange, onIceConnectionStateChange, onPeerRemoved, onReady]);

  return managerRef;
}
