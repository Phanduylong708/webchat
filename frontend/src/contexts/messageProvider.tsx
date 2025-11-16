import { useState, useCallback, type JSX, useMemo } from "react";
import type { Messages } from "@/types/chat.type";
import { getMessages } from "@/api/message.api";
import useSocket from "@/hooks/context/useSocket";
import { useAuth } from "@/hooks/context/useAuth";
import { useMessageSockets } from "@/hooks/sockets/useMessageSockets";
import {
  addMessageToMap,
  removeMessageFromMap,
  replaceMessageInMap,
} from "@/utils/message.utils";
import { MessageContext } from "./messageContext";
interface SendMessageAck {
  success: boolean;
  message?: Messages;
  error?: string;
}

function MessageProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [messagesByConversation, setMessagesByConversation] = useState<
    Map<number, Messages[]>
  >(new Map());
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [loadingOlderByConversation, setLoadingOlderByConversation] = useState<
    Set<number>
  >(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<
    Map<number, { nextCursor: number | null; hasMore: boolean }>
  >(new Map());

  const { socket } = useSocket();
  const { user } = useAuth();
  useMessageSockets({ socket, setMessagesByConversation });

  // Send a message
  const sendMessage = useCallback(
    async (conversationId: number, content: string): Promise<void> => {
      console.log("sendMessage called - socket.connected:", socket?.connected);
      if (!socket || !socket.connected) {
        throw new Error("Socket is not connected in MessageProvider");
      }
      if (!user) {
        throw new Error("User not authenticated");
      }
      const tempMessage: Messages = {
        id: -Date.now(), // temporary ID
        conversationId,
        content,
        senderId: user.id,
        sender: {
          id: user.id,
          username: user.username,
          avatar: user.avatar || null,
        },
        createdAt: new Date().toISOString(),
      };

      setMessagesByConversation((prev) =>
        addMessageToMap(prev, conversationId, tempMessage)
      );

      socket.emit(
        "sendMessage",
        { conversationId, content },
        (ack: SendMessageAck) => {
          if (ack.success && ack.message) {
            const realMessage = ack.message;
            // Replace temp message with real message
            setMessagesByConversation((prev) =>
              replaceMessageInMap(
                prev,
                conversationId,
                tempMessage.id,
                realMessage
              )
            );
          } else {
            setMessagesByConversation((prev) =>
              removeMessageFromMap(prev, conversationId, tempMessage.id)
            );
            console.error("Send failed:", ack.error);
          }
        }
      );
    },
    [socket, user]
  );
  const fetchMessages = useCallback(
    async (conversationId: number): Promise<void> => {
      // Check cache first. No double fetches
      if (messagesByConversation.has(conversationId)) {
        return;
      }

      setLoadingMessages(true);
      setError(null);
      try {
        const data = await getMessages(conversationId, undefined, 10);
        const messages = data.messages;
        setMessagesByConversation((prev) =>
          new Map(prev).set(conversationId, messages)
        );
        setPagination((prev) =>
          new Map(prev).set(conversationId, {
            nextCursor: data.meta.nextCursor,
            hasMore: data.meta.hasMore,
          })
        );
      } catch (error) {
        console.error(
          `Error fetching messages for conversation ${conversationId}:`,
          error
        );
        setError("Failed to fetch messages");
      } finally {
        setLoadingMessages(false);
      }
    },
    [messagesByConversation]
  );

  const loadOlderMessages = useCallback(
    async (conversationId: number): Promise<void> => {
      const currentMessages = messagesByConversation.get(conversationId); // Get current messages
      const paginationInfo = pagination.get(conversationId);
      // prettier-ignore
      if (!currentMessages || currentMessages.length === 0) return; // No messages to load older from
      if (
        !paginationInfo?.hasMore ||
        !paginationInfo.nextCursor ||
        loadingOlderByConversation.has(conversationId)
      )
        return; // No more messages or already loading
      setLoadingOlderByConversation((prev) => {
        const updated = new Set(prev);
        updated.add(conversationId);
        return updated;
      });
      try {
        // prettier-ignore
        const data = await getMessages(conversationId, paginationInfo.nextCursor, 10);
        // Prepend messages
        setMessagesByConversation((prev) => {
          const existing = prev.get(conversationId) || [];
          const updated = [...data.messages, ...existing]; // Prepend!
          return new Map(prev).set(conversationId, updated);
        });
        // Update pagination
        setPagination((prev) =>
          new Map(prev).set(conversationId, {
            nextCursor: data.meta.nextCursor,
            hasMore: data.meta.hasMore,
          })
        );
      } catch (error) {
        console.error(
          `Error loading older messages for conversation ${conversationId}:`,
          error
        );
      } finally {
        setLoadingOlderByConversation((prev) => {
          const updated = new Set(prev);
          updated.delete(conversationId);
          return updated;
        });
      }
    },
    [loadingOlderByConversation, messagesByConversation]
  );

  const value = useMemo(
    () => ({
      messagesByConversation,
      loadingMessages,
      loadingOlderByConversation,
      error,
      pagination,
      fetchMessages,
      sendMessage,
      loadOlderMessages,
    }),
    [
      messagesByConversation,
      loadingMessages,
      loadingOlderByConversation,
      error,
      pagination,
      fetchMessages,
      sendMessage,
      loadOlderMessages,
    ]
  );

  return (
    <MessageContext.Provider value={value}>{children}</MessageContext.Provider>
  );
}

export { MessageContext, MessageProvider };
