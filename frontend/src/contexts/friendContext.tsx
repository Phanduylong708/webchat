import React, { createContext, useMemo, useState, useCallback } from "react";
import type { FriendContextType, Friend } from "@/types/friend.type";
import {
  getFriends,
  addFriendById,
  removeFriendById,
  searchUserByUsername,
} from "@/api/friend.api";

const FriendContext = createContext<FriendContextType | undefined>(undefined);

function FriendProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const selectedFriend = useMemo(() => {
    if (selectedFriendId === null) return null;
    return friends.find((friend) => friend.id === selectedFriendId) || null;
  }, [friends, selectedFriendId]);

  const selectFriend = useCallback((id: number | null): void => {
    setSelectedFriendId(id);
  }, []);

  const fetchFriends = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const friendsList = await getFriends();
      setFriends(friendsList);
    } catch (err) {
      const caughtError = err as {
        message: string;
      };
      setError(
        caughtError.message || "Failed to fetch friends. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const removeFriend = useCallback(
    async (id: number): Promise<{ success: boolean; message?: string }> => {
      try {
        setLoading(true);
        setError(null);
        await removeFriendById(id);
        await fetchFriends();
        if (selectedFriendId === id) {
          setSelectedFriendId(null);
        }
        return { success: true };
      } catch (err) {
        const caughtError = err as {
          message?: string;
        };
        return {
          success: false,
          message:
            caughtError.message ?? "Failed to remove friend. Please try again.",
        };
      } finally {
        setLoading(false);
      }
    },
    [fetchFriends, selectedFriendId]
  );

  const addFriend = useCallback(
    async (username: string): Promise<{ success: boolean; message?: string }> => {
      try {
        setLoading(true);
        setError(null);
        const trimmed = username.trim();
        if (!trimmed) {
          setError("Username cannot be empty.");
          return { success: false };
        }
        const user = await searchUserByUsername(trimmed);
        await addFriendById(user.id);
        await fetchFriends();
        setSelectedFriendId(user.id);
        return { success: true };
      } catch (err) {
        const caughtError = err as {
          message?: string;
        };
        return {
          success: false,
          message:
            caughtError.message ?? "Failed to add friend. Please try again.",
        };
      } finally {
        setLoading(false);
      }
    },
    [fetchFriends]
  );

  const value = {
    //TODO Add useMemo
    friends,
    selectedFriend,
    loading,
    error,
    selectFriend,
    fetchFriends,
    removeFriend,
    addFriend,
  };

  return (
    <FriendContext.Provider value={value}>{children}</FriendContext.Provider>
  );
}

export { FriendContext, FriendProvider };
