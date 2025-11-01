import { MessageContext } from "@/contexts/messageContext";
import { useContext } from "react";
import type { MessageContextValue } from "@/types/chat.type";

export function useMessage(): MessageContextValue {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error("useMessage must be used within a MessageProvider");
  }
  return context;
}
