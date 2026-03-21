import { useState } from "react";
import { useAddMemberMutation, useConversationDetailsQuery } from "@/hooks/queries/conversations";
import { Button } from "@/components/ui/button";
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
import { UserPlus } from "lucide-react";
import { useFriendsQuery } from "@/features/friends/hooks/friends";

interface AddMemberDialogProps {
  conversationId: number;
  trigger?: React.ReactNode;
}

export default function AddMemberDialog({
  conversationId,
  trigger,
}: AddMemberDialogProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const addMemberMutation = useAddMemberMutation();
  const friendsQuery = useFriendsQuery();
  const friends = friendsQuery.data ?? [];

  const detailsQuery = useConversationDetailsQuery(conversationId, isOpen);
  const currentMembers = detailsQuery.data?.members ?? [];

  const availableFriends = friends.filter(
    (friend) => !currentMembers.some((member) => member.id === friend.id),
  );

  function handleSelectFriend(friendId: number | null) {
    setSelectedFriendId(friendId);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFriendId) return;
    setLocalError(null);

    try {
      await addMemberMutation.mutateAsync({ conversationId, userId: selectedFriendId });
      setIsOpen(false);
      setSelectedFriendId(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Failed to add member");
    }
  }

  const isLoading = detailsQuery.isLoading || friendsQuery.isLoading;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setSelectedFriendId(null);
          setLocalError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="icon" variant="outline">
            <UserPlus />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>Select one friend to add to this group.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ScrollArea className="h-48 border rounded-md p-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
            ) : friendsQuery.isError && friends.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center space-y-2">
                <p>Error loading friends.</p>
                <Button type="button" variant="outline" onClick={() => void friendsQuery.refetch()}>
                  Retry
                </Button>
              </div>
            ) : availableFriends.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                All friends are already in this group.
              </p>
            ) : (
              availableFriends.map((friend) => (
                <div
                  key={friend.id}
                  className={`flex items-center gap-3 p-2 rounded-md cursor-pointer ${
                    selectedFriendId === friend.id ? "bg-primary/10" : "hover:bg-accent/50"
                  }`}
                >
                  <Checkbox
                    id={`friend-${friend.id}`}
                    checked={selectedFriendId === friend.id}
                    onCheckedChange={(checked) => handleSelectFriend(checked ? friend.id : null)}
                    className="border-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage src={getOptimizedAvatarUrl(friend.avatar, 32)} />
                    <AvatarFallback className="text-xs">{getAvatarFallback(friend.username)}</AvatarFallback>
                  </Avatar>
                  <label htmlFor={`friend-${friend.id}`} className="cursor-pointer flex-1 text-sm">
                    {friend.username}
                  </label>
                </div>
              ))
            )}
          </ScrollArea>

          {localError && <p className="text-sm text-destructive">{localError}</p>}

          <DialogFooter>
            <Button type="submit" disabled={!selectedFriendId || addMemberMutation.isPending}>
              {addMemberMutation.isPending ? "Adding..." : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
