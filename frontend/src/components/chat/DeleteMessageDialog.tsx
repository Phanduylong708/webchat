import { useCallback, useState } from "react";
import { toast } from "sonner";
import useSocket from "@/hooks/context/useSocket";
import { emitWithAckTimeout } from "@/utils/socketAck.util";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DeleteMessageAck = { success: boolean; error?: string; code?: string };

export type DeleteMessageTarget = {
  conversationId: number;
  messageId: number;
};

interface DeleteMessageDialogProps {
  target: DeleteMessageTarget | null;
  onOpenChange: (open: boolean) => void;
  onDeleteSuccess?: (target: DeleteMessageTarget) => void;
}

const DELETE_ACK_TIMEOUT_MS = 12_000;

export default function DeleteMessageDialog({
  target,
  onOpenChange,
  onDeleteSuccess,
}: DeleteMessageDialogProps): React.JSX.Element {
  const { socket, isConnected } = useSocket();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (isDeleting) return;
      onOpenChange(open);
    },
    [isDeleting, onOpenChange],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!target) return;
    if (!socket || !isConnected) {
      toast.error("Cannot delete messages while offline");
      return;
    }

    setIsDeleting(true);
    try {
      await emitWithAckTimeout<DeleteMessageAck | undefined, DeleteMessageAck>({
        socket,
        event: "deleteMessage",
        payload: target,
        timeoutMs: DELETE_ACK_TIMEOUT_MS,
        timeoutErrorMessage: "Delete timed out - no server acknowledgement",
        isSuccess: (ack): ack is DeleteMessageAck => Boolean(ack?.success),
        getErrorMessage: (ack) => ack?.error || "Delete failed",
      });
      onDeleteSuccess?.(target);
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  }, [isConnected, onDeleteSuccess, onOpenChange, socket, target]);

  return (
    <AlertDialog open={target !== null} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete message</AlertDialogTitle>
          <AlertDialogDescription>
            This message will be deleted for everyone. Are you sure?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void handleConfirmDelete();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
