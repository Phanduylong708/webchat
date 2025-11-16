import { useState, useEffect } from "react";
import { useConversation } from "@/hooks/context/useConversation";
import { useFriend } from "@/hooks/context/useFriend";
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
import { UserPlus } from "lucide-react";
import { getConversationsDetails } from "@/api/conversation.api";
import type { User } from "@/types/chat.type";

interface AddMemberDialogProps {
  conversationId: number;
}

export default function AddMemberDialog({
  conversationId,
}: AddMemberDialogProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null); // Single select
  const [currentMembers, setCurrentMembers] = useState<User[]>([]); // Members trong group
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addMember } = useConversation();
  const { friends, fetchFriends } = useFriend();

  useEffect(() => {
    if (isOpen) {
      // Fetch friends list
      void fetchFriends();

      // Fetch conversation details để lấy current members
      async function loadMembers() {
        setIsLoadingMembers(true);
        setLocalError(null);
        try {
          const details = await getConversationsDetails(conversationId);
          setCurrentMembers(details.members);
        } catch (error) {
          console.error("Error loading members:", error);
          setLocalError("Failed to load members");
        } finally {
          setIsLoadingMembers(false);
        }
      }

      void loadMembers();
    }
  }, [isOpen, conversationId, fetchFriends]);

  const safeFriends = friends ?? [];
  const safeMembers = currentMembers ?? [];
  const availableFriends = safeFriends.filter(
    (friend) => !safeMembers.some((member) => member.id === friend.id)
  );

  function handleSelectFriend(friendId: number | null) {
    setSelectedFriendId(friendId);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFriendId) return;
    setLocalError(null);
    setIsSubmitting(true);
    try {
      const { success, message } = await addMember(
        conversationId,
        selectedFriendId
      );

      if (success) {
        // Success: close dialog, reset
        setIsOpen(false);
        setSelectedFriendId(null);
      } else {
        // Error: show message
        setLocalError(message || "Failed to add member");
      }
    } finally {
      setIsSubmitting(false);
    }
  }
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
        <Button size="icon" variant="ghost">
          <UserPlus size={18} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>
            Select one friend to add to this group.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ScrollArea className="h-48 border rounded-md p-2">
            {isLoadingMembers ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Loading members...
              </p>
            ) : availableFriends.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                All friends are already in this group.
              </p>
            ) : (
              availableFriends.map((friend) => (
                <div
                  key={friend.id}
                  className={`flex items-center space-x-2 p-2 rounded-md cursor-pointer ${
                    selectedFriendId === friend.id
                      ? "bg-primary/10"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <Checkbox
                    id={`friend-${friend.id}`}
                    checked={selectedFriendId === friend.id}
                    onCheckedChange={(checked) =>
                      handleSelectFriend(checked ? friend.id : null)
                    }
                    className="border-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label
                    htmlFor={`friend-${friend.id}`}
                    className="cursor-pointer flex-1"
                  >
                    {friend.username}
                  </label>
                </div>
              ))
            )}
          </ScrollArea>

          {localError && (
            <p className="text-sm text-destructive">{localError}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={!selectedFriendId || isSubmitting}>
              {isSubmitting ? "Adding..." : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
