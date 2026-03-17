import { useEffect, useRef } from "react";
import { MeshRTCManager } from "@/lib/videocall/webrtcManager";
import { parsePeerId } from "@/utils/helper.util";
import type { UseMeshManagerParams } from "@/types/rtc.type";

function getRTCConfig(): RTCConfiguration {
  try {
    return JSON.parse(import.meta.env.VITE_ICE) as RTCConfiguration;
  } catch (error) {
    console.error("[useMeshManager] Invalid VITE_ICE config", error);
    return { iceServers: [] };
  }
}

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
      console.debug("[useMeshManager] skip init: missing callId");
      onReady?.(false);
      return;
    }

    const rtcConfig = getRTCConfig();

    // Initialize the MeshRTCManager instance with callbacks
    console.debug("[useMeshManager] creating manager", { callId });
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
        console.debug("[useMeshManager] disposing manager", { callId });
        managerRef.current.disconnectAll();
        managerRef.current = null;
      }
      onReady?.(false);
    };
  }, [callId, onTrackUpdate, onConnectionStateChange, onIceConnectionStateChange, onPeerRemoved, onIceCandidate, onReady]);

  return managerRef;
}
