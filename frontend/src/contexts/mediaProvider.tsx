import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MediaContext } from "@/contexts/mediaContext";
import type {
  MediaContextValue,
  StartScreenShareOptions,
} from "@/types/media.type";
import { MediaStreamManager } from "@/lib/videocall/mediaStreamManager";
import type {
  NormalizedMediaError,
  UserMediaOptions,
} from "@/lib/videocall/mediaStreamManager";

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

  // Local helper to recompute mute flags from a given or current user stream
  const recomputeMute = useCallback((stream?: MediaStream | null): void => {
    const target =
      stream !== undefined
        ? stream
        : manager.current?.getUserStream?.() ?? null;
    setIsAudioMuted(isStreamMuted(target, "audio"));
    setIsVideoMuted(isStreamMuted(target, "video"));
  }, []);

  // Simple error setter helper
  const setError = useCallback(
    (
      code: NormalizedMediaError["code"],
      message: string,
      cause?: unknown
    ): void => {
      setLastError({ code, message, cause });
    },
    []
  );

  // Sync selected device ids from manager
  const syncSelected = useCallback((): void => {
    const ids = manager.current?.getSelectedDevices?.();
    if (!ids) return;
    setSelectedDevices((prev) => ({
      ...prev,
      audioInput: ids.audioInput,
      videoInput: ids.videoInput,
      audioOutput: ids.audioOutput ?? prev.audioOutput,
    }));
  }, []);

  // Busy guards
  const withUserBusy = useCallback(
    async (fn: (mgr: MediaStreamManager) => Promise<void>): Promise<void> => {
      if (initError || !manager.current) {
        setError(
          "unsupported",
          initError || "Media manager not initialized or unsupported"
        );
        return;
      }
      if (isStartingUserMedia) return;
      setIsStartingUserMedia(true);
      try {
        await fn(manager.current);
      } catch (err) {
        setError(
          "unknown",
          (err as Error)?.message || "start user media failed",
          err
        );
      } finally {
        setIsStartingUserMedia(false);
      }
    },
    [initError, isStartingUserMedia, setError]
  );

  const withScreenBusy = useCallback(
    async (fn: (mgr: MediaStreamManager) => Promise<void>): Promise<void> => {
      if (initError || !manager.current) {
        setError(
          "unsupported",
          initError || "Media manager not initialized or unsupported"
        );
        return;
      }
      if (isStartingScreenShare) return;
      setIsStartingScreenShare(true);
      try {
        await fn(manager.current);
      } catch (err) {
        setError(
          "unknown",
          (err as Error)?.message || "screen share failed",
          err
        );
      } finally {
        setIsStartingScreenShare(false);
      }
    },
    [initError, isStartingScreenShare, setError]
  );

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
              recomputeMute(stream);
              // Sync selected device ids when user media changes
              syncSelected();
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
              recomputeMute();
            }
          },
          onMute: (_kind, source) => {
            if (source === "user") {
              recomputeMute();
            }
          },
          onUnmute: (_kind, source) => {
            if (source === "user") {
              recomputeMute();
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
  }, [recomputeMute, syncSelected]);

  // Actions: start/stop/restart user media
  const startUserMedia = useCallback(
    async (options?: UserMediaOptions): Promise<void> => {
      const merged: UserMediaOptions = options ?? { audio: true, video: true };
      await withUserBusy(async (mgr) => {
        const stream = await mgr.startUserMedia(merged);
        // Immediate state sync from returned stream
        setUserStream(stream);
        recomputeMute(stream);
        syncSelected();
      });
    },
    [withUserBusy, recomputeMute, syncSelected]
  );

  const stopUserMedia = useCallback((): void => {
    if (initError || !manager.current) {
      setError(
        "unsupported",
        initError || "Media manager not initialized or unsupported"
      );
      return;
    }
    try {
      manager.current.stopUserMedia();
    } catch (err) {
      setError(
        "unknown",
        (err as Error)?.message || "stop user media failed",
        err
      );
    }
    // Reflect in state regardless
    setUserStream(null);
    recomputeMute(null);
    // Keep selectedDevices unchanged per plan
  }, [initError, setError, recomputeMute]);

  const restartUserMedia = useCallback(
    async (options?: UserMediaOptions): Promise<void> => {
      const merged: UserMediaOptions = options ?? { audio: true, video: true };
      await withUserBusy(async (mgr) => {
        const stream = await mgr.restartUserMedia(merged);
        setUserStream(stream);
        recomputeMute(stream);
        syncSelected();
      });
    },
    [withUserBusy, recomputeMute, syncSelected]
  );

  // Actions: toggle audio/video
  const toggleAudio = useCallback(async (): Promise<void> => {
    if (initError || !manager.current) {
      setError(
        "unsupported",
        initError || "Media manager not initialized or unsupported"
      );
      return;
    }
    const current = manager.current.getUserStream?.() ?? null;
    if (!current) {
      // Auto-start minimal audio-only
      await withUserBusy(async (mgr) => {
        const stream = await mgr.startUserMedia({ audio: true, video: false });
        setUserStream(stream);
        recomputeMute(stream);
        syncSelected();
      });
      return;
    }

    const audioTracks = current.getAudioTracks();
    if (audioTracks.length === 0) {
      // No-op if no audio track in current stream
      return;
    }
    const shouldEnable = isStreamMuted(current, "audio");
    for (const t of audioTracks) t.enabled = shouldEnable;
    // reflect immediately
    recomputeMute(current);
  }, [initError, setError, withUserBusy, recomputeMute, syncSelected]);

  const toggleVideo = useCallback(async (): Promise<void> => {
    if (initError || !manager.current) {
      setError(
        "unsupported",
        initError || "Media manager not initialized or unsupported"
      );
      return;
    }
    const current = manager.current.getUserStream?.() ?? null;
    if (!current) {
      // Auto-start minimal video-only
      await withUserBusy(async (mgr) => {
        const stream = await mgr.startUserMedia({ audio: false, video: true });
        setUserStream(stream);
        recomputeMute(stream);
        syncSelected();
      });
      return;
    }

    const videoTracks = current.getVideoTracks();
    if (videoTracks.length === 0) {
      // No-op if no video track in current stream
      return;
    }
    const shouldEnable = isStreamMuted(current, "video");
    for (const t of videoTracks) t.enabled = shouldEnable;
    recomputeMute(current);
  }, [initError, setError, withUserBusy, recomputeMute, syncSelected]);

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
      // Actions (implemented)
      startUserMedia,
      stopUserMedia,
      restartUserMedia,
      toggleAudio,
      toggleVideo,
      // Stubs to be implemented gradually
      switchCamera: async () => {},
      switchMicrophone: async () => {},
      enumerateDevices: async () => {
        return (
          devices ?? { audioInputs: [], videoInputs: [], audioOutputs: [] }
        );
      },
      startScreenShare: async (_opts?: StartScreenShareOptions) => {},
      stopScreenShare: () => {},
      setAudioOutput: () => {},
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
    startUserMedia,
    stopUserMedia,
    restartUserMedia,
    toggleAudio,
    toggleVideo,
  ]);

  return (
    <MediaContext.Provider value={value}>{children}</MediaContext.Provider>
  );
}
