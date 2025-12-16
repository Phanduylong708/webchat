import { useEffect, useMemo, useRef, useState } from "react";
import { MediaContext } from "@/contexts/mediaContext";
import type { MediaContextValue } from "@/types/media.type";
import { MediaStreamManager } from "@/lib/videocall/mediaStreamManager";

/** Inline helper: derive mute flag from a stream for a given kind (audio/video). */
function isStreamMuted(
  stream: MediaStream | null,
  kind: "audio" | "video"
): boolean {
  if (!stream) return true;
  const tracks = stream.getTracks().filter((t) => t.kind === kind);
  if (tracks.length === 0) return true;
  return tracks.every((t) => !t.enabled);
}

/**
 * MediaProvider (Step 2: state wiring)
 * - Initializes MediaStreamManager safely (no Mesh auto-sync yet)
 * - Guards tests/unsupported env (no navigator.mediaDevices)
 * - Wires manager callbacks into React state
 * - Cleans up on unmount
 */
export function MediaProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const manager = useRef<MediaStreamManager | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // Step 2: state fields
  const [userStream, setUserStream] =
    useState<MediaContextValue["userStream"]>(null);
  const [screenStream, setScreenStream] =
    useState<MediaContextValue["screenStream"]>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(true);
  const [devices, setDevices] = useState<MediaContextValue["devices"]>(null);
  const [selectedDevices, setSelectedDevices] = useState<
    MediaContextValue["selectedDevices"]
  >({});
  const [lastError, setLastError] =
    useState<MediaContextValue["lastError"]>(null);
  const [isStartingUserMedia, setIsStartingUserMedia] =
    useState<boolean>(false);
  const [isStartingScreenShare, setIsStartingScreenShare] =
    useState<boolean>(false);

  // Local helper to recompute mute flags from current manager's user stream
  const recomputeMuteFromCurrent = () => {
    const current = manager.current?.getUserStream?.() ?? null;
    setIsAudioMuted(isStreamMuted(current, "audio"));
    setIsVideoMuted(isStreamMuted(current, "video"));
  };

  useEffect(() => {
    // Guard: missing mediaDevices
    const hasNavigator = typeof navigator !== "undefined";
    const hasMedia = hasNavigator && !!navigator.mediaDevices;

    if (!hasMedia) {
      setInitError(
        "MediaDevices is not available in this environment (tests or unsupported browser)."
      );
      manager.current = null;
      return; // no manager instance created
    }

    // Initialize once
    if (!manager.current) {
      manager.current = new MediaStreamManager({
        autoSyncMesh: false,
        callbacks: {
          onStreamUpdated: (stream, source) => {
            if (source === "user") {
              setUserStream(stream);
              // Recompute mutes based on provided stream
              setIsAudioMuted(isStreamMuted(stream, "audio"));
              setIsVideoMuted(isStreamMuted(stream, "video"));
              // Sync selected device ids when user media changes
              const ids = manager.current?.getSelectedDevices?.();
              if (ids) {
                setSelectedDevices({
                  audioInput: ids.audioInput,
                  videoInput: ids.videoInput,
                  audioOutput: ids.audioOutput,
                });
              }
            } else if (source === "screen") {
              setScreenStream(stream);
            }
          },
          onDeviceChange: (d) => {
            setDevices(d);
          },
          onTrackEnded: (_kind, source) => {
            if (source === "screen") {
              setScreenStream(null);
              setIsStartingScreenShare(false);
            }
            // Keep mute flags in sync for user stream
            if (source === "user") {
              recomputeMuteFromCurrent();
            }
          },
          onMute: (_kind, source) => {
            if (source === "user") {
              recomputeMuteFromCurrent();
            }
          },
          onUnmute: (_kind, source) => {
            if (source === "user") {
              recomputeMuteFromCurrent();
            }
          },
          onError: (err) => {
            setLastError(err);
          },
        },
      });
    }

    // Cleanup on unmount
    return () => {
      if (manager.current) {
        try {
          manager.current.dispose();
        } catch {
          // ignore
        }
        manager.current = null;
      }
    };
  }, []);

  const value = useMemo<MediaContextValue>(() => {
    return {
      initError,
      getManager: () => manager.current,
      userStream,
      screenStream,
      isAudioMuted,
      isVideoMuted,
      devices,
      selectedDevices,
      lastError,
      isStartingUserMedia,
      isStartingScreenShare,
    };
  }, [
    initError,
    userStream,
    screenStream,
    isAudioMuted,
    isVideoMuted,
    devices,
    selectedDevices,
    lastError,
    isStartingUserMedia,
    isStartingScreenShare,
  ]);

  return (
    <MediaContext.Provider value={value}>{children}</MediaContext.Provider>
  );
}
