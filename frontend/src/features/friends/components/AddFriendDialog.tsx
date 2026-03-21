import React, { useCallback, useMemo, useState } from "react";
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
import { Plus } from "lucide-react";
import { useAddFriendMutation } from "@/features/friends/hooks/friends";

interface AddFriendDialogProps {
  onFriendAdded: (friendId: number) => void;
}

export default function AddFriendDialog({ onFriendAdded }: AddFriendDialogProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const addFriendMutation = useAddFriendMutation();
  const mutationErrorMessage = useMemo(() => {
    const error = addFriendMutation.error;
    if (!error) {
      return null;
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
    ) {
      return (error as { message?: string }).message ?? null;
    }
    return String(error);
  }, [addFriendMutation.error]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        setLocalError(null);
        addFriendMutation.reset();
      }
    },
    [addFriendMutation]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setLocalError("Username cannot be empty");
      return;
    }
    setLocalError(null);
    try {
      const friend = await addFriendMutation.mutateAsync(trimmed);
      onFriendAdded(friend.id);
      setUsername("");
      handleOpenChange(false);
    } catch (err) {
      // message handled via mutationErrorMessage
      console.error(err);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="bg-background">
          <Plus size={20} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
          <DialogDescription>Enter your friend username</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder="Enter username"
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              disabled={addFriendMutation.isPending}
            ></Input>
          </div>
          {(localError || mutationErrorMessage) && (
            <div className="text-sm text-destructive">{localError || mutationErrorMessage}</div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={addFriendMutation.isPending}>
              {addFriendMutation.isPending ? "Adding..." : "Add Friend"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
