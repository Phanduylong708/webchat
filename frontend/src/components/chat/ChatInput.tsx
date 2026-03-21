import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "../ui/textarea";
import { Check, Send, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import EmojiPicker, { Theme, type EmojiClickData } from "emoji-picker-react";
import { useTheme } from "next-themes";
import useSocket from "@/hooks/context/useSocket";
import { useAuth } from "@/hooks/context/useAuth";
import { uploadMediaApi } from "@/api/media.api";
import { toast } from "sonner";
import { insertTextAtCaret } from "@/utils/caret.util";
import { getEditSaveState } from "@/utils/edit-mode.util";
import { emitWithAckTimeout } from "@/utils/socketAck.util";
import { useAttachmentSelection } from "./chat-input/useAttachmentSelection";
import { useTypingIndicator } from "./chat-input/useTypingIndicator";
import AttachmentMenu from "./chat-input/AttachmentMenu";
import AttachmentPreview from "./chat-input/AttachmentPreview";
import EditModeBanner from "./chat-input/EditModeBanner";
import ReplyModeBanner from "./chat-input/ReplyModeBanner";
import type { ReplyToPreview } from "@/types/chat.type";
import { buildReplySendFields, getReplyToFromTarget, toUserMessage } from "./chat-input/chatInput.logic";
import { buildOptimisticMediaMessage } from "@/utils/message.utils";
import {
  useSendMessageMutation,
  useInsertOptimisticMessageIntoCache,
  useUpdateOptimisticMessageInCache,
} from "@/hooks/queries/messages";
import {
  useMessageStore,
  selectSetUploadProgress,
  selectClearUploadProgress,
} from "@/stores/messageStore";

// ── Main Component ──

type EditTarget = {
  conversationId: number;
  messageId: number;
  messageType: "TEXT" | "IMAGE";
  initialContent: string | null;
};

type ReplyTarget = {
  conversationId: number;
  replyTo: ReplyToPreview;
};

type Props = {
  conversationId: number;
  editTarget?: EditTarget | null;
  onCancelEdit?: () => void;
  onSaveEdit?: (draft: string) => Promise<void>;
  replyTarget?: ReplyTarget | null;
  onCancelReply?: () => void;
};

type EditMessageAck = {
  success: boolean;
  message?: unknown;
  error?: string;
  code?: string;
};

const EDIT_ACK_TIMEOUT_MS = 12_000;

//prettier-ignore
export default function ChatInput(props: Props): React.JSX.Element {
  const {
    conversationId,
    editTarget = null,
    onCancelEdit,
    onSaveEdit,
    replyTarget = null,
    onCancelReply,
  } = props;

  const [inputValue, setInputValue] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretRef = useRef<{ start: number; end: number } | null>(null);
  const suppressCloseOnFocusRef = useRef(false);
  const { theme = "system" } = useTheme();
  const pickerTheme =
    theme === "dark" ? Theme.DARK : theme === "light" ? Theme.LIGHT : Theme.AUTO;

  const { socket } = useSocket();
  const { notifyTypingActivity, stopTyping } = useTypingIndicator({ socket, conversationId });
  const { user } = useAuth();
  const sendMessageMutation = useSendMessageMutation();
  const insertOptimisticMessageIntoCache = useInsertOptimisticMessageIntoCache();
  const updateOptimisticMessageInCache = useUpdateOptimisticMessageInCache();
  const setUploadProgress = useMessageStore(selectSetUploadProgress);
  const clearUploadProgress = useMessageStore(selectClearUploadProgress);
  const {
    selectedFile,
    previewUrl,
    fileInputRef,
    handleFileSelect,
    clearSelectedFile,
    openFilePicker,
    detachSelectedForSubmit,
  } = useAttachmentSelection();

  const isEditing = editTarget !== null;
  const editSaveState = useMemo(() => {
    if (!editTarget) return null;
    return getEditSaveState({
      messageType: editTarget.messageType,
      oldContent: editTarget.initialContent,
      draft: inputValue,
    });
  }, [editTarget, inputValue]);

  // Enter edit mode: clear draft + attachments, set textarea to initial content
  useEffect(() => {
    if (!editTarget) return;
    setInputValue(editTarget.initialContent ?? "");
    clearSelectedFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget?.conversationId, editTarget?.messageId]);

  // ── Typing indicator ──
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value);
    notifyTypingActivity();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (isEditing && e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleEmojiSelect(emoji: string) {
    const textarea = textareaRef.current;

    if (!textarea) {
      // Fallback: append to end of current value if ref is not available
      setInputValue((prev) => prev + emoji);
      return;
    }

    const { value, selectionStart, selectionEnd } = insertTextAtCaret(textarea, emoji);
    pendingCaretRef.current = { start: selectionStart, end: selectionEnd };
    setInputValue(value);
  }

  function handleEmojiClick(emojiData: EmojiClickData) {
    handleEmojiSelect(emojiData.emoji);
  }

  // ── Helpers for handleSubmit ──

  async function uploadWithProgress(file: File, tempId: number): Promise<number[]> {
    const attachment = await uploadMediaApi(file, {
      onProgress: (percent) => {
        // Progress goes to Zustand store, not TanStack cache — avoids re-rendering
        // the entire message list on every upload tick.
        setUploadProgress(tempId, percent);
      },
    });
    // Upload done — progress state has no meaning after this point
    clearUploadProgress(tempId);
    return [attachment.id];
  }

  function handleCancelEdit() {
    if (!isEditing) return;
    stopTyping();
    setInputValue("");
    clearSelectedFile();
    onCancelEdit?.();
  }

  function handleCancelReply() {
    onCancelReply?.();
  }

  function clearReplyModeAfterEnqueue() {
    if (!replyTarget) return;
    onCancelReply?.();
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    if (editSaveState?.disabled) return;

    setIsSending(true);
    try {
      if (onSaveEdit) {
        await onSaveEdit(inputValue);
      } else {
        if (!socket || !socket.connected) {
          throw new Error("Socket is not connected");
        }

        const payload = {
          conversationId: editTarget.conversationId,
          messageId: editTarget.messageId,
          content: inputValue,
        };

        await emitWithAckTimeout<EditMessageAck | undefined, EditMessageAck>({
          socket,
          event: "editMessage",
          payload,
          timeoutMs: EDIT_ACK_TIMEOUT_MS,
          timeoutErrorMessage: "Edit timed out - no server acknowledgement",
          isSuccess: (ack): ack is EditMessageAck => Boolean(ack?.success),
          getErrorMessage: (ack) => ack?.error || "Edit failed",
        });
      }
      handleCancelEdit();
    } catch (error) {
      const message = toUserMessage(error, "Edit failed");
      toast.error(message);
      console.error("Edit failed:", error);
    } finally {
      setIsSending(false);
    }
  }

  async function handleMediaSend(trimmed: string, file: File) {
    const tempId = -Date.now();
    const replyTo = getReplyToFromTarget(replyTarget);
    const replySendFields = buildReplySendFields(replyTo);

    // Insert optimistic bubble immediately — bubble is now in message list
    insertOptimisticMessageIntoCache(
      conversationId,
      buildOptimisticMediaMessage({
        tempId,
        conversationId,
        trimmed,
        sender: user!,
        previewUrl,
        replyTo,
      }),
    );
    clearReplyModeAfterEnqueue();

    // Clear composer immediately (don't revoke URL — bubble is using it)
    setInputValue("");
    detachSelectedForSubmit();

    let attachmentIds: number[];
    try {
      attachmentIds = await uploadWithProgress(file, tempId);
    } catch (uploadError) {
      updateOptimisticMessageInCache(conversationId, tempId, { _status: "failed" });
      clearUploadProgress(tempId);
      const msg = toUserMessage(uploadError, "Upload failed");
      toast.error(msg);
      return;
    }

    // Send via socket — reuse existing optimistic bubble
    await sendMessageMutation.mutateAsync({
      conversationId,
      content: trimmed.length > 0 ? trimmed : undefined,
      attachmentIds,
      ...replySendFields,
      _optimisticId: tempId,
    });
  }

  async function handleTextSend(trimmed: string) {
    const replyTo = getReplyToFromTarget(replyTarget);
    const replySendFields = buildReplySendFields(replyTo);
    // sendMessage creates its own optimistic bubble
    const sendPromise = sendMessageMutation.mutateAsync({
      conversationId,
      content: trimmed,
      ...replySendFields,
    });
    clearReplyModeAfterEnqueue();
    await sendPromise;
    setInputValue("");
  }

  // ── Submit: orchestrates media or text flow ──
  async function handleSubmit() {
    if (isEditing) {
      await handleSaveEdit();
      return;
    }
    const trimmed = inputValue.trim();
    if ((!trimmed && !selectedFile) || isSending || !user) return;

    setIsSending(true);
    try {
      if (selectedFile) {
        await handleMediaSend(trimmed, selectedFile);
      } else {
        await handleTextSend(trimmed);
      }
      stopTyping();
      clearSelectedFile();
    } catch (error) {
      const message = toUserMessage(error, "Send failed");
      toast.error(message);
      console.error("Send failed:", error);
      // Text-only: input value preserved for retry
      // Media: bubble already marked failed by provider timeout/ack
    } finally {
      setIsSending(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSubmit();
  }

  useEffect(() => {
    if (!pendingCaretRef.current) return;
    const textarea = textareaRef.current;
    if (!textarea) {
      pendingCaretRef.current = null;
      return;
    }

    const { start, end } = pendingCaretRef.current;
    pendingCaretRef.current = null;

    suppressCloseOnFocusRef.current = true;
    textarea.focus();
    textarea.selectionStart = start;
    textarea.selectionEnd = end;

    // Allow subsequent focus events to close the picker as usual
    setTimeout(() => {
      suppressCloseOnFocusRef.current = false;
    }, 0);
  }, [inputValue]);

  const canSave = Boolean(editTarget) && Boolean(editSaveState) && !editSaveState!.disabled && !isSending;
  const canSend = (inputValue.trim().length > 0 || selectedFile !== null) && !isSending;

  return (
    <div className="px-3 pb-3 pt-2">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />


      <EditModeBanner editTarget={editTarget} onCancelEdit={handleCancelEdit} />
      <ReplyModeBanner replyTo={replyTarget?.replyTo ?? null} onCancelReply={handleCancelReply} />

      {/* Composer row */}
      <form className="flex items-end gap-2" onSubmit={handleFormSubmit}>
        {/* Input container */}
        <div className="flex-1 flex flex-col min-w-0 bg-muted/30 border border-border/40 rounded-xl overflow-hidden">
          {/* Attachment preview — inside container */}
          <AttachmentPreview
            previewUrl={previewUrl}
            selectedFile={selectedFile}
            isSending={isSending}
            onClear={clearSelectedFile}
          />

          {/* Input row */}
          <div className="flex items-end">
          {/* Emoji picker — left side inside container */}
          <Popover open={isEmojiOpen} onOpenChange={setIsEmojiOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={isSending}
                className="size-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors shrink-0"
              >
                <Smile className="size-[18px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              className="p-0 w-80"
              onFocusOutside={(event) => {
                if (suppressCloseOnFocusRef.current) {
                  event.preventDefault();
                }
              }}
            >
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                autoFocusSearch={false}
                theme={pickerTheme}
                width={320}
                height={400}
              />
            </PopoverContent>
          </Popover>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={inputValue}
            placeholder="Type your message.."
            onKeyDown={handleKeyDown}
            onChange={handleInputChange}
            className="flex-1 min-w-0 border-0 shadow-none focus-visible:ring-0 bg-transparent dark:bg-transparent resize-none min-h-[44px] py-3 px-2"
          />

          {/* Attachment popover — right side inside container */}
          <AttachmentMenu
            onSelectImage={() => {
              if (isEditing) return;
              openFilePicker();
            }}
            disabled={isSending || isEditing}
          />
          </div>
        </div>

        {/* Send button — outside container, visually aligned */}
        <button
          type="submit"
          aria-label={isEditing ? "Save edit" : "Send"}
          disabled={isEditing ? !canSave : !canSend}
          className="size-[44px] flex items-center justify-center bg-primary text-primary-foreground rounded-full shrink-0 disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all"
        >
          {isEditing ? <Check className="size-[18px]" /> : <Send className="size-[18px]" />}
        </button>
      </form>
    </div>
  );
}
