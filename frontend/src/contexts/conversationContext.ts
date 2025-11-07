import { createContext } from "react";
import type { ConversationContextValue } from "@/types/chat.type";

export const ConversationContext =
  createContext<ConversationContextValue | null>(null);
