import React from "react";
import formatLastSeen from "@/utils/helper.util";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedAvatarUrl, getAvatarFallback } from "@/utils/image.util";
import type { Friend } from "@/features/friends/types/friend.type";
import AddFriendDialog from "@/features/friends/components/AddFriendDialog";
import RemoveFriendDialog from "@/features/friends/components/RemoveFriendDialog";
import useSocket from "@/app/providers/useSocket";

interface FriendListPanelProps {
  friends: Friend[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  selectedFriendId: number | null;
  onSelectFriendId: (friendId: number) => void;
  onClearSelection: () => void;
}

function FriendItem({
  friend,
  displayIsOnline,
  displayLastSeen,
  isSelected,
  onSelect,
  onRemoved,
}: {
  friend: Friend;
  displayIsOnline: boolean;
  displayLastSeen: string | null;
  isSelected: boolean;
  onSelect: (friendId: number) => void;
  onRemoved: () => void;
}): React.JSX.Element {
  return (
    <div
      className={`group flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer transition-all ${
        isSelected
          ? "bg-accent border-accent-foreground/40"
          : "bg-background hover:bg-accent hover:border-accent-foreground/20"
      }`}
      onClick={() => onSelect(friend.id)}
    >
      <div className="relative shrink-0">
        <Avatar className="size-10">
          <AvatarImage src={getOptimizedAvatarUrl(friend.avatar, 40)} />
          <AvatarFallback>{getAvatarFallback(friend.username)}</AvatarFallback>
        </Avatar>
        <span
          className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background ${
            displayIsOnline ? "bg-green-500" : "bg-muted-foreground/30"
          }`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{friend.username}</p>
        <p className="text-xs text-muted-foreground">
          {displayIsOnline ? (
            <span className="text-green-500">Online</span>
          ) : (
            <span>Last seen {formatLastSeen(displayLastSeen)}</span>
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
          onRemove={onRemoved}
        />
      </div>
    </div>
  );
}

export default function FriendListPanel({
  friends,
  isLoading,
  error,
  refetch,
  selectedFriendId,
  onSelectFriendId,
  onClearSelection,
}: FriendListPanelProps): React.JSX.Element {
  const errorMessage = error?.message ?? null;
  const { isConnected, presenceByUserId } = useSocket();

  function renderFriendList(): React.JSX.Element {
    if (isLoading) {
      return <div className="text-center text-muted-foreground py-8">Loading...</div>;
    }

    if (errorMessage && friends.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          <Button onClick={refetch}>Error: {errorMessage}. Retry</Button>
        </div>
      );
    }

    if (friends.length === 0) {
      return <div className="text-center text-muted-foreground py-8">No friends yet. Add some!</div>;
    }

    return (
      <>
        {friends.map((friend) => {
          const presence = isConnected ? presenceByUserId.get(friend.id) : undefined;
          const displayIsOnline = presence?.isOnline ?? friend.isOnline;
          const displayLastSeen = presence?.lastSeen ?? friend.lastSeen;

          return (
            <FriendItem
              key={friend.id}
              friend={friend}
              displayIsOnline={displayIsOnline}
              displayLastSeen={displayLastSeen}
              isSelected={friend.id === selectedFriendId}
              onSelect={onSelectFriendId}
              onRemoved={() => {
                if (friend.id === selectedFriendId) {
                  onClearSelection();
                }
              }}
            />
          );
        })}
      </>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted border-r border-border">
      <div className="p-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Friends</h2>
        <AddFriendDialog onFriendAdded={onSelectFriendId} />
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
