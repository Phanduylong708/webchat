import { create } from "zustand";
import { MediaStreamManager } from "@/features/call/lib/media/mediaStreamManager";
import type { NormalizedMediaError, UserMediaOptions, EnumeratedDevices } from "@/features/call/lib/media/mediaStreamManager";
import type { SelectedDevices, VideoSource, StartScreenShareOptions } from "@/features/call/types/media.type";

// ---------------------------------------------------------------------------
// State & Actions interface
// ---------------------------------------------------------------------------

export interface MediaState {
  initError: string | null;
  isManagerReady: boolean;
  userStream: MediaStream | null;
  screenStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  devices: EnumeratedDevices | null;
  selectedDevices: SelectedDevices;
  lastError: NormalizedMediaError | null;
  isStartingUserMedia: boolean;
  isStartingScreenShare: boolean;

  initManager: () => void;
  disposeManager: () => void;
  getManager: () => MediaStreamManager | null;
  startUserMedia: (options?: UserMediaOptions) => Promise<void>;
  stopUserMedia: () => void;
  restartUserMedia: (options?: UserMediaOptions) => Promise<void>;
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  switchCamera: (deviceId: string) => Promise<void>;
  switchMicrophone: (deviceId: string) => Promise<void>;
  startScreenShare: (options?: StartScreenShareOptions) => Promise<void>;
  stopScreenShare: () => void;
  enumerateDevices: (requestPermissions?: boolean) => Promise<EnumeratedDevices>;
  setAudioOutput: (deviceId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isMuted(stream: MediaStream | null, kind: "audio" | "video"): boolean {
  if (!stream) return true;
  const tracks = stream.getTracks().filter((t) => t.kind === kind);
  return tracks.length === 0 || tracks.every((t) => !t.enabled);
}

// Kept outside store — survives resets, not reactive
let _manager: MediaStreamManager | null = null;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMediaStore = create<MediaState>((set, get) => {
  // --- Helpers closed over set/get ---

  const requireManager = (): MediaStreamManager | null => {
    const { initError } = get();
    if (initError || !_manager) {
      set({ lastError: { code: "unsupported", message: initError ?? "Media manager not initialized" } });
      return null;
    }
    return _manager;
  };

  const setError = (message: string, cause?: unknown): void => {
    set({ lastError: { code: "unknown", message, cause } });
  };

  const withUserBusy = async (fn: (mgr: MediaStreamManager) => Promise<void>): Promise<void> => {
    if (get().isStartingUserMedia) return;
    const mgr = requireManager();
    if (!mgr) return;
    set({ isStartingUserMedia: true });
    try { await fn(mgr); }
    catch (err) { setError((err as Error)?.message ?? "failed", err); }
    finally { set({ isStartingUserMedia: false }); }
  };

  const withScreenBusy = async (fn: (mgr: MediaStreamManager) => Promise<void>): Promise<void> => {
    if (get().isStartingScreenShare) return;
    const mgr = requireManager();
    if (!mgr) return;
    set({ isStartingScreenShare: true });
    try { await fn(mgr); }
    catch (err) { setError((err as Error)?.message ?? "failed", err); }
    finally { set({ isStartingScreenShare: false }); }
  };

  // Sync mute flags + selected device IDs from manager after stream change
  const syncMuteAndDevices = (stream: MediaStream): void => {
    const ids = _manager?.getSelectedDevices?.();
    set({
      isAudioMuted: isMuted(stream, "audio"),
      isVideoMuted: isMuted(stream, "video"),
      ...(ids && {
        selectedDevices: {
          ...get().selectedDevices,
          audioInput: ids.audioInput,
          videoInput: ids.videoInput,
          ...(ids.audioOutput && { audioOutput: ids.audioOutput }),
        },
      }),
    });
  };

  const syncMuteFromManager = (): void => {
    const stream = _manager?.getUserStream?.() ?? null;
    set({ isAudioMuted: isMuted(stream, "audio"), isVideoMuted: isMuted(stream, "video") });
  };

  // --- Store ---

  return {
    // Initial state
    initError: null,
    isManagerReady: false,
    userStream: null,
    screenStream: null,
    isAudioMuted: true,
    isVideoMuted: true,
    devices: null,
    selectedDevices: {},
    lastError: null,
    isStartingUserMedia: false,
    isStartingScreenShare: false,

    initManager: () => {
      if (_manager) return;
      if (typeof navigator === "undefined" || !navigator.mediaDevices) {
        set({ initError: "MediaDevices is not available in this environment.", isManagerReady: false });
        return;
      }
      _manager = new MediaStreamManager({
        autoSyncMesh: false,
        callbacks: {
          onStreamUpdated: (stream, source) => {
            if (source === "user") {
              set({ userStream: stream });
              if (stream) syncMuteAndDevices(stream);
              else set({ isAudioMuted: true, isVideoMuted: true });
            } else {
              set({ screenStream: stream });
            }
          },
          onDeviceChange: (devices) => set({ devices }),
          onTrackEnded: (_kind, source) => {
            if (source === "screen") set({ screenStream: null, isStartingScreenShare: false });
            if (source === "user") syncMuteFromManager();
          },
          onMute:   (_kind, source) => { if (source === "user") syncMuteFromManager(); },
          onUnmute: (_kind, source) => { if (source === "user") syncMuteFromManager(); },
          onError: (err) => set({ lastError: err }),
        },
      });
      set({ isManagerReady: true, initError: null });
    },

    disposeManager: () => {
      if (!_manager) return;
      try { _manager.dispose(); } catch { /* ignore */ }
      _manager = null;
      set({ isManagerReady: false, userStream: null, screenStream: null,
            isAudioMuted: true, isVideoMuted: true,
            isStartingUserMedia: false, isStartingScreenShare: false });
    },

    getManager: () => _manager,

    startUserMedia: (options) =>
      withUserBusy(async (mgr) => { await mgr.startUserMedia(options ?? { audio: true, video: true }); }),

    stopUserMedia: () => {
      const mgr = requireManager();
      if (!mgr) return;
      try { mgr.stopUserMedia(); }
      catch (err) { setError((err as Error)?.message ?? "stopUserMedia failed", err); }
      set({ userStream: null, isAudioMuted: true, isVideoMuted: true });
    },

    restartUserMedia: (options) =>
      withUserBusy(async (mgr) => { await mgr.restartUserMedia(options ?? { audio: true, video: true }); }),

    toggleAudio: async () => {
      const { userStream } = get();
      if (!userStream) return withUserBusy(async (mgr) => { await mgr.startUserMedia({ audio: true, video: false }); });
      const tracks = userStream.getAudioTracks();
      if (!tracks.length) return;
      const enable = isMuted(userStream, "audio");
      for (const t of tracks) t.enabled = enable;
      set({ isAudioMuted: !enable });
    },

    toggleVideo: async () => {
      const { userStream } = get();
      if (!userStream) return withUserBusy(async (mgr) => { await mgr.startUserMedia({ audio: false, video: true }); });
      const tracks = userStream.getVideoTracks();
      if (!tracks.length) return;
      const enable = isMuted(userStream, "video");
      for (const t of tracks) t.enabled = enable;
      set({ isVideoMuted: !enable });
    },

    switchCamera: (deviceId) =>
      withUserBusy(async (mgr) => {
        await mgr.switchCamera(deviceId);
        const stream = mgr.getUserStream?.() ?? null;
        if (!stream) return;
        const { isAudioMuted, isVideoMuted } = get();
        if (isVideoMuted) for (const t of stream.getVideoTracks()) t.enabled = false;
        if (isAudioMuted) for (const t of stream.getAudioTracks()) t.enabled = false;
        syncMuteAndDevices(stream);
      }),

    switchMicrophone: (deviceId) =>
      withUserBusy(async (mgr) => {
        await mgr.switchMicrophone(deviceId);
        const stream = mgr.getUserStream?.() ?? null;
        if (!stream) return;
        const { isAudioMuted, isVideoMuted } = get();
        if (isAudioMuted) for (const t of stream.getAudioTracks()) t.enabled = false;
        if (isVideoMuted) for (const t of stream.getVideoTracks()) t.enabled = false;
        syncMuteAndDevices(stream);
      }),

    startScreenShare: (options?: StartScreenShareOptions) =>
      withScreenBusy(async (mgr) => {
        if (get().screenStream) {
          set({ lastError: { code: "unsupported", message: "Screen share already active" } });
          return;
        }
        await mgr.startScreenShare({
          textDetailProfile: options?.textDetailProfile ?? true,
          constraints: { audio: options?.withAudio !== false },
        });
      }),

    stopScreenShare: () => {
      const mgr = requireManager();
      if (!mgr) return;
      mgr.stopScreenShare();
    },

    enumerateDevices: async (requestPermissions) => {
      const fallback = get().devices ?? { audioInputs: [], videoInputs: [], audioOutputs: [] };
      if (!_manager) return fallback;
      try { return await _manager.getDevices(requestPermissions); }
      catch { return fallback; }
    },

    setAudioOutput: (deviceId) =>
      set((s) => ({ selectedDevices: { ...s.selectedDevices, audioOutput: deviceId } })),
  };
});

// ---------------------------------------------------------------------------
// Granular selectors — use in components to avoid over-subscribing
// ---------------------------------------------------------------------------

export const selectUserStream         = (s: MediaState) => s.userStream;
export const selectScreenStream       = (s: MediaState) => s.screenStream;
export const selectIsAudioMuted       = (s: MediaState) => s.isAudioMuted;
export const selectIsVideoMuted       = (s: MediaState) => s.isVideoMuted;
export const selectIsManagerReady     = (s: MediaState) => s.isManagerReady;
export const selectInitError          = (s: MediaState) => s.initError;
export const selectIsStartingUserMedia   = (s: MediaState) => s.isStartingUserMedia;
export const selectIsStartingScreenShare = (s: MediaState) => s.isStartingScreenShare;
export const selectDevices            = (s: MediaState) => s.devices;
export const selectSelectedDevices    = (s: MediaState) => s.selectedDevices;
export const selectLastError          = (s: MediaState) => s.lastError;
export const selectVideoSource        = (s: MediaState): VideoSource =>
  s.screenStream ? "screen" : "camera";

// Action selectors — stable references, no re-render on state changes
export const selectToggleAudio      = (s: MediaState) => s.toggleAudio;
export const selectToggleVideo      = (s: MediaState) => s.toggleVideo;
export const selectStartScreenShare = (s: MediaState) => s.startScreenShare;
export const selectStopScreenShare  = (s: MediaState) => s.stopScreenShare;
export const selectStartUserMedia   = (s: MediaState) => s.startUserMedia;
export const selectStopUserMedia    = (s: MediaState) => s.stopUserMedia;
