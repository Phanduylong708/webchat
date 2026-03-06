import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import type { DisplayMessage } from "@/types/chat.type";
import {
  addMessageToMap,
  clearReplyLinksInMap,
  removeMessageFromMap,
  updateMessageInMap,
} from "@/utils/message.utils";

type MessageDeletedPayload = {
  conversationId: number;
  messageId: number;
};

type MessageSetter = React.Dispatch<
  React.SetStateAction<Map<number, DisplayMessage[]>>
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
    function handleNewMessage(message: DisplayMessage) {
      setMessagesByConversation((prev) =>
        addMessageToMap(prev, message.conversationId, message)
      );
    }
    function handleMessageUpdated(message: DisplayMessage) {
      setMessagesByConversation((prev) =>
        updateMessageInMap(prev, message.conversationId, message.id, message)
      );
    }
    function handleMessageDeleted(payload: MessageDeletedPayload) {
      setMessagesByConversation((prev) => {
        if (!prev.has(payload.conversationId)) {
          return prev;
        }
        const withoutDeleted = removeMessageFromMap(prev, payload.conversationId, payload.messageId);
        return clearReplyLinksInMap(withoutDeleted, payload.conversationId, payload.messageId);
      });
    }
    socket.on("newMessage", handleNewMessage);
    socket.on("messageUpdated", handleMessageUpdated);
    socket.on("messageDeleted", handleMessageDeleted);
    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("messageUpdated", handleMessageUpdated);
      socket.off("messageDeleted", handleMessageDeleted);
    };
  }, [socket, setMessagesByConversation]);
}
