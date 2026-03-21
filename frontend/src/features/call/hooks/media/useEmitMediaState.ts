import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import { useCall } from "@/features/call/providers/useCall";
import type { VideoSource } from "@/features/call/types/media.type";

interface UseEmitMediaStateParams {
  socket: Socket | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  videoSource: VideoSource;
}

// Emits local media state to the server when it changes
export function useEmitMediaState({
  socket,
  isAudioMuted,
  isVideoMuted,
  videoSource,
}: UseEmitMediaStateParams): void {
  const { callId } = useCall();

  useEffect(() => {
    if (!socket || !callId) return;

    socket.emit("call:media-state", {
      callId,
      audioMuted: isAudioMuted,
      videoMuted: videoSource === "screen" ? false : isVideoMuted,
      videoSource,
    });
  }, [socket, callId, isAudioMuted, isVideoMuted, videoSource]);
}
