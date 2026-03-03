import { useMemo } from "react";
import type { DisplayMessage } from "@/types/chat.type";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getOptimizedAvatarUrl, getAvatarFallback, getOptimizedMessageImageUrl } from "@/utils/image.util";
import { useMessage } from "@/hooks/context/useMessage";
import { Loader2, AlertCircle, X } from "lucide-react";
import { getEmojiSizing, renderTwemojiTokens, tokenizeEmojiContent } from "@/utils/emoji.util";
import MessageActionsMenu from "./MessageActionsMenu";

interface MessageItemProps {
  message: DisplayMessage;
  isOwn: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isEditing?: boolean;
  onRequestEdit?: (message: DisplayMessage) => void;
  onRequestReply?: (message: DisplayMessage) => void;
}

// ── Helpers ──

function isOptimistic(msg: DisplayMessage): msg is import("@/types/chat.type").OptimisticMessage {
  return "_optimistic" in msg;
}

function isWithinEditWindow(createdAt: string, windowMs = 5 * 60 * 1000): boolean {
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= windowMs;
}

function EditedMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-1.5 rounded-full"
      style={{
        backgroundImage: "var(--signature-gradient)",
      }}
    />
  );
}

// ── Image Bubble ──

function ImageBubble({ message }: { message: DisplayMessage }) {
  const isOpt = isOptimistic(message);
  const isSending = isOpt && message._status === "sending";
  const isFailed = isOpt && message._status === "failed";

  // Determine image source: optimistic preview → server attachment
  const src =
    isOpt && message._previewUrl
      ? message._previewUrl
      : message.attachments?.[0]?.url
        ? getOptimizedMessageImageUrl(message.attachments[0].url, "bubble")
        : null;

  if (!src) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
        <AlertCircle className="size-3.5 shrink-0" />
        <span>Image unavailable</span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg max-w-[480px]">
      <img
        src={src}
        alt="Attached image"
        className={`block max-w-full h-auto rounded-lg ${isSending || isFailed ? "opacity-60" : ""}`}
        loading="lazy"
      />

      {/* Upload progress overlay */}
      {isSending && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Loader2 className="size-6 text-white animate-spin" />
          {isOpt && message._progress != null && message._progress < 100 && (
            <span className="absolute bottom-2 right-2 text-xs text-white bg-black/50 px-1.5 py-0.5 rounded">
              {message._progress}%
            </span>
          )}
        </div>
      )}

      {/* Failed overlay */}
      {isFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <AlertCircle className="size-6 text-destructive" />
        </div>
      )}
    </div>
  );
}

// ── Failed Actions ──

function FailedActions({ message }: { message: DisplayMessage }) {
  const { removeOptimisticMessage } = useMessage();
  if (!isOptimistic(message) || message._status !== "failed") return null;

  return (
    <button
      type="button"
      onClick={() => removeOptimisticMessage(message.conversationId, message.id)}
      className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors mt-0.5"
    >
      <X className="size-3" />
      <span>Discard</span>
    </button>
  );
}

// ── Message Content ──

function MessageContent({ message, bubbleClassName }: { message: DisplayMessage; bubbleClassName: string }) {
  const hasImage = message.messageType === "IMAGE" || (isOptimistic(message) && message._previewUrl);
  const rawText = message.content ?? "";
  const hasText = rawText.length > 0;

  const { tokens, isAllEmoji, sizePx } = useMemo(() => {
    if (!hasText) {
      return { tokens: [], isAllEmoji: false, sizePx: null as number | null };
    }

    const tokenized = tokenizeEmojiContent(rawText);
    const sizing = getEmojiSizing(tokenized);

    return {
      tokens: tokenized,
      isAllEmoji: sizing.isAllEmoji,
      sizePx: sizing.sizePx,
    };
  }, [rawText, hasText]);

  const textNodes = hasText ? renderTwemojiTokens(tokens, { sizePx: isAllEmoji ? sizePx : null }) : null;

  return (
    <>
      {hasImage && <ImageBubble message={message} />}
      {hasText && (
        <div
          className={`max-w-full wrap-anywhere whitespace-pre-wrap ${bubbleClassName} ${
            isAllEmoji ? "text-center" : ""
          }`}
        >
          {textNodes}
        </div>
      )}
    </>
  );
}

// ── Main Component ──

export default function MessageItem({
  message,
  isOwn,
  isFirstInGroup,
  isLastInGroup,
  isEditing = false,
  onRequestEdit,
  onRequestReply,
}: MessageItemProps): React.JSX.Element {
  const timestamp = new Date(message.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const optimistic = isOptimistic(message);
  const isFailed = optimistic && message._status === "failed";
  const isEdited = Boolean(message.editedAt);

  const canEdit =
    isOwn &&
    !optimistic &&
    (message.messageType === "TEXT" || message.messageType === "IMAGE") &&
    isWithinEditWindow(message.createdAt);
  const canOpenActions = !optimistic;

  // ── Own messages: right-aligned, no avatar ──
  if (isOwn) {
    return (
      <div className="flex justify-end">
        <div className="flex flex-col items-end max-w-[70%] min-w-0">
          <MessageActionsMenu
            message={message}
            enabled={canOpenActions}
            onReply={onRequestReply}
            onEdit={canEdit ? onRequestEdit : undefined}
            side="left"
          >
            <div
              className={
                isEditing
                  ? "rounded-[18px] ring-2 ring-ring/20 ring-offset-2 ring-offset-background"
                  : ""
              }
            >
              <MessageContent
                message={message}
                bubbleClassName="bg-primary text-primary-foreground px-3 py-2 rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl"
              />
            </div>
          </MessageActionsMenu>
          {isFailed && <FailedActions message={message} />}
          {isLastInGroup && (
            <span className="text-[10px] text-muted-foreground mt-1">
              {timestamp}
              {isEdited && (
                <span className="inline-flex items-center gap-1">
                  <span className="mx-1">·</span>
                  <EditedMark />
                  <span>edited</span>
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Other's messages: avatar on left, grouped ──
  return (
    <div className="flex items-end gap-2">
      {/* Avatar column */}
      {isLastInGroup ? (
        <Avatar className="size-8 shrink-0">
          <AvatarImage src={getOptimizedAvatarUrl(message.sender.avatar, 32)} />
          <AvatarFallback className="text-xs">{getAvatarFallback(message.sender.username)}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="size-8 shrink-0" /> /* invisible spacer for alignment */
      )}

      {/* Content column */}
      <div className="flex flex-col items-start max-w-[70%] min-w-0">
        {isFirstInGroup && (
          <span className="text-xs text-muted-foreground mb-1">{message.sender.username}</span>
        )}
        <MessageActionsMenu
          message={message}
          enabled={canOpenActions}
          onReply={onRequestReply}
          side="right"
        >
          <MessageContent
            message={message}
            bubbleClassName="bg-muted text-foreground px-3 py-2 rounded-tl-2xl rounded-tr-2xl rounded-br-2xl"
          />
        </MessageActionsMenu>
        {isLastInGroup && (
          <span className="text-[10px] text-muted-foreground mt-1">
            {timestamp}
            {isEdited && (
              <span className="inline-flex items-center gap-1">
                <span className="mx-1">·</span>
                <EditedMark />
                <span>edited</span>
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
