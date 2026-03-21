import { useCallback, useMemo } from "react";
import type { DisplayMessage } from "@/types/chat.type";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getOptimizedAvatarUrl, getAvatarFallback, getOptimizedMessageImageUrl } from "@/utils/image.util";
import { useRemoveOptimisticMessageFromCache } from "@/features/chat/hooks/messages";
import { useMessageStore, selectUploadProgressForMessage } from "@/features/chat/stores/messageStore";
import { Loader2, AlertCircle, X } from "lucide-react";
import { getEmojiSizing, renderTwemojiTokens, tokenizeEmojiContent } from "@/utils/emoji.util";
import MessageActionsMenu from "@/features/chat/components/MessageActionsMenu";
import { toast } from "sonner";
import {
  applyReplyHighlight,
  findReplyTargetRow,
  getReplyPreviewText,
} from "@/features/chat/components/message-item/messageItem.logic";
interface MessageItemProps {
  message: DisplayMessage;
  scrollContainerId: string;
  isOwn: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isEditing?: boolean;
  onRequestEdit?: (message: DisplayMessage) => void;
  onRequestReply?: (message: DisplayMessage) => void;
  onRequestDelete?: (message: DisplayMessage) => void;
  onRequestPin?: (message: DisplayMessage) => void;
  onRequestUnpin?: (message: DisplayMessage) => void;
}

const REPLY_HIGHLIGHT_TIMEOUT_MS = 800;
const REPLY_HIGHLIGHT_SELECTOR = '[data-message-bubble="true"]';
const REPLY_HIGHLIGHT_TIMEOUT_ATTR = "data-reply-highlight-timeout-id";
const REPLY_HIGHLIGHT_CLASSES = [
  "ring-1",
  "ring-primary/45",
  "ring-offset-1",
  "ring-offset-background",
  "transition-shadow",
  "duration-200",
];

// ── Helpers ──

function isOptimistic(msg: DisplayMessage): msg is import("@/types/chat.type").OptimisticMessage {
  return "_optimistic" in msg;
}

// ── Image Bubble ──

