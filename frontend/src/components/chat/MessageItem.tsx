import type { Messages } from "@/types/chat.type";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getOptimizedAvatarUrl } from "@/utils/image.util";

interface MessageItemProps {
  message: Messages;
  isOwn: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}

function getAvatarFallback(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

export default function MessageItem({
  message,
  isOwn,
  isFirstInGroup,
  isLastInGroup,
}: MessageItemProps): React.JSX.Element {
  const timestamp = new Date(message.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // ── Own messages: right-aligned, no avatar ──
  if (isOwn) {
    return (
      <div className="flex justify-end">
        <div className="flex flex-col items-end max-w-[70%]">
          <div className="wrap-break-word whitespace-pre-wrap bg-primary text-primary-foreground px-3 py-2 rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl">
            {message.content}
          </div>
          {isLastInGroup && <span className="text-[10px] text-muted-foreground mt-1">{timestamp}</span>}
        </div>
      </div>
    );
  }

  // ── Other's messages: avatar on left, grouped ──
  return (
    <div className="flex items-end gap-2">
      {/* Avatar column: show real avatar on last message, invisible spacer otherwise */}
      {isLastInGroup ? (
        <Avatar className="size-8 shrink-0">
          <AvatarImage src={getOptimizedAvatarUrl(message.sender.avatar, 32)} />
          <AvatarFallback className="text-xs">{getAvatarFallback(message.sender.username)}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="size-8 shrink-0" /> /* invisible spacer for alignment */
      )}

      {/* Content column */}
      <div className="flex flex-col items-start max-w-[70%]">
        {isFirstInGroup && (
          <span className="text-xs text-muted-foreground mb-1">{message.sender.username}</span>
        )}
        <div className="wrap-break-word whitespace-pre-wrap bg-muted text-foreground px-3 py-2 rounded-tl-2xl rounded-tr-2xl rounded-br-2xl">
          {message.content}
        </div>
        {isLastInGroup && <span className="text-[10px] text-muted-foreground mt-1">{timestamp}</span>}
      </div>
    </div>
  );
}
