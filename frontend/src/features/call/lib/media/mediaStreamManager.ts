/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MeshRTCManager } from "../rtc/webrtcManager";

  /**
   * Minimal logger interface used by MediaStreamManager.
   * All methods are optional; defaults to console when not provided.
   */
  export interface MediaStreamLogger {
    info?: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
    debug?: (...args: any[]) => void;
  }

  /**
   * Local fallback for DisplayMediaStreamConstraints (not always in TS lib dom).
   */
type DisplayMediaStreamConstraints = MediaStreamConstraints & {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
};

type ExtendedVideoConstraints = MediaTrackConstraints & {
  resizeMode?: "none" | "crop-and-scale" | string;
  contentHint?: string;
};

/**
 * Stable error codes to normalize getUserMedia/getDisplayMedia failures.
 */
export type MediaErrorCode =
    | "permission-denied"
    | "device-not-found"
    | "not-readable"
    | "constraint-failed"
    | "abort"
    | "security"
    | "unsupported"
    | "unknown";

  export interface NormalizedMediaError {
    code: MediaErrorCode;
    message: string;
    constraint?: string;
    cause?: unknown;
  }

  /**
   * Friendly video constraint profiles.
   */
  export type VideoProfile =
    | "default"
    | "hd" // 1280x720+
    | "fhd" // 1920x1080+
    | "text"; // optimized for text/detail (resizeMode none + contentHint text)

  /**
   * Friendly audio constraint profiles.
   */
  export type AudioProfile = "default" | "voice"; // voice: noise suppression / echo cancel emphasis

  export interface DeviceSummary {
    deviceId: string;
    kind: MediaDeviceKind;
    label: string;
    groupId?: string;
  }

  export interface EnumeratedDevices {
    audioInputs: DeviceSummary[];
    videoInputs: DeviceSummary[];
    audioOutputs: DeviceSummary[];
  }

  export interface MediaStreamManagerCallbacks {
    onStreamUpdated?: (stream: MediaStream | null, source: "user" | "screen") => void;
    onDeviceChange?: (devices: EnumeratedDevices) => void;
    onTrackEnded?: (kind: "audio" | "video", source: "user" | "screen") => void;
    onMute?: (kind: "audio" | "video", source: "user" | "screen") => void;
    onUnmute?: (kind: "audio" | "video", source: "user" | "screen") => void;
    onError?: (error: NormalizedMediaError) => void;
  }

export interface MediaStreamManagerConfig {
  logger?: MediaStreamLogger;
  mediaDevices?: MediaDevices;
  callbacks?: MediaStreamManagerCallbacks;
  /**
   * When true, device enumeration will trigger a short getUserMedia probe
   * to unlock device labels before returning.
   */
  requestPermissionsByDefault?: boolean;
  /**
   * Auto-sync user media changes to meshBinding if present.
   * If false, binding exists but caller must sync manually (future hook).
   */
  autoSyncMesh?: boolean;
}

  export interface UserMediaOptions {
    audio?: boolean | MediaTrackConstraints;
    video?: boolean | MediaTrackConstraints;
    audioProfile?: AudioProfile;
    videoProfile?: VideoProfile;
    requestPermissions?: boolean;
  }

  export interface ScreenShareOptions {
    constraints?: DisplayMediaStreamConstraints;
    /**
     * When true, apply contentHint/text + resizeMode none to favor text clarity.
     */
    textDetailProfile?: boolean;
  }

  export interface MeshRTCManagerLike {
    setLocalStream(stream: MediaStream | null): void | Promise<void>;
  }

  /**
   * Manages MediaStreams, tracks, device enumeration, and optional MeshRTCManager binding.
   * DOM-free: only returns streams/tracks, never manipulates elements.
   */
export class MediaStreamManager {
  private logger: MediaStreamLogger;
  private mediaDevices: MediaDevices;
  private callbacks: MediaStreamManagerCallbacks;
  private userStream: MediaStream | null;
  private screenStream: MediaStream | null;
  private selectedAudioInput?: string;
  private selectedVideoInput?: string;
  private selectedAudioOutput?: string;
  private meshBinding: MeshRTCManagerLike | null;
  private autoSyncMesh: boolean;
  private requestPermissionsByDefault: boolean;
  private deviceChangeListener: (() => void) | null;

