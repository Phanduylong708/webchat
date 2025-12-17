import type {
  MediaStreamManager,
  EnumeratedDevices,
  NormalizedMediaError,
  UserMediaOptions,
} from "@/lib/videocall/mediaStreamManager";

export interface SelectedDevices {
  audioInput?: string;
  videoInput?: string;
  audioOutput?: string;
}

export interface StartScreenShareOptions {
  /** When true, request sharing audio along with the screen/tab if browser supports it. */
  withAudio?: boolean;
  /** When true, favor text clarity (mapped to manager's textDetailProfile). */
  textDetailProfile?: boolean;
}

export interface MediaContextValue {
  /**
   * Initialization error when environment lacks media support (e.g., tests/webview/unsupported browser).
   * Provider should still render children; consumers can check this to display a friendly message.
   */
  initError: string | null;

  /**
   * Getter to access the underlying MediaStreamManager instance.
   * May return null when not initialized yet or when `initError` is present.
   */
  getManager(): MediaStreamManager | null;
  userStream: MediaStream | null;
  screenStream: MediaStream | null;

  // Mute flags derived from userStream tracks
  isAudioMuted: boolean;
  isVideoMuted: boolean;

  // Devices and selections
  devices: EnumeratedDevices | null;
  selectedDevices: SelectedDevices;

  // Last surfaced error from manager (normalized); do not throw
  lastError: NormalizedMediaError | null;

  // Busy flags for UX feedback
  isStartingUserMedia: boolean;
  isStartingScreenShare: boolean;

  // Actions
  startUserMedia: (options?: UserMediaOptions) => Promise<void>; //
  stopUserMedia: () => void;
  restartUserMedia: (options?: UserMediaOptions) => Promise<void>;

  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;

  switchCamera: (deviceId: string) => Promise<void>;
  switchMicrophone: (deviceId: string) => Promise<void>;

  enumerateDevices: (
    requestPermissions?: boolean
  ) => Promise<EnumeratedDevices>;

  startScreenShare: (options?: StartScreenShareOptions) => Promise<void>;
  stopScreenShare: () => void;

  // Stub: store in state only; actual setSinkId deferred
  setAudioOutput: (deviceId: string) => void;
}
