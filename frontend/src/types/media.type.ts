import type {
  MediaStreamManager,
  EnumeratedDevices,
  NormalizedMediaError,
} from "@/lib/videocall/mediaStreamManager";

/**
 * Media context surface for Step 1 → Step 2 (state wiring).
 * Children can gracefully degrade by checking `initError` and `getManager()`.
 */
export interface SelectedDevices {
  audioInput?: string;
  videoInput?: string;
  audioOutput?: string;
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

  // ────────────────────────────────────────────────────────────────────────────
  // Step 2: State wiring (read-only in this phase; actions come in Step 3)
  // ────────────────────────────────────────────────────────────────────────────
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
}
