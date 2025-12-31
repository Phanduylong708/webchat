import { useEffect, useRef } from "react";
import { MeshRTCManager } from "@/lib/videocall/webrtcManager";
import { parsePeerId } from "@/utils/helper.util";
import type { UseMeshManagerParams } from "@/types/rtc.type";

/**
 * Custom hook to manage MeshRTCManager lifecycle.
 * Initializes the manager when callId is present, cleans up when null or unmount.
 *
 * @returns Ref to the MeshRTCManager instance (null when not initialized)
 */
export function useMeshManager({
  callId,
  onTrackUpdate,
  onConnectionStateChange,
  onIceConnectionStateChange,
  onPeerRemoved,
  onIceCandidate,
  onReady,
}: UseMeshManagerParams) {
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
      },
      onPeerConnectionStateChange: (peerId, state) => {
        const userId = parsePeerId(peerId);
        onConnectionStateChange(userId, state);
      },
      onIceConnectionStateChange: (peerId, state) => {
        const userId = parsePeerId(peerId);
        onIceConnectionStateChange(userId, state);
      },
      onPeerRemoved: (peerId) => {
        const userId = parsePeerId(peerId);
        onPeerRemoved(userId);
      },
      // Register onIceCandidate at construction to ensure it's set before ICE gathering starts
      onIceCandidate: (peerId, candidate) => {
        onIceCandidate(peerId, candidate);
      },
    });

    // Signal manager is ready
    onReady?.(true);

    // Cleanup: disconnect all peers and clear manager reference
    return () => {
      if (managerRef.current) {
        managerRef.current.disconnectAll();
        managerRef.current = null;
      }
      onReady?.(false);
    };
  }, [callId, onTrackUpdate, onConnectionStateChange, onIceConnectionStateChange, onPeerRemoved, onIceCandidate, onReady]);

  return managerRef;
}
