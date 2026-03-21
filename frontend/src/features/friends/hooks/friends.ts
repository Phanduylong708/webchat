import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addFriendById,
  getFriends,
  removeFriendById,
  searchUserByUsername,
} from "@/features/friends/api/friend.api";
import type { Friend } from "@/features/friends/types/friend.type";
import { useAuth } from "@/features/auth/providers/useAuth";

const FRIENDS_GC_TIME = 60 * 60 * 1000;

const friendsQueryKey = (userId: number) => ["friends", userId] as const;

export function useFriendsQuery() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryKey = userId
    ? friendsQueryKey(userId)
    : (["friends", "unauthenticated"] as const);

  return useQuery({
    queryKey,
    queryFn: getFriends,
    enabled: Boolean(userId),
    staleTime: Infinity,
    gcTime: FRIENDS_GC_TIME,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useAddFriendMutation() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (username: string) => {
      if (!userId) {
        throw new Error("Not authenticated");
      }

      const userResult = await searchUserByUsername(username);
      const friend = await addFriendById(userResult.id);
      return friend;
    },
    onSuccess: async (friend) => {
      if (!userId) {
        return;
      }

      await queryClient.cancelQueries({ queryKey: friendsQueryKey(userId) });
      queryClient.setQueryData<Friend[]>(friendsQueryKey(userId), (old) => {
        const previous = old ?? [];
        const exists = previous.some((item) => item.id === friend.id);
        if (exists) {
          return previous;
        }
        return [...previous, friend];
      });
    },
  });
}

export function useRemoveFriendMutation() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendId: number) => {
      if (!userId) {
        throw new Error("Not authenticated");
      }

      await removeFriendById(friendId);
      return friendId;
    },
    onSuccess: async (friendId) => {
      if (!userId) {
        return;
      }

      await queryClient.cancelQueries({ queryKey: friendsQueryKey(userId) });
      queryClient.setQueryData<Friend[]>(friendsQueryKey(userId), (old) => {
        if (!old) {
          return old;
        }
        return old.filter((friend) => friend.id !== friendId);
      });
    },
  });
}

export { friendsQueryKey };
