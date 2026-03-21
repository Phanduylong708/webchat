import { useCallback, useState, type JSX } from "react";
import { useSearchParams } from "react-router-dom";
import { useConversationSockets } from "@/features/conversation/hooks/useConversationSockets";
import { ConversationUiContext } from "./conversationUiContext";

export function ConversationUiProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [typingByConversation, setTypingByConversation] = useState<
    Map<number, Map<number, string>>
  >(new Map());
  const [systemMessages, setSystemMessages] = useState<Map<number, string>>(new Map());

  const [searchParams, setSearchParams] = useSearchParams();

  const clearActiveConversation = useCallback(
    (conversationId: number) => {
      const activeId = Number(searchParams.get("conversationId")) || null;
      if (activeId === conversationId) {
        setSearchParams((p) => {
          p.delete("conversationId");
          return p;
        });
      }
    },
    [searchParams, setSearchParams],
  );

  useConversationSockets({
    setTypingByConversation,
    setSystemMessages,
    clearActiveConversation,
  });

  return (
    <ConversationUiContext.Provider value={{ typingByConversation, systemMessages }}>
      {children}
    </ConversationUiContext.Provider>
  );
}
