import { useEffect, useRef, useCallback } from "react";
import type { MeshRTCManager } from "@/lib/videocall/webrtcManager";

interface UseScreenShareRTCParams {
  getManager: () => MeshRTCManager | null;
  isManagerReady: boolean;
  userStream: MediaStream | null;
  screenStream: MediaStream | null;
  stopScreenShare: () => void;
}

// Manages screen share track swapping via setLocalStream
// When screen share starts: constructs outbound stream (mixed audio + screen video)
// When screen share stops: restores original userStream
export function useScreenShareRTC({
  getManager,
  isManagerReady,
  userStream,
  screenStream,
  stopScreenShare,
}: UseScreenShareRTCParams): void {
  // Audio mixing resources for cleanup
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);

  // Guard against double stop (user click + track.onended race)
  const stopRequestedRef = useRef(false);

  // Stable ref for stopScreenShare to avoid effect re-runs
  const stopScreenShareRef = useRef(stopScreenShare);
  stopScreenShareRef.current = stopScreenShare;

  // Cleanup mixed audio resources (AudioContext + mixed-only tracks)
  const cleanupMixing = useCallback(() => {
    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Stop mixed-only tracks (not original userStream/screenStream tracks)
    if (mixedStreamRef.current) {
      const mixedTracks = mixedStreamRef.current.getTracks();
      for (const track of mixedTracks) {
        // Only stop if it's a destination track (created by AudioContext)
        // Original tracks have different ids than mixed destination tracks
        if (track.label === "" || track.label.includes("MediaStreamAudioDestinationNode")) {
          track.stop();
        }
      }
      mixedStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    const manager = getManager();
    if (!isManagerReady || !manager) return;

    // Screen share started
    if (screenStream) {
      // Reset stop guard for new session
      stopRequestedRef.current = false;

      // Cleanup previous mixing resources before creating new ones
      cleanupMixing();

      const screenVideoTrack = screenStream.getVideoTracks()[0];
      if (!screenVideoTrack) return;

      // Build outbound stream for peers
      const outboundTracks: MediaStreamTrack[] = [screenVideoTrack];

      // Get mic audio from userStream (if exists)
      const micTrack = userStream?.getAudioTracks()[0] ?? null;
      const screenAudioTrack = screenStream.getAudioTracks()[0] ?? null;

      // Audio mixing: mic + screen audio (if present)
      if (micTrack || screenAudioTrack) {
        try {
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;

          const destination = audioContext.createMediaStreamDestination();

          // Connect mic if present
          if (micTrack) {
            const micSource = audioContext.createMediaStreamSource(new MediaStream([micTrack]));
            micSource.connect(destination);
          }

          // Connect screen audio if present
          if (screenAudioTrack) {
            const screenSource = audioContext.createMediaStreamSource(new MediaStream([screenAudioTrack]));
            screenSource.connect(destination);
          }

          // Use mixed audio track
          const mixedAudioTrack = destination.stream.getAudioTracks()[0];
          if (mixedAudioTrack) {
            outboundTracks.push(mixedAudioTrack);
          }
        } catch (err) {
          console.error("[useScreenShareRTC] Audio mixing failed:", err);
          // Fallback: use mic only
          if (micTrack) {
            outboundTracks.push(micTrack);
          }
        }
      }

      // Construct outbound stream and set to manager
      const outboundStream = new MediaStream(outboundTracks);
      mixedStreamRef.current = outboundStream;

      manager.setLocalStream(outboundStream).catch((err) => {
        console.error("[useScreenShareRTC] Failed to set screen share stream:", err);
      });

      // Handle browser "Stop sharing" button with double-stop guard
      const handleTrackEnded = () => {
        if (stopRequestedRef.current) return;
        stopRequestedRef.current = true;
        stopScreenShareRef.current();
      };
      screenVideoTrack.addEventListener("ended", handleTrackEnded);

      // Cleanup for this effect run
      return () => {
        screenVideoTrack.removeEventListener("ended", handleTrackEnded);
        cleanupMixing();
      };
    }

    // Screen share stopped - restore userStream (or null)
    if (!screenStream) {
      stopRequestedRef.current = true;
      cleanupMixing();

      // Always restore - manager handles null case
      manager.setLocalStream(userStream).catch((err) => {
        console.error("[useScreenShareRTC] Failed to restore user stream:", err);
      });
    }
  }, [getManager, isManagerReady, userStream, screenStream, cleanupMixing]);
}
