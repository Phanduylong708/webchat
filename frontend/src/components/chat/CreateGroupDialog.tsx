import React, { useState } from "react";
import { useConversation } from "@/hooks/context/useConversation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedAvatarUrl, getAvatarFallback } from "@/utils/image.util";
import { Plus } from "lucide-react";
import { useFriendsQuery } from "@/hooks/queries/friends";

export default function CreateGroupDialog(): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const friendsQuery = useFriendsQuery();
  const friends = friendsQuery.data ?? [];
  const { createGroup } = useConversation();
  const isValid = title.trim() !== "" && selectedFriendIds.length >= 2;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);

    try {
      const { success, message } = await createGroup(title, selectedFriendIds);

      if (success) {
        // Success: close dialog, reset form
        setIsOpen(false);
        setTitle("");
        setSelectedFriendIds([]);
      } else {
        // Error: show message
        setLocalError(message || "Failed to create group");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleFriend(friendId: number) {
    setSelectedFriendIds((prev) => {
      if (prev.includes(friendId)) {
        return prev.filter((id) => id !== friendId);
      }
      return [...prev, friendId];
    });
  }
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="bg-background">
          <Plus />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
          <DialogDescription>Enter a group name and select friends to add to the group.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Group Name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Select Friends</label>

            <ScrollArea className="h-48 border rounded-md p-2 mt-2">
              {friendsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
              ) : friendsQuery.error && friends.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8 space-y-2">
                  <p>Error loading friends.</p>
                  <Button type="button" variant="outline" onClick={() => void friendsQuery.refetch()}>
                    Retry
                  </Button>
                </div>
              ) : friends.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No friends available</p>
              ) : (
                friends.map((friend) => (
                  <div
                    key={friend.id}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer ${
                      selectedFriendIds.includes(friend.id) ? "bg-primary/10" : "hover:bg-accent/50"
                    }`}
                  >
                    <Checkbox
                      id={`friend-${friend.id}`}
                      checked={selectedFriendIds.includes(friend.id)}
                      onCheckedChange={() => toggleFriend(friend.id)}
                      className="border-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <Avatar className="size-8 shrink-0">
                      <AvatarImage src={getOptimizedAvatarUrl(friend.avatar, 32)} />
                      <AvatarFallback className="text-xs">
                        {getAvatarFallback(friend.username)}
                      </AvatarFallback>
                    </Avatar>
                    <label htmlFor={`friend-${friend.id}`} className="cursor-pointer flex-1 text-sm">
                      {friend.username}
                    </label>
                  </div>
                ))
              )}
            </ScrollArea>

            <p className="text-sm text-muted-foreground mt-2">
              {selectedFriendIds.length} friend(s) selected
            </p>
          </div>
          {localError && <div className="text-sm text-destructive">{localError}</div>}

          <DialogFooter>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
