import { useState, useCallback, type JSX, useMemo } from "react";
import type { Messages, DisplayMessage, OptimisticMessage, SendMessageInput } from "@/types/chat.type";
import { getMessages } from "@/api/message.api";
import useSocket from "@/hooks/context/useSocket";
import { useAuth } from "@/hooks/context/useAuth";
import { useMessageSockets } from "@/hooks/sockets/useMessageSockets";
import {
  addMessageToMap,
  buildOptimisticTextMessage,
  removeMessageFromMap,
  replaceMessageInMap,
  updateOptimisticInMap,
} from "@/utils/message.utils";
import { emitWithAckTimeout } from "@/utils/socketAck.util";
import { MessageContext } from "./messageContext";

interface SendMessageAck {
  success: boolean;
  message?: Messages;
  error?: string;
  code?: string;
}

type NormalizedSendPayload = {
  conversationId: number;
  attachmentIds?: number[];
  replyToMessageId?: number;
  _replyTo?: SendMessageInput["_replyTo"];
  _optimisticId?: number;
  trimmedContent: string | null;
  hasAttachment: boolean;
};

const SEND_ACK_TIMEOUT_MS = 15_000;

function normalizeSendPayload(payload: SendMessageInput): NormalizedSendPayload {
  const { conversationId, attachmentIds, replyToMessageId, _replyTo, _optimisticId } = payload;
  const trimmedContent = payload.content?.trim() || null;
  const hasAttachment = Array.isArray(attachmentIds) && attachmentIds.length > 0;

  return {
    conversationId,
    attachmentIds,
    replyToMessageId,
    _replyTo,
    _optimisticId,
    trimmedContent,
    hasAttachment,
  };
}

function assertMessageBody(trimmedContent: string | null, hasAttachment: boolean): void {
  if (!trimmedContent && !hasAttachment) {
    throw new Error("Message must have content or attachments");
  }
}

function buildSocketPayload(
  normalized: Pick<
    NormalizedSendPayload,
    "conversationId" | "trimmedContent" | "hasAttachment" | "attachmentIds" | "replyToMessageId"
  >,
): Record<string, unknown> {
  const socketPayload: Record<string, unknown> = { conversationId: normalized.conversationId };
  if (normalized.trimmedContent) socketPayload.content = normalized.trimmedContent;
  if (normalized.hasAttachment) socketPayload.attachmentIds = normalized.attachmentIds;
  if (normalized.replyToMessageId != null) socketPayload.replyToMessageId = normalized.replyToMessageId;
  return socketPayload;
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

  function markOptimisticFailed(conversationId: number, tempId: number): void {
    setMessagesByConversation((prev) =>
      updateOptimisticInMap(prev, conversationId, tempId, {
        _status: "failed",
      }),
    );
  }

  function reconcileOptimisticMessage(conversationId: number, tempId: number, serverMessage: Messages): void {
    setMessagesByConversation((prev) => {
      const msgs = prev.get(conversationId);
      const old = msgs?.find((m) => m.id === tempId);
      const previewUrl = old && "_optimistic" in old ? old._previewUrl : undefined;
      if (previewUrl?.startsWith("blob:")) {
        queueMicrotask(() => URL.revokeObjectURL(previewUrl));
      }
      return replaceMessageInMap(prev, conversationId, tempId, serverMessage);
    });
  }

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

      const normalized = normalizeSendPayload(payload);
      assertMessageBody(normalized.trimmedContent, normalized.hasAttachment);

      // If caller already inserted an optimistic message (media flow), reuse its ID.
      // Otherwise create a new temp message (text-only flow).
      const tempId = normalized._optimisticId ?? -Date.now();

      if (!normalized._optimisticId) {
        const tempMessage: OptimisticMessage = buildOptimisticTextMessage({
          tempId,
          conversationId: normalized.conversationId,
          trimmedContent: normalized.trimmedContent,
          messageType: normalized.hasAttachment ? "IMAGE" : "TEXT",
          sender: user,
          replyToMessageId: normalized.replyToMessageId ?? null,
          replyTo: normalized._replyTo ?? null,
        });
        setMessagesByConversation((prev) =>
          addMessageToMap(prev, normalized.conversationId, tempMessage),
        );
      }

      const socketPayload = buildSocketPayload(normalized);

      const ack = await emitWithAckTimeout<SendMessageAck | undefined, SendMessageAck>({
        socket,
        event: "sendMessage",
        payload: socketPayload,
        timeoutMs: SEND_ACK_TIMEOUT_MS,
        timeoutErrorMessage: "Send timed out — no server acknowledgement",
        isSuccess: (value): value is SendMessageAck => Boolean(value?.success && value.message),
        getErrorMessage: (value) => value?.error || "Send failed",
        onTimeout: () => {
          markOptimisticFailed(normalized.conversationId, tempId);
        },
        onFailureAck: (value) => {
          markOptimisticFailed(normalized.conversationId, tempId);
          console.error("Send failed:", value?.error, value?.code);
        },
      });

      reconcileOptimisticMessage(normalized.conversationId, tempId, ack.message!);
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
    [loadingOlderByConversation, messagesByConversation, pagination],
  );

  // Insert an optimistic message into the list (for media flow before upload).
  const insertOptimisticMessage = useCallback((message: OptimisticMessage) => {
    setMessagesByConversation((prev) => addMessageToMap(prev, message.conversationId, message));
  }, []);

  // Patch an optimistic message's client-only metadata (progress, status).
  const updateOptimistic = useCallback(
    (
      conversationId: number,
      messageId: number,
      patch: Partial<Pick<import("@/types/chat.type").OptimisticMeta, "_status" | "_progress">>,
    ) => {
      setMessagesByConversation((prev) => updateOptimisticInMap(prev, conversationId, messageId, patch));
    },
    [],
  );

  // Remove a failed optimistic message (discard action). Revokes blob URL if present.
  const removeOptimisticMessage = useCallback((conversationId: number, messageId: number) => {
    // Capture blob URL before state update (keep updater pure)
    setMessagesByConversation((prev) => {
      const msgs = prev.get(conversationId);
      const old = msgs?.find((m) => m.id === messageId);
      if (old && "_optimistic" in old && old._previewUrl?.startsWith("blob:")) {
        // Schedule revoke for after state update (side-effect outside render)
        queueMicrotask(() => URL.revokeObjectURL(old._previewUrl!));
      }
      return removeMessageFromMap(prev, conversationId, messageId);
    });
  }, []);

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
      insertOptimisticMessage,
      updateOptimistic,
      removeOptimisticMessage,
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
      insertOptimisticMessage,
      updateOptimistic,
      removeOptimisticMessage,
    ],
  );

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
}

export { MessageContext, MessageProvider };
