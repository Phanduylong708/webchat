import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Check, Send } from "lucide-react";
import type { EmojiClickData, Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import useSocket from "@/app/providers/useSocket";
import { insertTextAtCaret } from "@/utils/caret.util";
import { getEditSaveState } from "@/utils/edit-mode.util";
import { useAttachmentSelection } from "@/features/chat/components/chat-input/useAttachmentSelection";
import { useTypingIndicator } from "@/features/chat/components/chat-input/useTypingIndicator";
import AttachmentMenu from "@/features/chat/components/chat-input/AttachmentMenu";
import AttachmentPreview from "@/features/chat/components/chat-input/AttachmentPreview";
import ChatEmojiPicker from "@/features/chat/components/chat-input/ChatEmojiPicker";
import EditModeBanner from "@/features/chat/components/chat-input/EditModeBanner";
import ReplyModeBanner from "@/features/chat/components/chat-input/ReplyModeBanner";
import type { ReplyToPreview } from "@/types/chat.type";
import { useChatComposerSubmit } from "@/features/chat/components/chat-input/useChatComposerSubmit";

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
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretRef = useRef<{ start: number; end: number } | null>(null);
  const suppressCloseOnFocusRef = useRef(false);
  const { theme = "system" } = useTheme();
  const pickerTheme: Theme =
    theme === "dark" ? ("dark" as Theme) : theme === "light" ? ("light" as Theme) : ("auto" as Theme);
  const { socket } = useSocket();

  const {
    selectedFile,
    previewUrl,
    fileInputRef,
    handleFileSelect,
    clearSelectedFile,
    openFilePicker,
    detachSelectedForSubmit,
  } = useAttachmentSelection();
  const { notifyTypingActivity, stopTyping } = useTypingIndicator({ socket, conversationId });

  const isEditing = editTarget !== null;
  const editSaveState = !editTarget
    ? null
    : getEditSaveState({
        messageType: editTarget.messageType,
        oldContent: editTarget.initialContent,
        draft: inputValue,
      });
  const { isSending, handleSubmit, handleCancelEdit } = useChatComposerSubmit({
    conversationId,
    inputValue,
    setInputValue,
    selectedFile,
    previewUrl,
    clearSelectedFile,
    detachSelectedForSubmit,
    editTarget,
    replyTarget,
    editSaveDisabled: editSaveState?.disabled ?? false,
    onCancelEdit,
    onSaveEdit,
    onCancelReply,
    stopTyping,
  });

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

  function handleCancelReply() {
    onCancelReply?.();
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
            <ChatEmojiPicker
              isOpen={isEmojiOpen}
              setIsOpen={setIsEmojiOpen}
              isDisabled={isSending}
              pickerTheme={pickerTheme}
              suppressCloseOnFocus={suppressCloseOnFocusRef.current}
              onEmojiClick={handleEmojiClick}
            />

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
          className="size-11 flex items-center justify-center bg-primary text-primary-foreground rounded-full shrink-0 disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all"
        >
          {isEditing ? <Check className="size-[18px]" /> : <Send className="size-[18px]" />}
        </button>
      </form>
    </div>
  );
}