  constructor(config: MediaStreamManagerConfig = {}) {
    this.logger = config.logger ?? console;
    this.mediaDevices = config.mediaDevices ?? navigator.mediaDevices;
    this.callbacks = config.callbacks ?? {};
    this.userStream = null;
    this.screenStream = null;
    this.meshBinding = null;
    this.selectedAudioInput = undefined;
    this.selectedVideoInput = undefined;
    this.selectedAudioOutput = undefined;
    this.autoSyncMesh = config.autoSyncMesh ?? true;
    this.requestPermissionsByDefault = config.requestPermissionsByDefault ?? false;
    this.deviceChangeListener = null;

    if (this.mediaDevices && typeof this.mediaDevices.addEventListener === "function") {
      this.deviceChangeListener = () => {
        // Fire-and-forget refresh; errors are emitted but don't throw.
        void this.refreshDevicesOnChange();
      };
      this.mediaDevices.addEventListener("devicechange", this.deviceChangeListener);
    }
  }

    // ===========================================================================
  // User media lifecycle
  // ===========================================================================

  async startUserMedia(options: UserMediaOptions = {}): Promise<MediaStream> {
    // Auto-stop existing stream to avoid leaks unless explicitly disallowed later.
    this.stopUserMedia();

    const constraints = this.buildUserConstraints(options);
    try {
      const stream = await this.mediaDevices.getUserMedia(constraints);
      this.attachTrackEvents(stream, "user");
      this.userStream = stream;
      this.captureSelectedDevices(stream);
      this.emitStreamUpdated(stream, "user");
      return stream;
    } catch (error) {
      this.emitError(this.normalizeError(error));
      throw error;
    }
  }

  async restartUserMedia(options?: UserMediaOptions): Promise<MediaStream> {
    return this.startUserMedia(options ?? {});
  }

  stopUserMedia(): void {
    if (!this.userStream) {
      return;
    }
    this.stopStream(this.userStream);
    this.userStream = null;
    this.emitStreamUpdated(null, "user");
  }

  getUserStream(): MediaStream | null {
    return this.userStream;
  }

  async startScreenShare(options: ScreenShareOptions = {}): Promise<MediaStream> {
    this.stopScreenShare();

    const constraints = this.buildScreenConstraints(options);
    try {
      const stream = await this.mediaDevices.getDisplayMedia(constraints);
      // Apply contentHint for text/detail if requested.
      if (options.textDetailProfile) {
        for (const track of stream.getVideoTracks()) {
          try {
            (track as any).contentHint = "text";
          } catch {
            // ignore if not supported
          }
        }
      }
      this.attachTrackEvents(stream, "screen");
      this.screenStream = stream;
      this.emitStreamUpdated(stream, "screen");
      return stream;
    } catch (error) {
      this.emitError(this.normalizeError(error));
      throw error;
    }
  }

  stopScreenShare(): void {
    if (!this.screenStream) return;
    this.stopStream(this.screenStream);
    this.screenStream = null;
    this.emitStreamUpdated(null, "screen");
  }

  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

    // ===========================================================================
  // Device enumeration & selection
  // ===========================================================================

  async getDevices(requestPermissions?: boolean): Promise<EnumeratedDevices> {
    if (!this.mediaDevices?.enumerateDevices) {
      const err = this.normalizeError({ name: "NotSupportedError", message: "enumerateDevices not supported" });
      this.emitError(err);
      throw new Error(err.message);
    }

    const shouldProbe = requestPermissions ?? this.requestPermissionsByDefault ?? false;
    if (shouldProbe) {
      await this.runPermissionProbe();
    }

    try {
      const devices = await this.mediaDevices.enumerateDevices();
      const summary: EnumeratedDevices = {
        audioInputs: [],
        videoInputs: [],
        audioOutputs: [],
      };

      for (const d of devices) {
        const entry: DeviceSummary = {
          deviceId: d.deviceId,
          kind: d.kind,
          label: d.label || "",
          groupId: d.groupId,
        };
        if (d.kind === "audioinput") summary.audioInputs.push(entry);
        else if (d.kind === "videoinput") summary.videoInputs.push(entry);
        else if (d.kind === "audiooutput") summary.audioOutputs.push(entry);
      }

      this.callbacks.onDeviceChange?.(summary);
      return summary;
    } catch (error) {
      const normalized = this.normalizeError(error);
      this.emitError(normalized);
      throw error;
    }
  }

    isAudioOutputSupported(): boolean {
      // setSinkId exists on some browsers; feature-detect on HTMLMediaElement prototype
      return typeof (HTMLMediaElement.prototype as any).setSinkId === "function";
    }

  async switchCamera(deviceId: string, options?: Partial<UserMediaOptions>): Promise<MediaStream> {
    const merged: UserMediaOptions = {
      audio: options?.audio ?? (this.userStream?.getAudioTracks().length ? true : false),
      video: {
        deviceId: { exact: deviceId },
        ...(typeof options?.video === "object" ? options.video : {}),
      },
      videoProfile: options?.videoProfile,
      audioProfile: options?.audioProfile,
    };
    const stream = await this.startUserMedia(merged);
    this.selectedVideoInput = deviceId;
    return stream;
  }

