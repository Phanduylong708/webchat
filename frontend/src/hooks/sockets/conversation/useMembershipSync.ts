import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import type { ConversationsDetail, ConversationsResponse, User } from "@/types/chat.type";
import { resolveLeavingUsername } from "@/utils/conversation.utils";
import { conversationsQueryKey, conversationDetailsQueryKey } from "@/hooks/queries/conversations";

type SystemMessageSetter = Dispatch<SetStateAction<Map<number, string>>>;

interface UseMembershipSyncParams {
  socket: Socket | null;
  currentUserId: number | null;
  setSystemMessages: SystemMessageSetter;
  clearActiveConversation: (conversationId: number) => void;
}

export function useMembershipSync({
  socket,
  currentUserId,
  setSystemMessages,
  clearActiveConversation,
}: UseMembershipSyncParams): void {
  const queryClient = useQueryClient();

  // Keep preview member list + counts in sync when someone is added.
  // Also patches the details cache so GroupMembersDialog stays fresh.
  useEffect(() => {
    if (!socket || !currentUserId) return;
    const userId = currentUserId;
    function handleMemberAdded(payload: { conversationId: number; member: User }) {
      // Patch list cache (previewMembers + memberCount)
      queryClient.setQueryData<ConversationsResponse[]>(
        conversationsQueryKey(userId),
        (prev) => {
          if (!prev) return prev;
          return prev.map((c) => {
            if (c.id !== payload.conversationId) return c;
            const existingMembers = c.previewMembers ?? [];
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

      // Patch details cache — append member if not already present.
      queryClient.setQueryData<ConversationsDetail>(
        conversationDetailsQueryKey(payload.conversationId),
        (prev) => {
          if (!prev) return prev;
          const alreadyExists = prev.members.some((m) => m.id === payload.member.id);
          if (alreadyExists) return prev;
          return { ...prev, members: [...prev.members, payload.member] };
        },
      );
    }
    socket.on("memberAdded", handleMemberAdded);
    return () => {
      socket.off("memberAdded", handleMemberAdded);
    };
  }, [socket, currentUserId, queryClient]);

  // Add brand-new conversations when the backend notifies the user was added.
  // Also seeds the details cache so an immediate dialog open doesn't need a network round-trip.
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

      // Seed details cache from socket payload — avoids a network fetch if dialog opens immediately.
      queryClient.setQueryData<ConversationsDetail>(
        conversationDetailsQueryKey(conv.id),
        (prev) => prev ?? conv,
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

      // Patch details cache — filter leaving member out.
      const leavingUserId = payload.user?.id ?? payload.userId;
      if (leavingUserId) {
        queryClient.setQueryData<ConversationsDetail>(
          conversationDetailsQueryKey(payload.conversationId),
          (prev) => {
            if (!prev) return prev;
            const next = prev.members.filter((m) => m.id !== leavingUserId);
            if (next.length === prev.members.length) return prev;
            return { ...prev, members: next };
          },
        );
      }

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
  // Also removes the details cache entry — no point keeping stale data for a conversation
  // the user no longer has access to.
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

      queryClient.removeQueries({ queryKey: conversationDetailsQueryKey(payload.conversationId) });
      clearActiveConversation(payload.conversationId);
      toast.info(`You were removed from ${groupTitle}`);
    }
    socket.on("youWereKicked", handleYouWereKicked);
    return () => {
      socket.off("youWereKicked", handleYouWereKicked);
    };
  }, [socket, currentUserId, queryClient, clearActiveConversation]);
}
