import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getConversations,
  createGroupApi,
  addMemberApi,
  leaveGroupApi,
  removeMemberApi,
  getConversationsDetails,
} from "@/features/conversation/api/conversation.api";
import type { ConversationsDetail, ConversationsResponse } from "@/types/chat.type";
import { useAuth } from "@/features/auth/providers/useAuth";

const CONVERSATIONS_GC_TIME = 60 * 60 * 1000;

export const conversationsQueryKey = (userId: number) => ["conversations", userId] as const;
export const conversationDetailsQueryKey = (conversationId: number) =>
  ["conversation-details", conversationId] as const;

export function useConversationsQuery() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: userId ? conversationsQueryKey(userId) : (["conversations", "unauthenticated"] as const),
    queryFn: getConversations,
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: CONVERSATIONS_GC_TIME,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useConversationDetailsQuery(conversationId: number, enabled = true) {
  return useQuery({
    queryKey: conversationDetailsQueryKey(conversationId),
    queryFn: () => getConversationsDetails(conversationId),
    enabled: Boolean(conversationId) && enabled,
    staleTime: Infinity,
    gcTime: CONVERSATIONS_GC_TIME,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useCreateGroupMutation() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ title, memberIds }: { title: string; memberIds: number[] }) =>
      createGroupApi(title, memberIds),
    onSuccess: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({
        queryKey: conversationsQueryKey(userId),
      });
    },
  });
}

export function useAddMemberMutation() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, userId: targetUserId }: { conversationId: number; userId: number }) =>
      addMemberApi(conversationId, targetUserId),
    onSuccess: (_, { conversationId }) => {
      if (!userId) return;
      void queryClient.invalidateQueries({
        queryKey: conversationsQueryKey(userId),
      });
      void queryClient.invalidateQueries({
        queryKey: conversationDetailsQueryKey(conversationId),
      });
    },
  });
}

export function useLeaveGroupMutation() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: number) => leaveGroupApi(conversationId),
    onSuccess: (_, conversationId) => {
      if (!userId) return;
      queryClient.setQueryData<ConversationsResponse[]>(conversationsQueryKey(userId), (prev) => {
        if (!prev) return prev;
        return prev.filter((c) => c.id !== conversationId);
      });
      queryClient.removeQueries({ queryKey: conversationDetailsQueryKey(conversationId) });
    },
  });
}

export function useRemoveMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: number; userId: number }) =>
      removeMemberApi(conversationId, userId),
    onSuccess: (_, { conversationId }) => {
      void queryClient.invalidateQueries({
        queryKey: conversationDetailsQueryKey(conversationId),
      });
    },
  });
}

// Re-export ConversationsDetail so consumers can import from one place
export type { ConversationsDetail };
