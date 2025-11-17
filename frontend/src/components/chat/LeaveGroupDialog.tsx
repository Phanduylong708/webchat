import { useState } from "react";
import { useConversation } from "@/hooks/context/useConversation";
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
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface LeaveGroupDialogProps {
  conversationId: number;
}

export default function LeaveGroupDialog({
  conversationId,
}: LeaveGroupDialogProps): React.JSX.Element {
  const { leaveGroup } = useConversation();
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleLeave() {
    setLocalError(null);
    const { success, message } = await leaveGroup(conversationId);
    if (!success) {
      setLocalError(message || "Failed to leave group");
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="border-destructive/20 text-destructive hover:bg-destructive/10"
        >
          <LogOut size={20} />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave Group?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to leave this group?
          </AlertDialogDescription>
          {localError && (
            <p className="text-sm text-destructive">{localError}</p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLeave}
            className="bg-destructive hover:bg-destructive/90"
          >
            Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