  async switchMicrophone(deviceId: string, options?: Partial<UserMediaOptions>): Promise<MediaStream> {
    const merged: UserMediaOptions = {
      audio: {
        deviceId: { exact: deviceId },
        ...(typeof options?.audio === "object" ? options.audio : {}),
      },
      video: options?.video ?? (this.userStream?.getVideoTracks().length ? true : false),
      audioProfile: options?.audioProfile,
      videoProfile: options?.videoProfile,
    };
    const stream = await this.startUserMedia(merged);
    this.selectedAudioInput = deviceId;
    return stream;
  }

    setAudioOutputDevice(deviceId: string): void {
      this.selectedAudioOutput = deviceId;
    }

    getSelectedDevices(): {
      audioInput?: string;
      videoInput?: string;
      audioOutput?: string;
    } {
      return {
        audioInput: this.selectedAudioInput,
        videoInput: this.selectedVideoInput,
        audioOutput: this.selectedAudioOutput,
      };
    }

  mute(kind: "audio" | "video", source: "user" | "screen" = "user"): void {
    const stream = this.getStreamBySource(source);
    if (!stream) return;
    for (const track of stream.getTracks()) {
      if (track.kind !== kind) continue;
      if (track.enabled) {
        track.enabled = false;
        this.callbacks.onMute?.(kind, source);
      }
    }
  }

  unmute(kind: "audio" | "video", source: "user" | "screen" = "user"): void {
    const stream = this.getStreamBySource(source);
    if (!stream) return;
    for (const track of stream.getTracks()) {
      if (track.kind !== kind) continue;
      if (!track.enabled) {
        track.enabled = true;
        this.callbacks.onUnmute?.(kind, source);
      }
    }
  }

  isMuted(kind: "audio" | "video", source: "user" | "screen" = "user"): boolean {
    const stream = this.getStreamBySource(source);
    if (!stream) return false;
    const tracks = stream.getTracks().filter((t) => t.kind === kind);
    if (tracks.length === 0) return false;
    return tracks.every((t) => !t.enabled);
  }

  async applyConstraints(
    kind: "audio" | "video",
    constraints: MediaTrackConstraints,
    source: "user" | "screen" = "user"
  ): Promise<MediaTrackSettings> {
    const track = this.getTrack(kind, source);
    if (!track) {
      throw new Error(`No ${kind} track for ${source} stream`);
    }
    try {
      await track.applyConstraints(constraints);
      return track.getSettings();
    } catch (error) {
      this.emitError(this.normalizeError(error));
      throw error;
    }
  }

  getTrackCapabilities(
    kind: "audio" | "video",
    source: "user" | "screen" = "user"
  ): MediaTrackCapabilities | null {
    const track = this.getTrack(kind, source);
    if (!track || typeof (track as any).getCapabilities !== "function") return null;
    return (track as any).getCapabilities();
  }

  getTrackSettings(
    kind: "audio" | "video",
    source: "user" | "screen" = "user"
  ): MediaTrackSettings | null {
    const track = this.getTrack(kind, source);
    if (!track || typeof track.getSettings !== "function") return null;
    return track.getSettings();
  }

    bindMesh(mesh: MeshRTCManager | MeshRTCManagerLike): void {
      this.meshBinding = mesh;
  }

  unbindMesh(): void {
    this.meshBinding = null;
  }

  dispose(): void {
    if (this.deviceChangeListener && typeof this.mediaDevices.removeEventListener === "function") {
      this.mediaDevices.removeEventListener("devicechange", this.deviceChangeListener);
    }
    this.stopUserMedia();
    this.stopScreenShare();
    this.meshBinding = null;
  }

  private getStreamBySource(source: "user" | "screen"): MediaStream | null {
    return source === "user" ? this.userStream : this.screenStream;
  }

  private stopStream(stream: MediaStream | null): void {
    if (!stream) return;
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }

  private getTrack(kind: "audio" | "video", source: "user" | "screen"): MediaStreamTrack | null {
    const stream = this.getStreamBySource(source);
    if (!stream) return null;
    const track = stream.getTracks().find((t) => t.kind === kind) || null;
    return track;
  }

  private emitStreamUpdated(stream: MediaStream | null, source: "user" | "screen"): void {
    this.callbacks.onStreamUpdated?.(stream, source);
    if (source === "user" && this.meshBinding && this.autoSyncMesh) {
      // sync user stream only; screen share is typically separate
      void Promise.resolve(this.meshBinding.setLocalStream(stream)).catch((err) => {
        this.logger.error?.("Failed to sync stream to mesh", err);
      });
    }
  }

  private emitError(error: NormalizedMediaError): void {
    this.callbacks.onError?.(error);
    this.logger.error?.(error.message);
  }

