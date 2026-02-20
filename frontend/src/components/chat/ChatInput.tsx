import { useRef, useState } from "react";
import { Textarea } from "../ui/textarea";
import { Send, ImagePlus, X } from "lucide-react";
import { useMessage } from "@/hooks/context/useMessage";
import useSocket from "@/hooks/context/useSocket";
import { useAuth } from "@/hooks/context/useAuth";
import { uploadMediaApi } from "@/api/media.api";
import type { OptimisticMessage } from "@/types/chat.type";
import { toast } from "sonner";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

//prettier-ignore
export default function ChatInput({conversationId}: {conversationId: number;}): React.JSX.Element {

  const [inputValue, setInputValue] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCurrentlyTypingRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { socket } = useSocket();
  const { user } = useAuth();
  const { sendMessage, insertOptimisticMessage, updateOptimistic } = useMessage();

  // ── File selection + validation ──
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

    // Revoke previous preview URL if any
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearSelectedFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
  }

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

  // ── Submit: upload-at-send with optimistic bubble ──
  async function handleSubmit() {
    const trimmed = inputValue.trim();
    const hasText = trimmed.length > 0;
    const hasFile = selectedFile !== null;

    if ((!hasText && !hasFile) || isSending || !user) return;

    setIsSending(true);

    // Capture file + preview before clearing UI state
    const fileToUpload = selectedFile;
    const currentPreviewUrl = previewUrl;
    const tempId = -Date.now();

    try {
      if (hasFile && fileToUpload) {
        // ── Media flow: insert optimistic bubble immediately ──
        const tempMessage: OptimisticMessage = {
          id: tempId,
          conversationId,
          content: hasText ? trimmed : null,
          messageType: "IMAGE",
          senderId: user.id,
          sender: {
            id: user.id,
            username: user.username,
            avatar: user.avatar || null,
          },
          attachments: [],
          createdAt: new Date().toISOString(),
          _optimistic: true,
          _status: "sending",
          _previewUrl: currentPreviewUrl ?? undefined,
          _progress: 0,
        };

        insertOptimisticMessage(tempMessage);

        // Clear composer immediately — bubble is now in message list
        setInputValue("");
        setSelectedFile(null);
        setPreviewUrl(null); // Don't revoke — bubble is using the URL

        // Upload with progress piped to the optimistic bubble
        let attachmentIds: number[];
        try {
          const attachment = await uploadMediaApi(fileToUpload, {
            onProgress: (percent) => {
              updateOptimistic(conversationId, tempId, { _progress: percent });
            },
          });
          attachmentIds = [attachment.id];
        } catch (uploadError) {
          // Mark bubble as failed
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
          content: hasText ? trimmed : undefined,
          attachmentIds,
          _optimisticId: tempId,
        });
      } else {
        // ── Text-only flow: sendMessage creates its own temp bubble ──
        await sendMessage({
          conversationId,
          content: trimmed,
        });
        setInputValue("");
      }

      // Stop typing indicator
      socket?.emit("typing:stop", { conversationId });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      isCurrentlyTypingRef.current = false;
      clearSelectedFile();
    } catch (error) {
      console.error("Send failed:", error);
      // For text-only: keep input value for retry
      // For media: bubble already marked failed by provider timeout/ack
    } finally {
      setIsSending(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSubmit();
  }

  const canSend = (inputValue.trim().length > 0 || selectedFile !== null) && !isSending;

  return (
    <div className="border-t p-4">
      {/* File preview */}
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

      <form className="flex gap-2" onSubmit={handleFormSubmit}>
        {/* Image picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending}
          className="shrink-0 size-10 flex items-center justify-center text-muted-foreground rounded-md hover:bg-accent hover:text-foreground disabled:opacity-50 transition-colors"
        >
          <ImagePlus className="size-5" />
        </button>

        <div className="flex-1 min-w-0">
          <Textarea
            value={inputValue}
            placeholder="Type your message.."
            onKeyDown={handleKeyDown}
            onChange={handleInputChange}
          />
        </div>

        <button
          type="submit"
          disabled={!canSend}
          className="shrink-0 size-10 flex items-center justify-center bg-primary text-primary-foreground rounded-md disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
