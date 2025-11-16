import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import type { Messages } from "@/types/chat.type";
import { addMessageToMap } from "@/utils/message.utils";

type MessageSetter = React.Dispatch<
  React.SetStateAction<Map<number, Messages[]>>
>;

interface UseMessageSocketsParams {
  socket: Socket | null;
  setMessagesByConversation: MessageSetter;
}

// Keeps message cache in sync when server pushes new messages (e.g., other users).
export function useMessageSockets({
  socket,
  setMessagesByConversation,
}: UseMessageSocketsParams): void {
  useEffect(() => {
    if (!socket) return;
    function handleNewMessage(message: Messages) {
      setMessagesByConversation((prev) =>
        addMessageToMap(prev, message.conversationId, message)
      );
    }
    socket.on("newMessage", handleNewMessage);
    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [socket, setMessagesByConversation]);
}
