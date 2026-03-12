import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getConversations,
  createGroupApi,
  addMemberApi,
  leaveGroupApi,
  removeMemberApi,
} from "@/api/conversation.api";
import type { ConversationsResponse } from "@/types/chat.type";
import { useAuth } from "@/hooks/context/useAuth";

const CONVERSATIONS_GC_TIME = 60 * 60 * 1000;

export const conversationsQueryKey = (userId: number) => ["conversations", userId] as const;

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
    onSuccess: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({
        queryKey: conversationsQueryKey(userId),
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
    },
  });
}

export function useRemoveMemberMutation() {
  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: number; userId: number }) =>
      removeMemberApi(conversationId, userId),
  });
}
