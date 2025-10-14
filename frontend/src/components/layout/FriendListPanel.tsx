import React from "react";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

const MOCK_FRIENDS = [
  {
    id: 1,
    username: "john_doe",
    avatar: null,
    isOnline: true,
    lastSeen: null,
  },
  {
    id: 2,
    username: "sarah_wilson",
    avatar: null,
    isOnline: false,
    lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  },
  {
    id: 3,
    username: "mike_chen",
    avatar: null,
    isOnline: true,
    lastSeen: null,
  },
  {
    id: 4,
    username: "emma_davis",
    avatar: null,
    isOnline: false,
    lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
  },
];

function FriendItem({ friend }: { friend: any }) {
  return (
    <div
      className="group flex items-center gap-3 p-3 rounded-lg bg-background border
  border-border hover:bg-accent hover:border-accent-foreground/20 cursor-pointer
  transition-all"
    >
      <Avatar className="size-10">
        <AvatarImage src={friend.avatar || undefined} />
        <AvatarFallback>{friend.username[0].toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{friend.username}</p>
        <p className="text-xs text-muted-foreground">
          {friend.isOnline ? (
            <span className="text-green-500">● Online</span>
          ) : (
            <span>Last seen {formatLastSeen(friend.lastSeen)}</span>
          )}
        </p>
      </div>

      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 flex
  items-center justify-center rounded-md hover:bg-destructive/10 hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          console.log("Delete friend:", friend.id);
        }}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function formatLastSeen(date: Date | null): string {
  if (!date) return "recently";

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return "recently";
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function FriendListPanel(): React.JSX.Element {
  return (
    <div className="h-full flex flex-col bg-muted border-r border-border">
      <div className="p-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Friends</h2>
        <Button size="icon" variant="ghost">
          <Plus size={20} />
        </Button>
      </div>
      <Separator />
      <div className="p-4">
        <Input placeholder="Search friends..." className="bg-background" />
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="p-2 gap-2 flex flex-col">
          {MOCK_FRIENDS.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No friends yet. Add some!
            </div>
          ) : (
            MOCK_FRIENDS.map((friend) => (
              <FriendItem key={friend.id} friend={friend} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
