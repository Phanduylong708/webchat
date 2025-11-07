import { useState } from "react";
import { Textarea } from "../ui/textarea";
import { Send } from "lucide-react";
import { useMessage } from "@/hooks/useMessage";
export default function ChatInput({
  conversationId,
}: {
  conversationId: number;
}): React.JSX.Element {
  const [inputValue, setInputValue] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const { sendMessage } = useMessage();

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value);
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
        <div className="flex-1">
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
          className="flex-shrink-0 size-10 flex items-center justify-center bg-primary text-primary-foreground rounded-md disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
