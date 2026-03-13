import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Users } from "lucide-react";
import { useAuth } from "@/hooks/context/useAuth";
import { useLeaveGroupMutation, useRemoveMemberMutation } from "@/hooks/queries/conversations";
import { getConversationsDetails } from "@/api/conversation.api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import AddMemberDialog from "./AddMemberDialog";
import { getOptimizedAvatarUrl, getAvatarFallback } from "@/utils/image.util";
import type { ConversationsDetail } from "@/types/chat.type";

interface GroupMembersDialogProps {
  conversationId: number;
}

export default function GroupMembersDialog({ conversationId }: GroupMembersDialogProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [details, setDetails] = useState<ConversationsDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const { user: currentUser } = useAuth();
  const leaveGroupMutation = useLeaveGroupMutation();
  const removeMemberMutation = useRemoveMemberMutation();
  const [, setSearchParams] = useSearchParams();

  async function handleOpen(open: boolean) {
    setIsOpen(open);
    if (open) {
      setSearchQuery("");
      setLeaveError(null);
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getConversationsDetails(conversationId);
        setDetails(data);
      } catch {
        setLoadError("Failed to load members. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  }

  async function handleRemove(userId: number) {
    setRemovingIds((prev) => new Set(prev).add(userId));
    try {
      await removeMemberMutation.mutateAsync({ conversationId, userId });
      // Optimistically remove from local details list
      setDetails((prev) => (prev ? { ...prev, members: prev.members.filter((m) => m.id !== userId) } : prev));
    } catch (error) {
      console.error("Failed to remove member:", error);
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }

  async function handleLeave() {
    setLeaveError(null);
    try {
      await leaveGroupMutation.mutateAsync(conversationId);
      setIsOpen(false);
      setSearchParams((p) => {
        p.delete("conversationId");
        return p;
      });
    } catch (error) {
      setLeaveError(error instanceof Error ? error.message : "Failed to leave group");
    }
  }

  const isCreator = currentUser?.id === details?.creatorId;

  const filteredMembers =
    details?.members.filter((m) => m.username.toLowerCase().includes(searchQuery.toLowerCase())) ?? [];

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" aria-label="Group members" className="cursor-pointer">
          <Users className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Members</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Member list */}
        <ScrollArea className="max-h-64">
          {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading members...</p>}
          {loadError && <p className="text-sm text-destructive text-center py-8">{loadError}</p>}
          {!isLoading && !loadError && filteredMembers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No members found.</p>
          )}
          {!isLoading && !loadError && filteredMembers.length > 0 && (
            <div className="space-y-1 pr-2">
              {filteredMembers.map((member) => {
                const isThisCreator = member.id === details?.creatorId;
                const isSelf = member.id === currentUser?.id;
                const isRemoving = removingIds.has(member.id);

                return (
                  <div key={member.id} className="flex items-center gap-3 px-1 py-2 rounded-md">
                    <Avatar className="size-8 shrink-0">
                      <AvatarImage src={getOptimizedAvatarUrl(member.avatar, 32)} />
                      <AvatarFallback className="text-xs">
                        {getAvatarFallback(member.username)}
                      </AvatarFallback>
                    </Avatar>

                    <span className="flex-1 text-sm truncate">{member.username}</span>

                    {isThisCreator && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                        Creator
                      </span>
                    )}

                    {/* Remove button: only for creator, only for non-self, non-creator rows */}
                    {isCreator && !isThisCreator && !isSelf && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 h-7 px-2 text-xs border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                        disabled={isRemoving}
                        onClick={() => void handleRemove(member.id)}
                      >
                        {isRemoving ? "Removing…" : "Remove"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Add Member — full-width outlined button as custom trigger, refetches list on success */}
        <AddMemberDialog
          conversationId={conversationId}
          trigger={
            <Button variant="outline" className="w-full cursor-pointer">
              + Add Member
            </Button>
          }
          onSuccess={async () => {
            try {
              const data = await getConversationsDetails(conversationId);
              setDetails(data);
            } catch {
              // silently ignore — list will just be slightly stale
            }
          }}
        />

        <Separator />

        {/* Leave Group */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
            >
              Leave Group
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave Group?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to leave this group? You will lose access to the conversation.
              </AlertDialogDescription>
              {leaveError && <p className="text-sm text-destructive">{leaveError}</p>}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void handleLeave()}
                disabled={leaveGroupMutation.isPending}
                className="bg-destructive hover:bg-destructive/90 cursor-pointer"
              >
                {leaveGroupMutation.isPending ? "Leaving…" : "Leave"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
