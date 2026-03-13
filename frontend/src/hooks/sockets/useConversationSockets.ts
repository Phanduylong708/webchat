import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  ConversationsDetail,
  ConversationsResponse,
  PinSummary,
  PinnedMessageItem,
  User,
} from "@/types/chat.type";
import type { Messages } from "@/types/chat.type";
import {
  updateTypingMap,
  resolveLeavingUsername,
  derivePreviewText,
  applyNewMessageToConversationList,
} from "@/utils/conversation.utils";
import {
  sortPinnedItemsDesc,
  mapPinnedAttachments,
  patchPinnedItemsCache,
} from "@/utils/pin.util";
import { conversationsQueryKey } from "@/hooks/queries/conversations";
import useSocket from "@/hooks/context/useSocket";
import { useAuth } from "@/hooks/context/useAuth";

type TypingSetter = Dispatch<SetStateAction<Map<number, Map<number, string>>>>;
type SystemMessageSetter = Dispatch<SetStateAction<Map<number, string>>>;

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

interface UseConversationSocketsParams {
  setTypingByConversation: TypingSetter;
  setSystemMessages: SystemMessageSetter;
  /**
   * Called when the current user is kicked from a conversation.
   * The callback receives the kicked conversation ID so it can conditionally
   * clear the URL param only when that conversation is currently active.
   */
  clearActiveConversation: (conversationId: number) => void;
}

/**
 * Centralizes all socket listeners that impact conversation state.
 * Server state (conversation list) is patched via TanStack Query cache.
 * Ephemeral UI state (typing, system messages) is patched via setter props.
 */
