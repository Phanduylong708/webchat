import React, { createContext, useMemo, useState } from "react";
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

  function selectFriend(id: number | null): void {
    setSelectedFriendId(id);
  }

  async function fetchFriends(): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      const friendsList = await getFriends();
      setFriends(friendsList);
    } catch (err) {
      const caughtError = err as {
        message: string;
        code: string;
        status: number;
      };
      setError(
        caughtError.message || "Failed to fetch friends. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeFriend(id: number): Promise<boolean> {
    try {
      setLoading(true);
      setError(null);
      await removeFriendById(id);
      await fetchFriends();
      if (selectedFriendId === id) {
        setSelectedFriendId(null);
      }
      return true;
    } catch (err) {
      const caughtError = err as {
        message: string;
        code: string;
        status: number;
      };
      setError(
        caughtError.message || "Failed to remove friend. Please try again."
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function addFriend(username: string): Promise<boolean> {
    try {
      setLoading(true);
      setError(null);
      const trimmed = username.trim();
      if (!trimmed) {
        setError("Username cannot be empty.");
        return false;
      }
      const user = await searchUserByUsername(trimmed);
      await addFriendById(user.id);
      await fetchFriends();
      setSelectedFriendId(user.id);
      return true;
    } catch (err) {
      const caughtError = err as {
        message: string;
        code: string;
        status: number;
      };
      setError(
        caughtError.message || "Failed to add friend. Please try again."
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  const value = {
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
