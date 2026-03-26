import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import type { VideoSource } from "@/features/call/types/media.type";
import { selectCallSessionCallId, useCallSessionStore } from "@/features/call/stores/callSessionStore";

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
  const callId = useCallSessionStore(selectCallSessionCallId);

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
