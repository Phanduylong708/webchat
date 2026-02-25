import React, { useCallback, useEffect, useMemo } from "react";
import FriendListPanel from "@/components/layout/FriendListPanel";
import MainContentPanel from "@/components/layout/MainContentPanel";
import FriendProfile from "@/components/friends/FriendProfile";
import EmptyState from "@/components/friends/EmptyState";
import { FriendProvider } from "@/contexts/friendContext";
import { useFriend } from "@/hooks/context/useFriend";
import { useSearchParams } from "react-router-dom";

export default function FriendPage(): React.JSX.Element {
  return (
    <FriendProvider>
      <FriendPageContent />
    </FriendProvider>
  );
}

function FriendPageContent(): React.JSX.Element {
  const { selectedFriend, selectFriend } = useFriend();
  const [searchParams, setSearchParams] = useSearchParams();

  const friendIdParam = searchParams.get("friendId");
  const friendIdFromUrl = useMemo(() => {
    if (!friendIdParam) {
      return null;
    }
    const parsed = Number(friendIdParam);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return parsed;
  }, [friendIdParam]);

  useEffect(() => {
    if (friendIdParam && friendIdFromUrl === null) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("friendId");
        return next;
      }, { replace: true });
      return;
    }

    if (friendIdFromUrl !== null && selectedFriend?.id !== friendIdFromUrl) {
      selectFriend(friendIdFromUrl);
    }

    if (friendIdFromUrl === null && selectedFriend) {
      selectFriend(null);
    }
  }, [friendIdFromUrl, friendIdParam, selectedFriend, selectFriend, setSearchParams]);

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
        selectedFriendId={selectedFriend?.id ?? null}
        onSelectFriendId={handleSelectFriend}
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
