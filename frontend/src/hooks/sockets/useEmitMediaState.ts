import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import { useCall } from "@/hooks/context/useCall";

interface UseEmitMediaStateParams {
  socket: Socket | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
}

/**
 * Emits local media state to the server when it changes.
 * Uses callId from CallContext (set after join ACK) to avoid race conditions.
 */
export function useEmitMediaState({
  socket,
  isAudioMuted,
  isVideoMuted,
}: UseEmitMediaStateParams): void {
  const { callId } = useCall();

  useEffect(() => {
    if (!socket || !callId) return;

    socket.emit("call:media-state", {
      callId,
      audioMuted: isAudioMuted,
      videoMuted: isVideoMuted,
    });
  }, [socket, callId, isAudioMuted, isVideoMuted]);
}
