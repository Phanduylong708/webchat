import React from "react";
import FriendListPanel from "@/components/layout/FriendListPanel";
import MainContentPanel from "@/components/layout/MainContentPanel";

export default function FriendsPage(): React.JSX.Element {
  return (
    <div className="grid grid-cols-[300px_1fr] h-screen">
      <FriendListPanel />
      <MainContentPanel>
        <div>Friend Details</div>
      </MainContentPanel>
    </div>
  );
}
