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
  withAudio?: boolean; // request sharing audio along with screen/tab
  textDetailProfile?: boolean; // favor text clarity (contentHint = 'text')
}

export type VideoSource = "camera" | "screen";

export interface MediaContextValue {
  // Initialization error when environment lacks media support
  initError: string | null;

  // Indicates MediaStreamManager is ready for actions
  isManagerReady: boolean;

  // Access underlying MediaStreamManager (null if not initialized or initError)
  getManager(): MediaStreamManager | null;

  userStream: MediaStream | null;
  screenStream: MediaStream | null;

  // Mute flags derived from userStream tracks
  isAudioMuted: boolean;
  isVideoMuted: boolean;

  // Derived from screenStream: 'screen' when sharing, 'camera' otherwise
  videoSource: VideoSource;

  // Devices and selections
  devices: EnumeratedDevices | null;
  selectedDevices: SelectedDevices;

  // Last surfaced error from manager (normalized)
  lastError: NormalizedMediaError | null;

  // Busy flags for UX feedback
  isStartingUserMedia: boolean;
  isStartingScreenShare: boolean;

  // Actions
  startUserMedia: (options?: UserMediaOptions) => Promise<void>;
  stopUserMedia: () => void;
  restartUserMedia: (options?: UserMediaOptions) => Promise<void>;

  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;

  switchCamera: (deviceId: string) => Promise<void>;
  switchMicrophone: (deviceId: string) => Promise<void>;

  enumerateDevices: (requestPermissions?: boolean) => Promise<EnumeratedDevices>;

  startScreenShare: (options?: StartScreenShareOptions) => Promise<void>;
  stopScreenShare: () => void;

  setAudioOutput: (deviceId: string) => void; // stub: store in state only
}
