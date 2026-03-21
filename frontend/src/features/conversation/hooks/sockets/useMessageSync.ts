import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import type {
  ConversationsResponse,
  PinSummary,
  PinnedMessageItem,
} from "@/types/chat.type";
import type { Messages } from "@/types/chat.type";
import { derivePreviewText, applyNewMessageToConversationList } from "@/utils/conversation.utils";
import {
  sortPinnedItemsDesc,
  mapPinnedAttachments,
  patchPinnedItemsCache,
} from "@/utils/pin.util";
import { conversationsQueryKey } from "@/features/conversation/hooks/conversations";

type MessageDeletedPayload = {
  conversationId: number;
  messageId: number;
  nextLastMessage?: Messages | null;
  pinSummary?: PinSummary;
};

type MessagePinnedPayload = {
  conversationId: number;
  pinnedCount: number;
  latestPinnedMessage: PinSummary["latestPinnedMessage"];
  pinnedItem: PinnedMessageItem;
};

type MessageUnpinnedPayload = {
  conversationId: number;
  messageId: number;
  pinnedCount: number;
  latestPinnedMessage: PinSummary["latestPinnedMessage"];
};

interface UseMessageSyncParams {
  socket: Socket | null;
  currentUserId: number | null;
}

export function useMessageSync({ socket, currentUserId }: UseMessageSyncParams): void {
  const queryClient = useQueryClient();

  // Update conversation list preview (last message + ordering) when a new message arrives.
  useEffect(() => {
    if (!socket || !currentUserId) return;
    const userId = currentUserId;
    function handleNewMessage(message: Messages) {
      queryClient.setQueryData<ConversationsResponse[]>(
        conversationsQueryKey(userId),
        (prev) => {
          if (!prev) return prev;
          return applyNewMessageToConversationList(prev, message);
        },
      );
    }
    socket.on("newMessage", handleNewMessage);
    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [socket, currentUserId, queryClient]);

  // Patch sidebar lastMessage preview when a message is edited.
  // No reordering: edit does not change createdAt.
  useEffect(() => {
    if (!socket || !currentUserId) return;
    const userId = currentUserId;
    function handleMessageUpdated(message: Messages) {
      queryClient.setQueryData<ConversationsResponse[]>(
        conversationsQueryKey(userId),
        (prev) => {
          if (!prev) return prev;
          return prev.map((c) => {
            if (c.id !== message.conversationId) return c;

            const previewText = derivePreviewText(message);

            const patchLastMessage =
              c.lastMessage?.id === message.id
                ? {
                    lastMessage: {
                      ...c.lastMessage,
                      content: message.content,
                      messageType: message.messageType,
                      previewText,
                      sender: message.sender,
                      attachments: message.attachments?.map((a) => ({ mimeType: a.mimeType })),
                    },
                  }
                : null;

            const latestPinned = c.pinSummary?.latestPinnedMessage;
            const patchPinSummary =
              latestPinned?.id === message.id
                ? {
                    pinSummary: {
                      pinnedCount: c.pinSummary?.pinnedCount ?? 0,
                      latestPinnedMessage: {
                        ...latestPinned,
                        messageType: message.messageType,
                        previewText,
                      },
                    },
                  }
                : null;

            if (!patchLastMessage && !patchPinSummary) return c;
            return { ...c, ...patchLastMessage, ...patchPinSummary };
          });
        },
      );

      patchPinnedItemsCache(message.conversationId, (items) => {
        let didChange = false;
        const nextItems = items.map((item) => {
          if (item.messageId !== message.id) return item;
          didChange = true;
          return {
            ...item,
            message: {
              ...item.message,
              content: message.content,
              previewText: derivePreviewText(message),
              messageType: message.messageType,
              attachments: mapPinnedAttachments(message.attachments),
            },
          };
        });
        return didChange ? nextItems : items;
      });
    }
    socket.on("messageUpdated", handleMessageUpdated);
    return () => {
      socket.off("messageUpdated", handleMessageUpdated);
    };
  }, [socket, currentUserId, queryClient]);

  // Backfill sidebar preview when the current last message gets deleted.
  // Merges lastMessage backfill and pinSummary patch into a single setQueryData call.
  useEffect(() => {
    if (!socket || !currentUserId) return;
    const userId = currentUserId;
    function handleMessageDeleted(payload: MessageDeletedPayload) {
      queryClient.setQueryData<ConversationsResponse[]>(
        conversationsQueryKey(userId),
        (prev) => {
          if (!prev) return prev;
          let didChange = false;

          const next = prev.map((conversation) => {
            if (conversation.id !== payload.conversationId) return conversation;

            let result = conversation;

            // Backfill lastMessage if the deleted message was the last one.
            if (
              conversation.lastMessage?.id === payload.messageId &&
              Object.prototype.hasOwnProperty.call(payload, "nextLastMessage")
            ) {
              didChange = true;
              const nextLastMessage = payload.nextLastMessage;
              if (nextLastMessage == null) {
                result = { ...result, lastMessage: null };
              } else {
                const previewText = derivePreviewText(nextLastMessage);
                result = {
                  ...result,
                  lastMessage: {
                    id: nextLastMessage.id,
                    content: nextLastMessage.content,
                    messageType: nextLastMessage.messageType,
                    previewText,
                    createdAt: nextLastMessage.createdAt,
                    sender: nextLastMessage.sender,
                    attachments: nextLastMessage.attachments?.map((a) => ({
                      mimeType: a.mimeType,
                    })),
                  },
                };
              }
            }

            // Patch pinSummary if the backend sent an updated one.
            if (payload.pinSummary) {
              didChange = true;
              result = { ...result, pinSummary: payload.pinSummary };
            }

            return result;
          });

          return didChange ? next : prev;
        },
      );

      patchPinnedItemsCache(payload.conversationId, (items) => {
        const nextItems = items.filter((item) => item.messageId !== payload.messageId);
        return nextItems.length === items.length ? items : nextItems;
      });
    }
    socket.on("messageDeleted", handleMessageDeleted);
    return () => {
      socket.off("messageDeleted", handleMessageDeleted);
    };
  }, [socket, currentUserId, queryClient]);

  useEffect(() => {
    if (!socket || !currentUserId) return;
    const userId = currentUserId;
    function handleMessagePinned(payload: MessagePinnedPayload) {
      queryClient.setQueryData<ConversationsResponse[]>(
        conversationsQueryKey(userId),
        (prev) => {
          if (!prev) return prev;
          return prev.map((conversation) =>
            conversation.id === payload.conversationId
              ? {
                  ...conversation,
                  pinSummary: {
                    pinnedCount: payload.pinnedCount,
                    latestPinnedMessage: payload.latestPinnedMessage,
                  },
                }
              : conversation,
          );
        },
      );

      patchPinnedItemsCache(payload.conversationId, (items) => {
        const withoutMessage = items.filter(
          (item) => item.messageId !== payload.pinnedItem.messageId,
        );
        const nextItems = sortPinnedItemsDesc([payload.pinnedItem, ...withoutMessage]);
        return nextItems.slice(0, 10);
      });
    }
    socket.on("messagePinned", handleMessagePinned);
    return () => {
      socket.off("messagePinned", handleMessagePinned);
    };
  }, [socket, currentUserId, queryClient]);

  useEffect(() => {
    if (!socket || !currentUserId) return;
    const userId = currentUserId;
    function handleMessageUnpinned(payload: MessageUnpinnedPayload) {
      queryClient.setQueryData<ConversationsResponse[]>(
        conversationsQueryKey(userId),
        (prev) => {
          if (!prev) return prev;
          return prev.map((conversation) =>
            conversation.id === payload.conversationId
              ? {
                  ...conversation,
                  pinSummary: {
                    pinnedCount: payload.pinnedCount,
                    latestPinnedMessage: payload.latestPinnedMessage,
                  },
                }
              : conversation,
          );
        },
      );

      patchPinnedItemsCache(payload.conversationId, (items) => {
        const nextItems = items.filter((item) => item.messageId !== payload.messageId);
        return nextItems.length === items.length ? items : nextItems;
      });
    }
    socket.on("messageUnpinned", handleMessageUnpinned);
    return () => {
      socket.off("messageUnpinned", handleMessageUnpinned);
    };
  }, [socket, currentUserId, queryClient]);
}
