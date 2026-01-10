import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MediaContext } from "@/contexts/mediaContext";
import type { MediaContextValue } from "@/types/media.type";
import { MediaStreamManager } from "@/lib/videocall/mediaStreamManager";
import type { NormalizedMediaError, UserMediaOptions } from "@/lib/videocall/mediaStreamManager";

/** Inline helper: derive mute flag from a stream for a given kind (audio/video). */
function isStreamMuted(stream: MediaStream | null, kind: "audio" | "video"): boolean {
  if (!stream) return true;
  const tracks = stream.getTracks().filter((t) => t.kind === kind);
  if (tracks.length === 0) return true;
  return tracks.every((t) => !t.enabled);
}

export function MediaProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const manager = useRef<MediaStreamManager | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [isManagerReady, setIsManagerReady] = useState<boolean>(false);

  const [userStream, setUserStream] = useState<MediaContextValue["userStream"]>(null);
  const [screenStream, setScreenStream] = useState<MediaContextValue["screenStream"]>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(true);
  const [devices, setDevices] = useState<MediaContextValue["devices"]>(null);
  const [selectedDevices, setSelectedDevices] = useState<MediaContextValue["selectedDevices"]>({});
  const [lastError, setLastError] = useState<MediaContextValue["lastError"]>(null);
  const [isStartingUserMedia, setIsStartingUserMedia] = useState<boolean>(false);
  const [isStartingScreenShare, setIsStartingScreenShare] = useState<boolean>(false);

  // Local helper to recompute mute flags from a given or current user stream
  const recomputeMute = useCallback((stream?: MediaStream | null): void => {
    const target = stream !== undefined ? stream : manager.current?.getUserStream?.() ?? null;
    setIsAudioMuted(isStreamMuted(target, "audio"));
    setIsVideoMuted(isStreamMuted(target, "video"));
  }, []);

  // Simple error setter helper
  const setError = useCallback(
    (code: NormalizedMediaError["code"], message: string, cause?: unknown): void => {
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
        setError("unsupported", initError || "Media manager not initialized or unsupported");
        return;
      }
      if (isStartingUserMedia) return;
      setIsStartingUserMedia(true);
      try {
        await fn(manager.current);
      } catch (err) {
        setError("unknown", (err as Error)?.message || "start user media failed", err);
      } finally {
        setIsStartingUserMedia(false);
      }
    },
    [initError, isStartingUserMedia, setError]
  );

  const withScreenBusy = useCallback(
    async (fn: (mgr: MediaStreamManager) => Promise<void>): Promise<void> => {
      if (initError || !manager.current) {
        setError("unsupported", initError || "Media manager not initialized or unsupported");
        return;
      }
      if (isStartingScreenShare) return;
      setIsStartingScreenShare(true);
      try {
        await fn(manager.current);
      } catch (err) {
        setError("unknown", (err as Error)?.message || "screen share failed", err);
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
      setInitError("MediaDevices is not available in this environment (tests or unsupported browser).");
      manager.current = null;
      setIsManagerReady(false);
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
      setIsManagerReady(true);
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
        setIsManagerReady(false);
      }
    };
  }, [recomputeMute, syncSelected]);

  // Actions: start/stop/restart user media
  const startUserMedia = useCallback(
    async (options?: UserMediaOptions): Promise<void> => {
      const merged: UserMediaOptions = options ?? { audio: true, video: true };
      await withUserBusy(async (mgr) => {
        await mgr.startUserMedia(merged);
        // State updates will come via onStreamUpdated callback
      });
    },
    [withUserBusy]
  );

  const stopUserMedia = useCallback((): void => {
    if (initError || !manager.current) {
      setError("unsupported", initError || "Media manager not initialized or unsupported");
      return;
    }
    try {
      manager.current.stopUserMedia();
    } catch (err) {
      setError("unknown", (err as Error)?.message || "stop user media failed", err);
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
        await mgr.restartUserMedia(merged);
        // State updates will come via onStreamUpdated callback
      });
    },
    [withUserBusy]
  );

  // Actions: toggle audio/video
  const toggleAudio = useCallback(async (): Promise<void> => {
    if (initError || !manager.current) {
      setError("unsupported", initError || "Media manager not initialized or unsupported");
      return;
    }
    const current = manager.current.getUserStream?.() ?? null;
    if (!current) {
      // Auto-start minimal audio-only
      await withUserBusy(async (mgr) => {
        await mgr.startUserMedia({ audio: true, video: false });
        // onStreamUpdated will sync state
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
  }, [initError, setError, withUserBusy, recomputeMute]);

  // TODO: Consider switching to "hard mute" for camera (stop video tracks) to release the device/LED; this
  // would require re-acquiring tracks on unmute and may add latency.
  const toggleVideo = useCallback(async (): Promise<void> => {
    if (initError || !manager.current) {
      setError("unsupported", initError || "Media manager not initialized or unsupported");
      return;
    }
    const current = manager.current.getUserStream?.() ?? null;
    if (!current) {
      // Auto-start minimal video-only
      await withUserBusy(async (mgr) => {
        await mgr.startUserMedia({ audio: false, video: true });
        // onStreamUpdated will sync state
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
  }, [initError, setError, withUserBusy, recomputeMute]);

  // Actions: switch devices
  const switchCamera = useCallback(
    async (deviceId: string): Promise<void> => {
      await withUserBusy(async (mgr) => {
        await mgr.switchCamera(deviceId);
        // Ensure mute state persists across new stream
        const s = manager.current?.getUserStream?.() ?? null;
        if (s) {
          if (isVideoMuted) {
            for (const t of s.getVideoTracks()) t.enabled = false;
          }
          if (isAudioMuted) {
            for (const t of s.getAudioTracks()) t.enabled = false;
          }
          recomputeMute(s);
        }
        // selectedDevices will be synced via onStreamUpdated; safe to merge again
        syncSelected();
      });
    },
    [withUserBusy, isAudioMuted, isVideoMuted, recomputeMute, syncSelected]
  );

  const switchMicrophone = useCallback(
    async (deviceId: string): Promise<void> => {
      await withUserBusy(async (mgr) => {
        await mgr.switchMicrophone(deviceId);
        const s = manager.current?.getUserStream?.() ?? null;
        if (s) {
          if (isAudioMuted) {
            for (const t of s.getAudioTracks()) t.enabled = false;
          }
          if (isVideoMuted) {
            for (const t of s.getVideoTracks()) t.enabled = false;
          }
          recomputeMute(s);
        }
        syncSelected();
      });
    },
    [withUserBusy, isAudioMuted, isVideoMuted, recomputeMute, syncSelected]
  );

  const startScreenShare = useCallback(async (): Promise<void> => {
    if (screenStream) {
      setError("unsupported", "Screen share already active");
      return;
    }
    await withScreenBusy(async (mgr) => {
      await mgr.startScreenShare({
        textDetailProfile: true,
        constraints: { audio: true },
      });
    });
  }, [screenStream, setError, withScreenBusy]);

  const stopScreenShare = useCallback((): void => {
    if (initError || !manager.current) {
      setError("unsupported", initError || "Media manager not initialized or unsupported");
      return;
    }
    manager.current.stopScreenShare();
    // State updates flow via onStreamUpdated callback
  }, [initError, setError]);

  // Derived state: videoSource based on screenStream
  const videoSource: "camera" | "screen" = screenStream ? "screen" : "camera";

  const value = useMemo<MediaContextValue>(() => {
    return {
      initError,
      isManagerReady,
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
      videoSource,
      // Actions (implemented)
      startUserMedia,
      stopUserMedia,
      restartUserMedia,
      toggleAudio,
      toggleVideo,
      switchCamera,
      switchMicrophone,
      // Stubs to be implemented gradually
      enumerateDevices: async () => {
        return devices ?? { audioInputs: [], videoInputs: [], audioOutputs: [] };
      },
      startScreenShare,
      stopScreenShare,
      setAudioOutput: () => {},
    };
  }, [
    initError,
    isManagerReady,
    userStream,
    screenStream,
    isAudioMuted,
    isVideoMuted,
    devices,
    selectedDevices,
    lastError,
    isStartingUserMedia,
    isStartingScreenShare,
    videoSource,
    startUserMedia,
    stopUserMedia,
    restartUserMedia,
    toggleAudio,
    toggleVideo,
    switchCamera,
    switchMicrophone,
    startScreenShare,
    stopScreenShare,
  ]);

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}
