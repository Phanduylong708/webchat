import { useEffect, useRef, useState } from "react";
import { Textarea } from "../ui/textarea";
import { Send, Paperclip, ImagePlus, X, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import EmojiPicker, { Theme, type EmojiClickData } from "emoji-picker-react";
import { useTheme } from "next-themes";
import { useMessage } from "@/hooks/context/useMessage";
import useSocket from "@/hooks/context/useSocket";
import { useAuth } from "@/hooks/context/useAuth";
import { uploadMediaApi } from "@/api/media.api";
import type { OptimisticMessage } from "@/types/chat.type";
import { toast } from "sonner";
import { insertTextAtCaret } from "@/utils/caret.util";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

type DetachedAttachment = {
  file: File | null;
  previewUrl: string | null;
};

function useAttachmentSelection() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset input first — so re-selecting same file (even if invalid) triggers onChange
    e.target.value = "";

    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error("Only JPEG, PNG and WEBP images are allowed");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Image must be less than 10 MB");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearSelectedFile() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(null);
    setPreviewUrl(null);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function detachSelectedForSubmit(): DetachedAttachment {
    const detachedAttachment: DetachedAttachment = {
      file: selectedFile,
      previewUrl,
    };

    setSelectedFile(null);
    setPreviewUrl(null);

    return detachedAttachment;
  }

  return {
    selectedFile,
    previewUrl,
    fileInputRef,
    handleFileSelect,
    clearSelectedFile,
    openFilePicker,
    detachSelectedForSubmit,
  };
}

// ── Attachment Popover ──

function AttachmentMenu({ onSelectImage, disabled }: { onSelectImage: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="size-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors shrink-0"
        >
          <Paperclip className="size-[18px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="w-48 p-1">
        <button
          type="button"
          onClick={() => {
            onSelectImage();
            setOpen(false);
          }}
          className="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-md hover:bg-accent transition-colors"
        >
          <ImagePlus className="size-4 text-muted-foreground" />
          <span>Photo</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ── Main Component ──

//prettier-ignore
export default function ChatInput({conversationId}: {conversationId: number;}): React.JSX.Element {

  const [inputValue, setInputValue] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCurrentlyTypingRef = useRef<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretRef = useRef<{ start: number; end: number } | null>(null);
  const suppressCloseOnFocusRef = useRef(false);
  const { theme = "system" } = useTheme();
  const pickerTheme =
    theme === "dark" ? Theme.DARK : theme === "light" ? Theme.LIGHT : Theme.AUTO;

  const { socket } = useSocket();
  const { user } = useAuth();
  const { sendMessage, insertOptimisticMessage, updateOptimistic } = useMessage();
  const {
    selectedFile,
    previewUrl,
    fileInputRef,
    handleFileSelect,
    clearSelectedFile,
    openFilePicker,
    detachSelectedForSubmit,
  } = useAttachmentSelection();

  // ── Typing indicator ──
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value);

    if (!socket) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (!isCurrentlyTypingRef.current) {
      socket.emit("typing:start", { conversationId });
      isCurrentlyTypingRef.current = true;
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", { conversationId });
      isCurrentlyTypingRef.current = false;
      typingTimeoutRef.current = null;
    }, 2500);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
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

  function buildOptimisticMessage(tempId: number, trimmed: string): OptimisticMessage {
    return {
      id: tempId,
      conversationId,
      content: trimmed.length > 0 ? trimmed : null,
      messageType: "IMAGE",
      senderId: user!.id,
      sender: {
        id: user!.id,
        username: user!.username,
        avatar: user!.avatar || null,
      },
      attachments: [],
      createdAt: new Date().toISOString(),
      _optimistic: true,
      _status: "sending",
      _previewUrl: previewUrl ?? undefined,
      _progress: 0,
    };
  }

  async function uploadWithProgress(file: File, tempId: number): Promise<number[]> {
    const attachment = await uploadMediaApi(file, {
      onProgress: (percent) => {
        updateOptimistic(conversationId, tempId, { _progress: percent });
      },
    });
    return [attachment.id];
  }

  function stopTyping() {
    socket?.emit("typing:stop", { conversationId });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    isCurrentlyTypingRef.current = false;
  }

  async function handleMediaSend(trimmed: string, file: File) {
    const tempId = -Date.now();

    // Insert optimistic bubble immediately — bubble is now in message list
    insertOptimisticMessage(buildOptimisticMessage(tempId, trimmed));

    // Clear composer immediately (don't revoke URL — bubble is using it)
    setInputValue("");
    detachSelectedForSubmit();

    let attachmentIds: number[];
    try {
      attachmentIds = await uploadWithProgress(file, tempId);
    } catch (uploadError) {
      updateOptimistic(conversationId, tempId, { _status: "failed" });
      const msg =
        uploadError && typeof uploadError === "object" && "message" in uploadError
          ? (uploadError as { message: string }).message
          : "Upload failed";
      toast.error(msg);
      return;
    }

    // Send via socket — reuse existing optimistic bubble
    await sendMessage({
      conversationId,
      content: trimmed.length > 0 ? trimmed : undefined,
      attachmentIds,
      _optimisticId: tempId,
    });
  }

  async function handleTextSend(trimmed: string) {
    // sendMessage creates its own optimistic bubble
    await sendMessage({ conversationId, content: trimmed });
    setInputValue("");
  }

  // ── Submit: orchestrates media or text flow ──
  async function handleSubmit() {
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

      {/* File preview — above the composer */}
      {previewUrl && selectedFile && (
        <div className="mb-2 flex items-center gap-2">
          <div className="relative">
            <img
              src={previewUrl}
              alt={selectedFile.name}
              className="h-16 w-16 rounded-lg object-cover border border-border"
            />
            <button
              type="button"
              onClick={clearSelectedFile}
              disabled={isSending}
              className="absolute -top-1.5 -right-1.5 size-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs disabled:opacity-50"
            >
              <X className="size-3" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {selectedFile.name}
          </span>
        </div>
      )}

      {/* Composer row */}
      <form className="flex items-end gap-2" onSubmit={handleFormSubmit}>
        {/* Input container */}
        <div className="flex-1 flex items-end min-w-0 bg-muted/30 border border-border/40 rounded-xl overflow-hidden">
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
          <AttachmentMenu onSelectImage={openFilePicker} disabled={isSending} />
        </div>

        {/* Send button — outside container, visually aligned */}
        <button
          type="submit"
          disabled={!canSend}
          className="size-[44px] flex items-center justify-center bg-primary text-primary-foreground rounded-full shrink-0 disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all"
        >
          <Send className="size-[18px]" />
        </button>
      </form>
    </div>
  );
}
