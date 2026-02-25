import React, { useEffect, useState } from "react";
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
import { useRemoveFriendMutation } from "@/hooks/queries/friends";

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
  const [isOpen, setIsOpen] = useState(false);
  const removeFriendMutation = useRemoveFriendMutation();

  useEffect(() => {
    if (!isOpen) {
      removeFriendMutation.reset();
    }
  }, [isOpen, removeFriendMutation]);

  const mutationErrorMessage = (() => {
    const error = removeFriendMutation.error;
    if (!error) return null;
    if (error instanceof Error) return error.message;
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
    ) {
      return (error as { message?: string }).message ?? null;
    }
    return String(error);
  })();

  async function handleRemove() {
    try {
      await removeFriendMutation.mutateAsync(friend.id);
      onRemove?.();
      setIsOpen(false);
    } catch (err) {
      // Swallow error so dialog stays open; message shown via mutationErrorMessage
      console.error(err);
    }
  }
  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
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
        {mutationErrorMessage && (
          <p className="text-destructive text-center mb-2 text-sm">
            {mutationErrorMessage}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setIsOpen(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={removeFriendMutation.isPending}
          >
            {removeFriendMutation.isPending ? "Removing..." : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