  private async runPermissionProbe(): Promise<void> {
    // Use a minimal audio-only probe to unlock labels; stop immediately.
    try {
      const probe = await this.mediaDevices.getUserMedia({ audio: true, video: false });
      this.stopStream(probe);
    } catch (error) {
      // Emit normalized error but rethrow so caller knows probe failed.
      this.emitError(this.normalizeError(error));
      throw error;
    }
  }

  private async refreshDevicesOnChange(): Promise<void> {
    try {
      await this.getDevices(this.requestPermissionsByDefault);
    } catch {
      // Swallow; errors already emitted in getDevices.
    }
  }

  private attachTrackEvents(stream: MediaStream, source: "user" | "screen"): void {
    for (const track of stream.getTracks()) {
      track.onended = () => {
        this.callbacks.onTrackEnded?.(track.kind as "audio" | "video", source);
        // If all tracks ended, clear stream state for that source.
        const remaining = stream.getTracks().filter((t) => t.readyState !== "ended");
        if (remaining.length === 0) {
          if (source === "user") {
            this.userStream = null;
          } else {
            this.screenStream = null;
          }
          this.emitStreamUpdated(null, source);
        }
      };
      track.onmute = () => {
        this.callbacks.onMute?.(track.kind as "audio" | "video", source);
      };
      track.onunmute = () => {
        this.callbacks.onUnmute?.(track.kind as "audio" | "video", source);
      };
    }
  }

  private captureSelectedDevices(stream: MediaStream): void {
    for (const track of stream.getTracks()) {
      const settings = track.getSettings?.();
      if (track.kind === "audio" && settings?.deviceId) {
        this.selectedAudioInput = settings.deviceId;
      }
      if (track.kind === "video" && settings?.deviceId) {
        this.selectedVideoInput = settings.deviceId;
      }
    }
  }

  private buildUserConstraints(options: UserMediaOptions): MediaStreamConstraints {
    // Simple passthrough for now; profiles will be expanded in later steps.
    const audio = options.audio ?? options.audioProfile ? this.buildAudioConstraints(options) : false;
    const video = options.video ?? options.videoProfile ? this.buildVideoConstraints(options) : false;
    return { audio, video };
  }

  private buildScreenConstraints(options: ScreenShareOptions): DisplayMediaStreamConstraints {
    const base: DisplayMediaStreamConstraints = options.constraints ?? { video: true, audio: false };
    if (options.textDetailProfile) {
      // Encourage higher resolution and avoid automatic downscale for text clarity.
      const video = base.video === undefined ? true : base.video;
      const merged: any =
        video === true
          ? { resizeMode: "none" }
          : typeof video === "object"
            ? { ...video, resizeMode: "none" }
            : video;
      return { ...base, video: merged };
    }
    return base;
  }

  private buildAudioConstraints(options: UserMediaOptions): boolean | MediaTrackConstraints {
    if (typeof options.audio === "boolean" || options.audio === undefined) {
      if (options.audioProfile === "voice") {
        return { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      }
      return options.audio ?? false;
    }
    return options.audio;
  }

  private buildVideoConstraints(options: UserMediaOptions): boolean | MediaTrackConstraints {
    if (typeof options.video === "boolean" || options.video === undefined) {
      switch (options.videoProfile) {
        case "hd":
          return { width: { min: 1280 }, height: { min: 720 } } as MediaTrackConstraints;
        case "fhd":
          return { width: { min: 1920 }, height: { min: 1080 } } as MediaTrackConstraints;
        case "text":
          return {
            width: { min: 1280 },
            height: { min: 720 },
            resizeMode: "none",
          } as ExtendedVideoConstraints;
        default:
          return options.video ?? false;
      }
    }
    // options.video is MediaTrackConstraints
    return options.video;
  }

  private normalizeError(error: any): NormalizedMediaError {
    const msg = error?.message || String(error);
    if (typeof error?.name === "string") {
      switch (error.name) {
        case "NotAllowedError":
        case "SecurityError":
          return { code: "permission-denied", message: msg, cause: error };
        case "NotFoundError":
          return { code: "device-not-found", message: msg, cause: error };
        case "NotReadableError":
        case "TrackStartError":
          return { code: "not-readable", message: msg, cause: error };
        case "OverconstrainedError":
        case "ConstraintNotSatisfiedError":
          return { code: "constraint-failed", message: msg, cause: error, constraint: error.constraint };
        case "AbortError":
          return { code: "abort", message: msg, cause: error };
        case "NotSupportedError":
          return { code: "unsupported", message: msg, cause: error };
        default:
          return { code: "unknown", message: msg, cause: error };
      }
    }
    return { code: "unknown", message: msg, cause: error };
  }
  }
