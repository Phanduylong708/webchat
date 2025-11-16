import { useRef, useState } from "react";
import { Textarea } from "../ui/textarea";
import { Send } from "lucide-react";
import { useMessage } from "@/hooks/context/useMessage";
import useSocket from "@/hooks/context/useSocket";

//prettier-ignore
export default function ChatInput({conversationId}: {conversationId: number;}): React.JSX.Element {
  
  const [inputValue, setInputValue] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCurrentlyTypingRef = useRef<boolean>(false); // track if we are in typing state

  const { socket } = useSocket();

  // Handle typing indicator
  const { sendMessage } = useMessage();
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value);

    if (!socket) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); // if already typing, reset timer
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
      e.preventDefault(); // Prevent newline
      handleSubmit();
    }
    // Shift+Enter → default behavior (newline)
  }

  async function handleSubmit() {
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    try {
      await sendMessage(conversationId, trimmed);
      console.log("Send:", trimmed); // Placeholder
      socket?.emit("typing:stop", { conversationId }); // Stop typing on send
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      isCurrentlyTypingRef.current = false;
      setInputValue(""); // Clear input on success
    } catch (error) {
      console.error("Send failed:", error);
      // Keep input value for retry
    } finally {
      setIsSending(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSubmit();
  }

  return (
    <div className="border-t p-4">
      <form className="flex gap-2" onSubmit={handleFormSubmit}>
        <div className="flex-1 min-w-0  ">
          <Textarea
            value={inputValue}
            placeholder="Type your message.."
            onKeyDown={handleKeyDown}
            onChange={handleInputChange}
          />
        </div>

        <button
          type="submit"
          disabled={!inputValue.trim() || isSending}
          className="shrink-0 size-10 flex items-center justify-center bg-primary text-primary-foreground rounded-md disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
