import { useEffect } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import useSocket from "@/hooks/context/useSocket";
import {
  messagesQueryKey,
  appendIncomingMessageToCache,
  replaceUpdatedMessageAcrossAllPages,
  removeMessageAndClearOrphanedReplyLinks,
  type MessagesPage,
} from "@/hooks/queries/messages";
import type { Messages } from "@/types/chat.type";

type MessageDeletedPayload = {
  conversationId: number;
  messageId: number;
};

// Subscribes to all server-pushed message events and patches the TanStack cache.
// All 3 events share the same dependency array, so they live in one effect.
export function useMessageSockets(): void {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    function handleNewMessage(incomingMessage: Messages) {
      // newMessage is only emitted to OTHER users in the room (socket.to(room)).
      // The sender's cache is already patched in useSendMessageMutation onSuccess.
      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        messagesQueryKey(incomingMessage.conversationId),
        (currentCache) => {
          if (!currentCache) return currentCache;
          return appendIncomingMessageToCache(currentCache, incomingMessage);
        },
      );
    }

    function handleMessageUpdated(updatedMessage: Messages) {
      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        messagesQueryKey(updatedMessage.conversationId),
        (currentCache) => {
          if (!currentCache) return currentCache;
          return replaceUpdatedMessageAcrossAllPages(currentCache, updatedMessage);
        },
      );
    }

    function handleMessageDeleted(payload: MessageDeletedPayload) {
      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        messagesQueryKey(payload.conversationId),
        (currentCache) => {
          if (!currentCache) return currentCache;
          return removeMessageAndClearOrphanedReplyLinks(currentCache, payload.messageId);
        },
      );
    }

    socket.on("newMessage", handleNewMessage);
    socket.on("messageUpdated", handleMessageUpdated);
    socket.on("messageDeleted", handleMessageDeleted);
    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("messageUpdated", handleMessageUpdated);
      socket.off("messageDeleted", handleMessageDeleted);
    };
  }, [socket, queryClient]);
}
