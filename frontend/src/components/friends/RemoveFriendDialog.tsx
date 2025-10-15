import React, { useState } from "react";
import { useFriend } from "@/hooks/useFriend";
import type { Friend } from "@/types/friend.type";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface RemoveFriendDialogProps {
  friend: Friend;
  trigger: React.ReactNode;
  onRemove?: () => void;
}

export default function RemoveFriendDialog({
  friend,
  trigger,
  onRemove,
}: RemoveFriendDialogProps): React.JSX.Element {
  // TODO: States
  const [isOpen, setIsOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { removeFriend } = useFriend();
  // TODO: useFriend hook
  async function handleRemove() {
    try {
      setIsRemoving(true);
      const { success, message } = await removeFriend(friend.id);
      if (!success) {
        setLocalError(message ?? "Failed to remove friend. Please try again.");
        return;
      }
      onRemove?.();
      setLocalError(null);
      setIsOpen(false);
    } finally {
      setIsRemoving(false);
    }
  }
  // TODO: handleRemove
  // TODO: JSX
  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setLocalError(null);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Friend</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove {friend.username} from your friends
            list?
          </AlertDialogDescription>
        </AlertDialogHeader>
        {localError && (
          <p className="text-destructive text-center mb-2 text-sm">
            {localError}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setIsOpen(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleRemove} disabled={isRemoving}>
            {isRemoving ? "Removing..." : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
