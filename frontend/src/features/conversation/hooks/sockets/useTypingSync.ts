import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { Socket } from "socket.io-client";
import { updateTypingMap } from "@/utils/conversation.utils";

type TypingSetter = Dispatch<SetStateAction<Map<number, Map<number, string>>>>;

interface UseTypingSyncParams {
  socket: Socket | null;
  setTypingByConversation: TypingSetter;
}

export function useTypingSync({ socket, setTypingByConversation }: UseTypingSyncParams): void {
  useEffect(() => {
    if (!socket) return;
    function handleTyping(payload: {
      userId: number;
      username: string;
      conversationId: number;
      isTyping: boolean;
    }) {
      setTypingByConversation((prev) =>
        updateTypingMap(prev, payload.conversationId, payload.userId, payload.username, payload.isTyping),
      );
    }
    socket.on("userTyping", handleTyping);
    return () => {
      socket.off("userTyping", handleTyping);
    };
  }, [socket, setTypingByConversation]);
}
