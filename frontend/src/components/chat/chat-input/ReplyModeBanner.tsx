import { X } from "lucide-react";
import type { ReplyToPreview } from "@/types/chat.type";

type Props = {
  replyTo: ReplyToPreview | null;
  onCancelReply: () => void;
};

function getReplyPreview(replyTo: ReplyToPreview): string {
  if (replyTo.messageType === "TEXT") {
    return replyTo.content?.trim() || "Message";
  }
  if (replyTo.messageType === "IMAGE") {
    const caption = replyTo.content?.trim();
    return caption ? `Image - ${caption}` : "Image";
  }
  return "Message";
}

export default function ReplyModeBanner({ replyTo, onCancelReply }: Props): React.JSX.Element | null {
  if (!replyTo) {
    return null;
  }

  return (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/30 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs font-medium">Replying to {replyTo.sender.username}</div>
        <div className="text-[11px] text-muted-foreground truncate">{getReplyPreview(replyTo)}</div>
      </div>
      <button
        type="button"
        aria-label="Cancel reply"
        onClick={onCancelReply}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
