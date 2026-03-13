import { useContext } from "react";
import { ConversationUiContext, type ConversationUiContextValue } from "@/contexts/conversationUiContext";

export function useConversationUi(): ConversationUiContextValue {
  const ctx = useContext(ConversationUiContext);
  if (!ctx) {
    throw new Error("useConversationUi must be used within ConversationUiProvider");
  }
  return ctx;
}