function ImageBubble({ message }: { message: DisplayMessage }) {
  const isOpt = isOptimistic(message);
  const isSending = isOpt && message._status === "sending";
  const isFailed = isOpt && message._status === "failed";

  // Upload progress lives in Zustand store, not in the message cache.
  // This way only this bubble re-renders on each progress tick, not the full list.
  const uploadProgress = useMessageStore(selectUploadProgressForMessage(message.id));

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
          {uploadProgress != null && uploadProgress < 100 && (
            <span className="absolute bottom-2 right-2 text-xs text-white bg-black/50 px-1.5 py-0.5 rounded">
              {uploadProgress}%
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
  const removeOptimisticMessageFromCache = useRemoveOptimisticMessageFromCache();
  if (!isOptimistic(message) || message._status !== "failed") return null;

  return (
    <button
      type="button"
      onClick={() => removeOptimisticMessageFromCache(message.conversationId, message.id)}
      className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors mt-0.5"
    >
      <X className="size-3" />
      <span>Discard</span>
    </button>
  );
}

// ── Message Content ──

function MessageContent({
  message,
  bubbleClassName,
  quoteBlock = null,
}: {
  message: DisplayMessage;
  bubbleClassName: string;
  quoteBlock?: React.ReactNode;
}) {
  const hasImage = message.messageType === "IMAGE" || (isOptimistic(message) && message._previewUrl);
  const hasQuote = message.replyToMessageId != null || message.replyTo != null;
  const rawText = message.content ?? "";
  const hasText = rawText.length > 0;
  const shouldRenderTextBubble = hasText || hasQuote;

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
      {shouldRenderTextBubble && (
        <div data-message-bubble="true" className={`max-w-full ${bubbleClassName}`}>
          {hasQuote ? quoteBlock : null}
          {hasText ? (
            <div
              className={`wrap-anywhere whitespace-pre-wrap ${isAllEmoji && !hasQuote && !hasImage ? "text-center" : ""}`}
            >
              {textNodes}
            </div>
          ) : null}
          </div>
      )}
    </>
  );
}

function ReplyQuoteBlock({
  message,
  tone,
  onClick,
}: {
  message: DisplayMessage;
  tone: "own" | "other";
  onClick: () => void;
}) {
  if (message.replyToMessageId == null) {
    return null;
  }

  const header = message.replyTo?.sender.username ?? "Original message";
  const preview = getReplyPreviewText(message);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-1 w-full max-w-full cursor-pointer rounded-md border-l-2 px-2 py-1 text-left transition-colors focus:outline-none ${
        tone === "own"
          ? "border-primary-foreground/55 bg-primary-foreground/10 hover:bg-primary-foreground/15"
          : "border-foreground/40 bg-foreground/5 hover:bg-foreground/10"
      }`}
    >
      <div className="text-xs font-medium truncate opacity-95">{header}</div>
      <div className="text-xs truncate opacity-80">{preview}</div>
    </button>
  );
}

// ── Main Component ──

export default function MessageItem({
  message,
  scrollContainerId,
  isOwn,
  isFirstInGroup,
  isLastInGroup,
  isEditing = false,
  onRequestEdit,
  onRequestReply,
  onRequestDelete,
  onRequestPin,
  onRequestUnpin,
}: MessageItemProps): React.JSX.Element {
  const timestamp = new Date(message.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const optimistic = isOptimistic(message);
  const isFailed = optimistic && message._status === "failed";
  const isEdited = Boolean(message.editedAt);

  const canEdit = isOwn && !optimistic && (message.messageType === "TEXT" || message.messageType === "IMAGE");
  const canDelete = isOwn && !optimistic;
  const canOpenActions = !optimistic;

  const handleJumpToReplyTarget = useCallback(() => {
    const replyToMessageId = message.replyToMessageId;
    if (replyToMessageId == null) return;

    const scrollContainer = document.getElementById(scrollContainerId);
    if (!scrollContainer) return;

    const targetRow = findReplyTargetRow({ scrollContainerId, replyToMessageId });
    if (!targetRow) {
      toast("Original message isn’t loaded yet. Scroll up to load older messages.");
      return;
    }

    targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
    applyReplyHighlight({
      targetRow,
      highlightSelector: REPLY_HIGHLIGHT_SELECTOR,
      classes: REPLY_HIGHLIGHT_CLASSES,
      timeoutMs: REPLY_HIGHLIGHT_TIMEOUT_MS,
      timeoutAttr: REPLY_HIGHLIGHT_TIMEOUT_ATTR,
    });
  }, [message.replyToMessageId, scrollContainerId]);

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
            onDelete={canDelete ? onRequestDelete : undefined}
            onPin={onRequestPin}
            onUnpin={onRequestUnpin}
            side="left"
          >
            <div
              className={
                isEditing ? "rounded-[18px] ring-2 ring-ring/20 ring-offset-2 ring-offset-background" : ""
              }
            >
              <MessageContent
                message={message}
                bubbleClassName="bg-primary text-primary-foreground px-3 py-2 rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl"
                quoteBlock={
                  <ReplyQuoteBlock message={message} tone="own" onClick={handleJumpToReplyTarget} />
                }
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
                  <span>Edited</span>
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
          onPin={onRequestPin}
          onUnpin={onRequestUnpin}
          side="right"
        >
          <MessageContent
            message={message}
            bubbleClassName="bg-muted text-foreground px-3 py-2 rounded-tl-2xl rounded-tr-2xl rounded-br-2xl"
            quoteBlock={<ReplyQuoteBlock message={message} tone="other" onClick={handleJumpToReplyTarget} />}
          />
        </MessageActionsMenu>
        {isLastInGroup && (
          <span className="text-[10px] text-muted-foreground mt-1">
            {timestamp}
            {isEdited && (
              <span className="inline-flex items-center gap-1">
                <span className="mx-1">·</span>
                <span>Edited</span>
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
