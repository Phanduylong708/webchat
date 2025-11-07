import { useState, useCallback, type JSX, useMemo } from "react";
import type { Messages } from "@/types/chat.type";
import { getMessages } from "@/api/message.api";
import useSocket from "@/hooks/useSocket";
import { useAuth } from "@/hooks/useAuth";
import { MessageContext } from "./messageContext";
interface SendMessageAck {
  success: boolean;
  message?: Messages;
  error?: string;
}

// Pure map manipulation helpers
function addMessageToMap(
  map: Map<number, Messages[]>,
  conversationId: number,
  message: Messages
): Map<number, Messages[]> {
  const updated = new Map(map);
  const existing = updated.get(conversationId) || [];
  updated.set(conversationId, [...existing, message]);
  return updated;
}

function removeMessageFromMap(
  map: Map<number, Messages[]>,
  conversationId: number,
  messageId: string | number
): Map<number, Messages[]> {
  const updated = new Map(map);
  const messages = updated.get(conversationId) || [];
  updated.set(
    conversationId,
    messages.filter((m) => m.id !== messageId)
  );
  return updated;
}

function replaceMessageInMap(
  map: Map<number, Messages[]>,
  conversationId: number,
  oldId: string | number,
  newMessage: Messages
): Map<number, Messages[]> {
  const updated = new Map(map);
  const messages = updated.get(conversationId) || [];
  const replaced = messages.map((m) => (m.id === oldId ? newMessage : m));
  updated.set(conversationId, replaced);
  return updated;
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
  const [error, setError] = useState<string | null>(null);
  // const [pagination, setPagination] = useState<Map<number, {cursor: number | null; hasMore: boolean}>>(new Map());

  const { socket } = useSocket();
  const { user } = useAuth();

  const sendMessage = useCallback(
    async (conversationId: number, content: string): Promise<void> => {
      console.log(
        "🔵 sendMessage called - socket.connected:",
        socket?.connected
      );
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
        const data = await getMessages(conversationId);
        const messages = data.messages;
        setMessagesByConversation((prev) =>
          new Map(prev).set(conversationId, messages)
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
  // async function loadOlderMessages(conversationId: number): Promise<void> {
  //     //TODO

  // }

  const value = useMemo(
    () => ({
      messagesByConversation,
      loadingMessages,
      error,
      fetchMessages,
      sendMessage,
    }),
    [messagesByConversation, loadingMessages, error, fetchMessages, sendMessage]
  );

  return (
    <MessageContext.Provider value={value}>{children}</MessageContext.Provider>
  );
}

export { MessageContext, MessageProvider };
