import { useRef } from "react";
import type { Socket } from "socket.io-client";

type Params = {
  socket: Socket | null;
  conversationId: number;
  stopDelayMs?: number;
};

const DEFAULT_STOP_DELAY_MS = 2500;

export function useTypingIndicator({
  socket,
  conversationId,
  stopDelayMs = DEFAULT_STOP_DELAY_MS,
}: Params) {
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCurrentlyTypingRef = useRef(false);

  function notifyTypingActivity() {
    if (!socket) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (!isCurrentlyTypingRef.current) {
      socket.emit("typing:start", { conversationId });
      isCurrentlyTypingRef.current = true;
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", { conversationId });
      isCurrentlyTypingRef.current = false;
      typingTimeoutRef.current = null;
    }, stopDelayMs);
  }

  function stopTyping() {
    socket?.emit("typing:stop", { conversationId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    isCurrentlyTypingRef.current = false;
  }

  return {
    notifyTypingActivity,
    stopTyping,
  };
}
