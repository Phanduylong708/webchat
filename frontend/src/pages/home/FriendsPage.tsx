import React from "react";
import FriendListPanel from "@/components/layout/FriendListPanel";
import MainContentPanel from "@/components/layout/MainContentPanel";
import FriendProfile from "@/components/friends/FriendProfile";
import EmptyState from "@/components/friends/EmptyState";
import { FriendProvider } from "@/contexts/friendContext";
import { useFriend } from "@/hooks/context/useFriend";

export default function FriendPage(): React.JSX.Element {
  return (
    <FriendProvider>
      <FriendPageContent />
    </FriendProvider>
  );
}

function FriendPageContent(): React.JSX.Element {
  const { selectedFriend } = useFriend();
  return (
    <div className="grid grid-cols-[300px_1fr] h-screen">
      <FriendListPanel />
      <MainContentPanel>
        {selectedFriend ? (
          <FriendProfile friend={selectedFriend} />
        ) : (
          <EmptyState />
        )}
      </MainContentPanel>
    </div>
  );
}
