import { createContext } from "react";
import type { MessageContextValue } from "@/types/chat.type";

export const MessageContext = createContext<MessageContextValue | null>(null);
