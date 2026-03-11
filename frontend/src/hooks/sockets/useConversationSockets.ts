import { useEffect, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import type { Socket } from "socket.io-client";
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
} from "@/utils/conversation.utils";
import {
  sortPinnedItemsDesc,
  mapPinnedAttachments,
  patchPinnedItemsCache,
} from "@/utils/pin.util";

type ConversationSetter = Dispatch<SetStateAction<ConversationsResponse[]>>;
type TypingSetter = Dispatch<SetStateAction<Map<number, Map<number, string>>>>;
type SystemMessageSetter = Dispatch<SetStateAction<Map<number, string>>>;

type ActiveConversationSetter = Dispatch<SetStateAction<number | null>>;

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
  socket: Socket | null;
  currentUserId: number | null;
  setConversations: ConversationSetter;
  setTypingByConversation: TypingSetter;
  setSystemMessages: SystemMessageSetter;
  setActiveConversationId: ActiveConversationSetter;
}


/**
 * Centralizes all socket listeners that impact conversation state.
 * Keeps ConversationProvider lean by encapsulating subscriptions here.
 */
export function useConversationSockets({
  socket,
  currentUserId,
  setConversations,
  setTypingByConversation,
  setSystemMessages,
  setActiveConversationId,
}: UseConversationSocketsParams): void {
  // Update conversation list preview (last message + ordering) when a new message arrives.
  useEffect(() => {
    if (!socket) return;
    function handleConversationPreviewUpdate(message: Messages) {
      setConversations((prev) => {
        // Only update if this conversation exists in current list.
        const conversation = prev.find((c) => c.id === message.conversationId);
        if (!conversation) return prev;

        // Construct a lightweight lastMessage preview for the sidebar.
        const previewText = derivePreviewText(message);

        const newLastMessage = {
          id: message.id,
          content: message.content,
          messageType: message.messageType,
          previewText,
          createdAt: message.createdAt,
          sender: message.sender,
          attachments: message.attachments?.map((a) => ({ mimeType: a.mimeType })),
        };

        // Update matching conversation, keep others untouched.
        const updated = prev.map((c) =>
          c.id === message.conversationId
            ? { ...c, lastMessage: newLastMessage }
            : c
        );

        // Resort so conversation bubbles to top (latest first ordering).
        const sorted = updated.sort((a, b) => {
          const timeA = a.lastMessage?.createdAt || "";
          const timeB = b.lastMessage?.createdAt || "";
          return timeB.localeCompare(timeA);
        });
        return sorted;
      });
    }
    socket.on("newMessage", handleConversationPreviewUpdate);
    return () => {
      socket.off("newMessage", handleConversationPreviewUpdate);
    };
  }, [socket, setConversations]);

  // Patch sidebar lastMessage preview when a message is edited.
  // No reordering: edit does not change createdAt.
  useEffect(() => {
    if (!socket) return;
    function handleMessageUpdated(message: Messages) {
      const previewText = derivePreviewText(message);

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== message.conversationId) return c;

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
        }),
      );

      patchPinnedItemsCache(message.conversationId, (items) => {
        let didChange = false;
        const nextItems = items.map((item) => {
          if (item.messageId !== message.id) {
            return item;
          }

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
  }, [socket, setConversations]);

  // Backfill sidebar preview when the current last message gets deleted.
  // No reordering: delete only changes preview content for the existing conversation row.
  useEffect(() => {
    if (!socket) return;
    function handleMessageDeleted(payload: MessageDeletedPayload) {
      setConversations((prev) => {
        let didChange = false;

        const nextConversations = prev.map((conversation) => {
          if (conversation.id !== payload.conversationId) return conversation;
          if (conversation.lastMessage?.id !== payload.messageId) return conversation;
          if (!Object.prototype.hasOwnProperty.call(payload, "nextLastMessage")) {
            return conversation;
          }

          didChange = true;
          const nextLastMessage = payload.nextLastMessage;

          if (nextLastMessage == null) {
            return {
              ...conversation,
              lastMessage: null,
            };
          }

          const previewText = derivePreviewText(nextLastMessage);
          return {
            ...conversation,
            lastMessage: {
              id: nextLastMessage.id,
              content: nextLastMessage.content,
              messageType: nextLastMessage.messageType,
              previewText,
              createdAt: nextLastMessage.createdAt,
              sender: nextLastMessage.sender,
              attachments: nextLastMessage.attachments?.map((attachment) => ({
                mimeType: attachment.mimeType,
              })),
            },
          };
        });

        return didChange ? nextConversations : prev;
      });

      if (payload.pinSummary) {
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === payload.conversationId
              ? {
                  ...conversation,
                  pinSummary: payload.pinSummary ?? null,
                }
              : conversation,
          ),
        );
      }

      patchPinnedItemsCache(payload.conversationId, (items) => {
        const nextItems = items.filter((item) => item.messageId !== payload.messageId);
        return nextItems.length === items.length ? items : nextItems;
      });
    }

    socket.on("messageDeleted", handleMessageDeleted);
    return () => {
      socket.off("messageDeleted", handleMessageDeleted);
    };
  }, [socket, setConversations]);

  useEffect(() => {
    if (!socket) return;

    function handleMessagePinned(payload: MessagePinnedPayload) {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === payload.conversationId
            ? {
                ...conversation,
                pinSummary: {
                  pinnedCount: payload.pinnedCount,
                  latestPinnedMessage: payload.latestPinnedMessage,
                },
              }
            : conversation,
        ),
      );

      patchPinnedItemsCache(payload.conversationId, (items) => {
        const withoutMessage = items.filter((item) => item.messageId !== payload.pinnedItem.messageId);
        const nextItems = sortPinnedItemsDesc([payload.pinnedItem, ...withoutMessage]);
        return nextItems.slice(0, 10);
      });
    }

    socket.on("messagePinned", handleMessagePinned);
    return () => {
      socket.off("messagePinned", handleMessagePinned);
    };
  }, [socket, setConversations]);

  useEffect(() => {
    if (!socket) return;

    function handleMessageUnpinned(payload: MessageUnpinnedPayload) {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === payload.conversationId
            ? {
                ...conversation,
                pinSummary: {
                  pinnedCount: payload.pinnedCount,
                  latestPinnedMessage: payload.latestPinnedMessage,
                },
              }
            : conversation,
        ),
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
  }, [socket, setConversations]);

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
        updateTypingMap(
          prev,
          payload.conversationId,
          payload.userId,
          payload.username,
          payload.isTyping
        )
      );
    }
    socket.on("userTyping", handleTyping);
    return () => {
      socket.off("userTyping", handleTyping);
    };
  }, [socket, setTypingByConversation]);

  // Keep preview member list + counts in sync when someone is added.
  useEffect(() => {
    if (!socket) return;
    function handleMemberAdded(payload: {
      conversationId: number;
      member: User;
    }) {
      setConversations((prev) => {
        return prev.map((c) => {
          if (c.id === payload.conversationId) {
            const existingMembers = c.previewMembers || [];

            // Prevent duplicates if socket event arrives multiple times.
            const alreadyExists = existingMembers.some(
              (member) => member.id === payload.member.id
            );
            if (alreadyExists) {
              return c;
            }
            // Add newest member to preview badge and increment count.
            const updatedMembers = [...existingMembers, payload.member];
            const updatedCount = (c.memberCount || 0) + 1;
            return {
              ...c,
              previewMembers: updatedMembers,
              memberCount: updatedCount,
            };
          }
          return c;
        });
      });
    }
    socket.on("memberAdded", handleMemberAdded);
    return () => {
      socket.off("memberAdded", handleMemberAdded);
    };
  }, [socket, setConversations]);

  // Add brand-new conversations when backend notifies user was added.

  useEffect(() => {
    if (!socket) return;
    function handleAdded(payload: { conversation: ConversationsDetail }) {
      const conv = payload.conversation;
      let newConv: ConversationsResponse;

      if (conv.type === "PRIVATE") {
        const otherUser = currentUserId
          ? conv.members.find((m) => m.id !== currentUserId)
          : undefined;
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
        const previewMembers = currentUserId
          ? conv.members.filter((m) => m.id !== currentUserId).slice(0, 3)
          : conv.members.slice(0, 3);
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

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === newConv.id);
        if (exists) return prev;
        return [newConv, ...prev];
      });
    }
    socket.on("addedToConversation", handleAdded);
    return () => {
      socket.off("addedToConversation", handleAdded);
    };
  }, [socket, currentUserId, setConversations]);

  // Remove leaving members and record a system banner for the conversation.
  useEffect(() => {
    if (!socket) return;
    function handleMemberLeft(payload: {
      conversationId: number;
      userId?: number;
      user?: User;
    }) {
      let messageText: string | null = null;
      setConversations((prev) => {
        return prev.map((c) => {
          if (c.id === payload.conversationId) {
            const existingMembers = c.previewMembers || [];
            const leavingUserId = payload.user?.id ?? payload.userId;
            const updatedMembers = leavingUserId
              ? existingMembers.filter((member) => member.id !== leavingUserId)
              : existingMembers;
            const updatedCount = Math.max(0, (c.memberCount || 1) - 1);
            const name = resolveLeavingUsername(
              payload.user,
              existingMembers,
              leavingUserId
            );
            messageText = `${name} left the group`;
            return {
              ...c,
              previewMembers: updatedMembers,
              memberCount: updatedCount,
            };
          }
          return c;
        });
      });
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
  }, [socket, setConversations, setSystemMessages]);

  // Remove the conversation and notify the user when they are kicked from a group.
  useEffect(() => {
    if (!socket) return;
    function handleYouWereKicked(payload: { conversationId: number }) {
      let groupTitle = "the group";
      setConversations((prev) => {
        const conversation = prev.find((c) => c.id === payload.conversationId);
        if (conversation?.type === "GROUP" && conversation.title) {
          groupTitle = conversation.title;
        }
        return prev.filter((c) => c.id !== payload.conversationId);
      });
      setActiveConversationId((prev) =>
        prev === payload.conversationId ? null : prev
      );
      toast.info(`You were removed from ${groupTitle}`);
    }
    socket.on("youWereKicked", handleYouWereKicked);
    return () => {
      socket.off("youWereKicked", handleYouWereKicked);
    };
  }, [socket, setConversations, setActiveConversationId]);
}
