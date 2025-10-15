import React, { useEffect } from "react";
import formatLastSeen from "@/utils/date.util";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Trash2 } from "lucide-react";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import type { Friend } from "@/types/friend.type";
import { useFriend } from "@/hooks/useFriend";
import AddFriendDialog from "../friends/AddFriendDialog";
import RemoveFriendDialog from "../friends/RemoveFriendDialog";
function FriendItem({ friend }: { friend: Friend }): React.JSX.Element {
  const { selectFriend } = useFriend();

  return (
    <div
      className="group flex items-center gap-3 p-3 rounded-lg bg-background border
  border-border hover:bg-accent hover:border-accent-foreground/20 cursor-pointer
  transition-all"
      onClick={() => selectFriend(friend.id)}
    >
      <Avatar className="size-10">
        <AvatarImage src={friend.avatar || undefined} />
        <AvatarFallback>{friend.username[0].toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{friend.username}</p>
        <p className="text-xs text-muted-foreground">
          {friend.isOnline ? (
            <span className="text-green-500">Online</span>
          ) : (
            <span>Last seen {formatLastSeen(friend.lastSeen)}</span>
          )}
        </p>
      </div>

      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <RemoveFriendDialog
          friend={friend}
          trigger={
            <button
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 size={16} />
            </button>
          }
        />
      </div>
    </div>
  );
}

export default function FriendListPanel(): React.JSX.Element {
  const { friends, loading, error, fetchFriends } = useFriend();

  useEffect(() => {
    fetchFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //helper component to render friend list
  function renderFriendList(): React.JSX.Element {
    if (loading) {
      return (
        <div className="text-center text-muted-foreground py-8">Loading...</div>
      );
    }

    if (error && friends.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          <Button onClick={fetchFriends}>Error: {error}. Retry</Button>
        </div>
      );
    }

    if (friends.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          No friends yet. Add some!
        </div>
      );
    }

    return (
      <>
        {friends.map((friend) => (
          <FriendItem key={friend.id} friend={friend} />
        ))}
      </>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted border-r border-border">
      <div className="p-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Friends</h2>
        <AddFriendDialog />
      </div>
      <Separator />
      <div className="p-4">
        <Input placeholder="Search friends..." className="bg-background" />
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="p-2 gap-2 flex flex-col">{renderFriendList()}</div>
      </ScrollArea>
    </div>
  );
}