export function useConversationSockets({
  setTypingByConversation,
  setSystemMessages,
  clearActiveConversation,
}: UseConversationSocketsParams): void {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  // Re-sync the conversation list after a socket reconnect.
  // Required safety net for staleTime: Infinity — without this a dropped
  // connection leaves the cache stale indefinitely.
  useEffect(() => {
    if (!socket || !currentUserId) return;
    const userId = currentUserId;
    function handleReconnect() {
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId) });
    }
    socket.on("connect", handleReconnect);
    return () => {
      socket.off("connect", handleReconnect);
    };
  }, [socket, currentUserId, queryClient]);

  // Update conversation list preview (last message + ordering) when a new message arrives.
  useEffect(() => {
    if (!socket || !currentUserId) return;
    const userId = currentUserId;
    function handleConversationPreviewUpdate(message: Messages) {
      queryClient.setQueryData<ConversationsResponse[]>(
        conversationsQueryKey(userId),
        (prev) => {
          if (!prev) return prev;
          return applyNewMessageToConversationList(prev, message);
        },
      );
    }
    socket.on("newMessage", handleConversationPreviewUpdate);
    return () => {
      socket.off("newMessage", handleConversationPreviewUpdate);
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

  // Maintain typing indicators for each conversation.
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

  // Keep preview member list + counts in sync when someone is added.
  useEffect(() => {
    if (!socket || !currentUserId) return;
    const userId = currentUserId;
    function handleMemberAdded(payload: { conversationId: number; member: User }) {
      queryClient.setQueryData<ConversationsResponse[]>(
        conversationsQueryKey(userId),
        (prev) => {
          if (!prev) return prev;
          return prev.map((c) => {
            if (c.id !== payload.conversationId) return c;
            const existingMembers = c.previewMembers ?? [];
            // Prevent duplicates if socket event arrives multiple times.
            const alreadyExists = existingMembers.some((m) => m.id === payload.member.id);
            if (alreadyExists) return c;
            return {
              ...c,
              previewMembers: [...existingMembers, payload.member],
              memberCount: (c.memberCount ?? 0) + 1,
            };
          });
        },
      );
    }
    socket.on("memberAdded", handleMemberAdded);
    return () => {
      socket.off("memberAdded", handleMemberAdded);
    };
  }, [socket, currentUserId, queryClient]);

  // Add brand-new conversations when the backend notifies the user was added.
  useEffect(() => {
    if (!socket || !currentUserId) return;
    const userId = currentUserId;
    function handleAdded(payload: { conversation: ConversationsDetail }) {
      const conv = payload.conversation;
      let newConv: ConversationsResponse;

      if (conv.type === "PRIVATE") {
        const otherUser = conv.members.find((m) => m.id !== userId);
        newConv = {
          id: conv.id,
          title: null,
          type: "PRIVATE",
          otherUser,
          pinSummary: conv.pinSummary,
          pinPermission: conv.pinPermission,
          lastMessage: null,
        };
      } else {
        const previewMembers = conv.members.filter((m) => m.id !== userId).slice(0, 3);
        newConv = {
          id: conv.id,
          title: conv.title,
          type: "GROUP",
          memberCount: conv.members.length,
          previewMembers,
          pinSummary: conv.pinSummary,
          pinPermission: conv.pinPermission,
          lastMessage: null,
        };
      }

      queryClient.setQueryData<ConversationsResponse[]>(
        conversationsQueryKey(userId),
        (prev) => {
          if (!prev) return prev;
          const exists = prev.some((c) => c.id === newConv.id);
          if (exists) return prev;
          return [newConv, ...prev];
        },
      );
    }
    socket.on("addedToConversation", handleAdded);
    return () => {
      socket.off("addedToConversation", handleAdded);
    };
  }, [socket, currentUserId, queryClient]);

  // Remove leaving members and record a system banner for the conversation.
  // messageText is captured inside the setQueryData updater (which runs synchronously)
  // and read immediately after to update the ephemeral systemMessages state.
  useEffect(() => {
    if (!socket || !currentUserId) return;
    const userId = currentUserId;
    function handleMemberLeft(payload: {
      conversationId: number;
      userId?: number;
      user?: User;
    }) {
      let messageText: string | null = null;

      queryClient.setQueryData<ConversationsResponse[]>(
        conversationsQueryKey(userId),
        (prev) => {
          if (!prev) return prev;
          return prev.map((c) => {
            if (c.id !== payload.conversationId) return c;
            const existingMembers = c.previewMembers ?? [];
            const leavingUserId = payload.user?.id ?? payload.userId;
            const updatedMembers = leavingUserId
              ? existingMembers.filter((member) => member.id !== leavingUserId)
              : existingMembers;
            const updatedCount = Math.max(0, (c.memberCount ?? 1) - 1);
            const name = resolveLeavingUsername(payload.user, existingMembers, leavingUserId);
            messageText = `${name} left the group`;
            return { ...c, previewMembers: updatedMembers, memberCount: updatedCount };
          });
        },
      );

      if (messageText) {
        setSystemMessages((prev) => {
          const updated = new Map(prev);
          updated.set(payload.conversationId, messageText!);
          return updated;
        });
      }
    }
    socket.on("memberLeft", handleMemberLeft);
    return () => {
      socket.off("memberLeft", handleMemberLeft);
    };
  }, [socket, currentUserId, queryClient, setSystemMessages]);

  // Remove the conversation and notify the user when they are kicked from a group.
  useEffect(() => {
    if (!socket || !currentUserId) return;
    const userId = currentUserId;
    function handleYouWereKicked(payload: { conversationId: number }) {
      let groupTitle = "the group";

      queryClient.setQueryData<ConversationsResponse[]>(
        conversationsQueryKey(userId),
        (prev) => {
          if (!prev) return prev;
          const conversation = prev.find((c) => c.id === payload.conversationId);
          if (conversation?.type === "GROUP" && conversation.title) {
            groupTitle = conversation.title;
          }
          return prev.filter((c) => c.id !== payload.conversationId);
        },
      );

      clearActiveConversation(payload.conversationId);
      toast.info(`You were removed from ${groupTitle}`);
    }
    socket.on("youWereKicked", handleYouWereKicked);
    return () => {
      socket.off("youWereKicked", handleYouWereKicked);
    };
  }, [socket, currentUserId, queryClient, clearActiveConversation]);
}
