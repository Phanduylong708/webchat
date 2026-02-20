import { useState, useCallback, type JSX, useMemo } from "react";
import type { Messages, DisplayMessage, OptimisticMessage, SendMessageInput } from "@/types/chat.type";
import { getMessages } from "@/api/message.api";
import useSocket from "@/hooks/context/useSocket";
import { useAuth } from "@/hooks/context/useAuth";
import { useMessageSockets } from "@/hooks/sockets/useMessageSockets";
import { addMessageToMap, replaceMessageInMap, updateOptimisticInMap } from "@/utils/message.utils";
import { MessageContext } from "./messageContext";

interface SendMessageAck {
  success: boolean;
  message?: Messages;
  error?: string;
  code?: string;
}

function MessageProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [messagesByConversation, setMessagesByConversation] = useState<Map<number, DisplayMessage[]>>(
    new Map(),
  );
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [loadingOlderByConversation, setLoadingOlderByConversation] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Map<number, { nextCursor: number | null; hasMore: boolean }>>(
    new Map(),
  );

  const { socket } = useSocket();
  const { user } = useAuth();
  useMessageSockets({ socket, setMessagesByConversation });

  // Send a message (text-only, image-only, or text+image).
  // Returns a Promise that resolves after the server ack, so callers can
  // `await sendMessage(...)` to coordinate isSending / typing:stop.
  const sendMessage = useCallback(
    async (payload: SendMessageInput): Promise<void> => {
      if (!socket || !socket.connected) {
        throw new Error("Socket is not connected in MessageProvider");
      }
      if (!user) {
        throw new Error("User not authenticated");
      }

      const { conversationId, attachmentIds } = payload;
      const trimmedContent = payload.content?.trim() || null;
      const hasAttachment = attachmentIds && attachmentIds.length > 0;

      // Enforce backend rule: at least one of content or attachmentIds required
      if (!trimmedContent && !hasAttachment) {
        throw new Error("Message must have content or attachments");
      }

      const tempMessage: OptimisticMessage = {
        id: -Date.now(),
        conversationId,
        content: trimmedContent,
        messageType: hasAttachment ? "IMAGE" : "TEXT",
        senderId: user.id,
        sender: {
          id: user.id,
          username: user.username,
          avatar: user.avatar || null,
        },
        attachments: [],
        createdAt: new Date().toISOString(),
        _optimistic: true,
        _status: "sending",
      };

      setMessagesByConversation((prev) => addMessageToMap(prev, conversationId, tempMessage));

      // Build the socket payload — only include fields that have values
      const socketPayload: Record<string, unknown> = { conversationId };
      if (trimmedContent) socketPayload.content = trimmedContent;
      if (hasAttachment) socketPayload.attachmentIds = attachmentIds;

      const ACK_TIMEOUT_MS = 15_000;

      return new Promise<void>((resolve, reject) => {
        let settled = false;

        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          setMessagesByConversation((prev) =>
            updateOptimisticInMap(prev, conversationId, tempMessage.id, {
              _status: "failed",
            }),
          );
          reject(new Error("Send timed out — no server acknowledgement"));
        }, ACK_TIMEOUT_MS);

        socket.emit("sendMessage", socketPayload, (ack: SendMessageAck) => {
          clearTimeout(timer);
          if (settled) return; // Late ack after timeout — ignore
          settled = true;

          if (ack.success && ack.message) {
            setMessagesByConversation((prev) =>
              replaceMessageInMap(prev, conversationId, tempMessage.id, ack.message!),
            );
            resolve();
          } else {
            setMessagesByConversation((prev) =>
              updateOptimisticInMap(prev, conversationId, tempMessage.id, {
                _status: "failed",
              }),
            );
            console.error("Send failed:", ack.error, ack.code);
            reject(new Error(ack.error || "Send failed"));
          }
        });
      });
    },
    [socket, user],
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
        setMessagesByConversation((prev) => new Map(prev).set(conversationId, messages));
        setPagination((prev) =>
          new Map(prev).set(conversationId, {
            nextCursor: data.meta.nextCursor,
            hasMore: data.meta.hasMore,
          }),
        );
      } catch (error) {
        console.error(`Error fetching messages for conversation ${conversationId}:`, error);
        setError("Failed to fetch messages");
      } finally {
        setLoadingMessages(false);
      }
    },
    [messagesByConversation],
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
          }),
        );
      } catch (error) {
        console.error(`Error loading older messages for conversation ${conversationId}:`, error);
      } finally {
        setLoadingOlderByConversation((prev) => {
          const updated = new Set(prev);
          updated.delete(conversationId);
          return updated;
        });
      }
    },
    [loadingOlderByConversation, messagesByConversation],
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
    ],
  );

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
}

export { MessageContext, MessageProvider };
