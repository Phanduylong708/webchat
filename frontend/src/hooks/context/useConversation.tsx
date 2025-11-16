import { ConversationContext } from "@/contexts/conversationContext";
import type { ConversationContextValue } from "@/types/chat.type";
import { useContext } from "react";

export function useConversation(): ConversationContextValue {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error(
      "useConversation must be used within a ConversationProvider"
    );
  }
  return context;
}
