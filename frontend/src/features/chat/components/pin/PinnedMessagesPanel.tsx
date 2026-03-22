import { useMemo } from "react";
import { Loader2, PinOff } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/features/auth/providers/useAuth";
import { useConversationPinsQuery, useUnpinMessageMutation } from "@/features/chat/hooks/pins";
import { useConversationDetailsQuery } from "@/features/conversation/hooks/conversations";
import type { ConversationsResponse, PinnedMessageItem } from "@/types/chat.type";
import { getAvatarFallback, getOptimizedAvatarUrl } from "@/utils/image.util";
import { toPinnedPreviewLabel } from "@/utils/pin.util";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type PinnedMessagesPanelProps = {
  conversation: ConversationsResponse;
  open: boolean;
  onClose: () => void;
};

function formatPinnedTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays <= 0) {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  if (diffDays === 1) {
    return `Yesterday, ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  }

  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function jumpToMessage(messageId: number): boolean {
  const targetRow = document.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
  if (!targetRow) {
    return false;
  }

  targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

function PinnedMessageRow({
  item,
  canUnpin,
  isUnpinning,
  onJump,
  onUnpin,
}: {
  item: PinnedMessageItem;
  canUnpin: boolean;
  isUnpinning: boolean;
  onJump: (messageId: number) => void;
  onUnpin: (messageId: number) => void;
}): React.JSX.Element {
  return (
    <div className="group relative overflow-hidden rounded-lg bg-background/70">
      <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary/80" />
      <button
        type="button"
        onClick={() => onJump(item.messageId)}
        className="flex w-full cursor-pointer items-start gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-muted/35"
      >
        <Avatar className="mt-0.5 size-8 shrink-0">
          <AvatarImage src={getOptimizedAvatarUrl(item.message.sender.avatar, 40)} />
          <AvatarFallback>{getAvatarFallback(item.message.sender.username)}</AvatarFallback>
        </Avatar>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="truncate text-sm font-semibold text-foreground">
              {item.message.sender.username}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatPinnedTime(item.pinnedAt)}</span>
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-muted-foreground line-clamp-2">
            {item.message.content || toPinnedPreviewLabel(item.message.previewText)}
          </span>
        </span>
      </button>

      {canUnpin && (
        <button
          type="button"
          onClick={() => onUnpin(item.messageId)}
          disabled={isUnpinning}
          aria-label="Unpin message"
          className="absolute right-2 top-2 inline-flex cursor-pointer items-center justify-center rounded-md bg-background/95 p-1.5 text-muted-foreground opacity-0 shadow-sm backdrop-blur-sm transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-100"
        >
          {isUnpinning ? <Loader2 className="size-3.5 animate-spin" /> : <PinOff className="size-3.5" />}
        </button>
      )}
    </div>
  );
}

export default function PinnedMessagesPanel({
  conversation,
  open,
  onClose,
}: PinnedMessagesPanelProps): React.JSX.Element | null {
  const { user } = useAuth();
  const pinsQuery = useConversationPinsQuery(conversation.id, open);
  const unpinMutation = useUnpinMessageMutation();

  const needsCreatorLookup =
    open && conversation.type === "GROUP" && conversation.pinPermission === "CREATOR_ONLY";

  const conversationDetailsQuery = useConversationDetailsQuery(conversation.id, needsCreatorLookup);

  const canManagePins = useMemo(() => {
    if (conversation.type === "PRIVATE") {
      return true;
    }

    if (conversation.pinPermission !== "CREATOR_ONLY") {
      return true;
    }

    return conversationDetailsQuery.data?.creatorId === user?.id;
  }, [conversation.pinPermission, conversation.type, conversationDetailsQuery.data?.creatorId, user?.id]);

  async function handleUnpin(messageId: number) {
    try {
      await unpinMutation.mutateAsync({
        conversationId: conversation.id,
        messageId,
      });
      toast.success("Pin removed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to unpin message";
      toast.error(message);
    }
  }

  function handleJump(messageId: number) {
    const jumped = jumpToMessage(messageId);
    if (!jumped) {
      toast("Message is not loaded in chat yet. Scroll up to load more history.");
      return;
    }

    onClose();
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-full z-20">
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div
            className={`rounded-b-lg border border-t-0 border-border/70 bg-background/95 shadow-xl backdrop-blur-sm ${
              open ? "pointer-events-auto" : ""
            }`}
          >
            <div className="flex items-center justify-between px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span>Pinned</span>
              <span className="normal-case tracking-normal">Click to view in chat</span>
            </div>

            <ScrollArea className="max-h-[360px]">
              <div className="space-y-2 px-3 pb-3">
                {pinsQuery.isLoading && (
                  <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Loading pinned messages...</span>
                  </div>
                )}

                {pinsQuery.isError && (
                  <div className="px-4 py-10 text-center text-sm text-destructive">
                    Failed to load pinned messages.
                  </div>
                )}

                {!pinsQuery.isLoading && !pinsQuery.isError && pinsQuery.data?.length === 0 && (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No pinned messages yet.
                  </div>
                )}

                {pinsQuery.data?.map((item) => (
                  <PinnedMessageRow
                    key={item.messageId}
                    item={item}
                    canUnpin={canManagePins}
                    isUnpinning={unpinMutation.isPending}
                    onJump={handleJump}
                    onUnpin={handleUnpin}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
