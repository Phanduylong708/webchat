/**
 * MediaProvider — Strangler Fig wrapper (transitional).
 *
 * All state and logic have been moved to `src/stores/mediaStore.ts`.
 * This provider now acts as a thin bridge: it reads the Zustand store and
 * forwards the value into MediaContext so that existing consumers using
 * `useMedia()` continue to work without modification.
 *
 * Migration status:
 *   [x] Logic moved to mediaStore.ts
 *   [ ] Consumers migrated to useMediaStore directly
 *   [ ] This file deleted after consumers are migrated and tested
 */
import { useEffect } from "react";
import { MediaContext } from "@/contexts/mediaContext";
import { useMediaStore, selectVideoSource } from "@/stores/mediaStore";
import type { MediaContextValue } from "@/types/media.type";

export function MediaProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const store = useMediaStore();
  const videoSource = useMediaStore(selectVideoSource);

  // Delegate init/dispose to store, tied to this Provider's mount lifecycle.
  // This preserves the same lifecycle behavior as the original implementation.
  const { initManager, disposeManager } = store;
  useEffect(() => {
    initManager();
    return () => disposeManager();
  }, [initManager, disposeManager]);

  const value: MediaContextValue = {
    initError: store.initError,
    isManagerReady: store.isManagerReady,
    getManager: store.getManager,
    userStream: store.userStream,
    screenStream: store.screenStream,
    isAudioMuted: store.isAudioMuted,
    isVideoMuted: store.isVideoMuted,
    videoSource,
    devices: store.devices,
    selectedDevices: store.selectedDevices,
    lastError: store.lastError,
    isStartingUserMedia: store.isStartingUserMedia,
    isStartingScreenShare: store.isStartingScreenShare,
    startUserMedia: store.startUserMedia,
    stopUserMedia: store.stopUserMedia,
    restartUserMedia: store.restartUserMedia,
    toggleAudio: store.toggleAudio,
    toggleVideo: store.toggleVideo,
    switchCamera: store.switchCamera,
    switchMicrophone: store.switchMicrophone,
    enumerateDevices: store.enumerateDevices,
    startScreenShare: store.startScreenShare,
    stopScreenShare: store.stopScreenShare,
    setAudioOutput: store.setAudioOutput,
  };

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}
