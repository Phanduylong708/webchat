import { createContext, useEffect, useState, type JSX } from "react";
import type {
  ConversationsResponse,
  ConversationContextValue,
} from "@/types/chat.type";
import { getConversations } from "@/api/conversation.api";

const ConversationContext = createContext<ConversationContextValue | null>(
  null
);

// prettier-ignore
function ConversationProvider({children}: {children: React.ReactNode}): JSX.Element {
    // prettier-ignore
    const [conversations, setConversations] = useState<ConversationsResponse[]>([]);
    // prettier-ignore
    const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
    // prettier-ignore
    const [loadingConversations, setLoadingConversations] = useState<boolean>(false);
    // prettier-ignore
    const [error, setError] = useState<string | null>(null);
   async function fetchConversations(): Promise<void> {
        setLoadingConversations(true);
        setError(null);
        try {
            const data = await getConversations();
            setConversations(data);
        } catch (error) {
            console.error("Error fetching conversations:", error);
            setError("Failed to fetch conversations");
        } finally {
            setLoadingConversations(false);
        }
    }

    async function selectConversation(id: number): Promise<void> {
        setActiveConversationId(id);
        console.log("Selected conversation ID:", id);
        // Additional logic to load messages can be added here
    }

    useEffect(() => {
    void fetchConversations();
    }, []);

    const value: ConversationContextValue = {
      conversations,
      activeConversationId,
      loadingConversations,
      error,
      fetchConversations,
      selectConversation,
    };
    return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export { ConversationContext, ConversationProvider };
