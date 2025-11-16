import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { Socket } from "socket.io-client";
import type {
  ConversationsDetail,
  ConversationsResponse,
  User,
} from "@/types/chat.type";
import type { Messages } from "@/types/chat.type";
import { updateTypingMap, resolveLeavingUsername } from "@/utils/conversation.utils";

type ConversationSetter = Dispatch<SetStateAction<ConversationsResponse[]>>;
type OnlineUsersSetter = Dispatch<SetStateAction<Set<number>>>;
type TypingSetter = Dispatch<
  SetStateAction<Map<number, Map<number, string>>>
>;
type SystemMessageSetter = Dispatch<SetStateAction<Map<number, string>>>;

interface UseConversationSocketsParams {
  socket: Socket | null;
  setConversations: ConversationSetter;
  setOnlineUsers: OnlineUsersSetter;
  setTypingByConversation: TypingSetter;
  setSystemMessages: SystemMessageSetter;
}

/**
 * Centralizes all socket listeners that impact conversation state.
 * Keeps ConversationProvider lean by encapsulating subscriptions here.
 */
export function useConversationSockets({
  socket,
  setConversations,
  setOnlineUsers,
  setTypingByConversation,
  setSystemMessages,
}: UseConversationSocketsParams): void {
  // Update conversation list preview (last message + ordering) when a new message arrives.
  useEffect(() => {
    if (!socket) return;
    function handleConversationPreviewUpdate(message: Messages) {
      setConversations((prev) => {
        // Only update if this conversation exists in current list.
        const conversation = prev.find(
          (c) => c.id === message.conversationId
        );
        if (!conversation) return prev;

        // Construct a lightweight lastMessage preview for the sidebar.
        const newLastMessage = {
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          sender: message.sender,
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

  // Track friend online/offline status to surface presence in UI.
  useEffect(() => {
    if (!socket) return;
    function handleOnline(payload: { userId: number }) {
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        updated.add(payload.userId);
        return updated;
      });
    }

    function handleOffline(payload: { userId: number }) {
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        updated.delete(payload.userId);
        return updated;
      });
    }

    socket.on("friendOnline", handleOnline);
    socket.on("friendOffline", handleOffline);
    return () => {
      socket.off("friendOnline", handleOnline);
      socket.off("friendOffline", handleOffline);
    };
  }, [socket, setOnlineUsers]);

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
    function handleMemberAdded(payload: { conversationId: number; member: User }) {
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
      const newConv: ConversationsResponse = {
        id: payload.conversation.id,
        title: payload.conversation.title,
        type: payload.conversation.type,
        memberCount: payload.conversation.members.length,
        previewMembers: payload.conversation.members.slice(0, 3),
        lastMessage: null,
      };
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === newConv.id);
        if (exists) return prev;
        // Prepend new group/private conversation so it shows up at top of list
        return [newConv, ...prev];
      });
    }
    socket.on("addedToConversation", handleAdded);
    return () => {
      socket.off("addedToConversation", handleAdded);
    };
  }, [socket, setConversations]);

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
}
