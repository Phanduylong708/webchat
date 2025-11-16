import type { FriendContextType } from "@/types/friend.type";
import { FriendContext } from "@/contexts/friendContext";
import React from "react";

export function useFriend(): FriendContextType {
  const context = React.useContext(FriendContext);
  if (!context)
    throw new Error("useFriend must be used within a FriendProvider");
  return context;
}
