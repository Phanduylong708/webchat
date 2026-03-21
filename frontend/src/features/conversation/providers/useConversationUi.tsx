import { useContext } from "react";
import { ConversationUiContext, type ConversationUiContextValue } from "@/features/conversation/providers/conversationUiContext";

export function useConversationUi(): ConversationUiContextValue {
  const ctx = useContext(ConversationUiContext);
  if (!ctx) {
    throw new Error("useConversationUi must be used within ConversationUiProvider");
  }
  return ctx;
}
