import { createContext, useState, useCallback, type JSX, useMemo } from "react";
import type { Messages, MessageContextValue } from "@/types/chat.type";
import { getMessages } from "@/api/message.api";

const MessageContext = createContext<MessageContextValue | null>(null);

function MessageProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [messagesByConversation, setMessagesByConversation] = useState<
    Map<number, Messages[]>
  >(new Map());
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // const [pagination, setPagination] = useState<Map<number, {cursor: number | null; hasMore: boolean}>>(new Map());

  const fetchMessages = useCallback(
    async (conversationId: number): Promise<void> => {
      // Check cache first. No double fetches
      if (messagesByConversation.has(conversationId)) {
        console.log(
          `Messages for ${conversationId} already cached, skipping fetch`
        );
        return;
      }

      setLoadingMessages(true);
      setError(null);
      try {
        const data = await getMessages(conversationId);
        const messages = data.messages;
        setMessagesByConversation((prev) =>
          new Map(prev).set(conversationId, messages)
        );
      } catch (error) {
        console.error(
          `Error fetching messages for conversation ${conversationId}:`,
          error
        );
        setError("Failed to fetch messages");
      } finally {
        setLoadingMessages(false);
      }
    },
    [messagesByConversation]
  );
  // async function loadOlderMessages(conversationId: number): Promise<void> {
  //     //TODO

  // }

  const value = useMemo(
    () => ({
      messagesByConversation,
      loadingMessages,
      error,
      fetchMessages,
    }),
    [messagesByConversation, loadingMessages, error, fetchMessages]
  );

  return (
    <MessageContext.Provider value={value}>{children}</MessageContext.Provider>
  );
}

export { MessageContext, MessageProvider };
