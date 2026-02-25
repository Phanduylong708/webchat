import React, { useCallback, useEffect, useMemo } from "react";
import FriendListPanel from "@/components/layout/FriendListPanel";
import MainContentPanel from "@/components/layout/MainContentPanel";
import FriendProfile from "@/components/friends/FriendProfile";
import EmptyState from "@/components/friends/EmptyState";
import { useSearchParams } from "react-router-dom";
import { useFriendsQuery } from "@/hooks/queries/friends";
import type { Friend } from "@/types/friend.type";

export default function FriendPage(): React.JSX.Element {
  const friendsQuery = useFriendsQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const friends = friendsQuery.data ?? [];

  const friendIdParam = searchParams.get("friendId");
  const friendIdFromUrl = useMemo(() => {
    if (!friendIdParam) {
      return null;
    }
    const parsed = Number(friendIdParam);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }, [friendIdParam]);

  // Clear invalid friendId formats immediately
  useEffect(() => {
    if (friendIdParam && friendIdFromUrl === null) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("friendId");
        return next;
      }, { replace: true });
    }
  }, [friendIdFromUrl, friendIdParam, setSearchParams]);

  const selectedFriend: Friend | null = useMemo(() => {
    if (!friendIdFromUrl || !friendsQuery.data) {
      return null;
    }
    return (
      friendsQuery.data.find((friend) => friend.id === friendIdFromUrl) ?? null
    );
  }, [friendIdFromUrl, friendsQuery.data]);

  const handleSelectFriend = useCallback(
    (friendId: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("friendId", String(friendId));
        return next;
      });
    },
    [setSearchParams]
  );

  const handleClearSelection = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!next.has("friendId")) {
        return prev;
      }
      next.delete("friendId");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return (
    <div className="grid grid-cols-[300px_1fr] h-screen">
      <FriendListPanel
        friends={friends}
        isLoading={friendsQuery.isLoading}
        error={friendsQuery.error ?? null}
        refetch={() => {
          void friendsQuery.refetch();
        }}
        selectedFriendId={selectedFriend?.id ?? null}
        onSelectFriendId={handleSelectFriend}
        onClearSelection={handleClearSelection}
      />
      <MainContentPanel>
        {selectedFriend ? (
          <FriendProfile friend={selectedFriend} onClearSelection={handleClearSelection} />
        ) : (
          <EmptyState />
        )}
      </MainContentPanel>
    </div>
  );
}
