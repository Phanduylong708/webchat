import { createContext } from "react";

export interface ConversationUiContextValue {
  typingByConversation: Map<number, Map<number, string>>;
  systemMessages: Map<number, string>;
}

export const ConversationUiContext = createContext<ConversationUiContextValue | null>(null);
