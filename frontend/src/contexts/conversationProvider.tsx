import { useEffect, useState, type JSX } from "react";
import type {
  ConversationsResponse,
  ConversationContextValue,
} from "@/types/chat.type";
import { getConversations } from "@/api/conversation.api";
import type { Messages } from "@/types/chat.type";
import useSocket from "@/hooks/useSocket";
import { ConversationContext } from "./conversationContext";

// prettier-ignore
function ConversationProvider({children}: {children: React.ReactNode}): JSX.Element {
    // prettier-ignore
    const [conversations, setConversations] = useState<ConversationsResponse[]>([]);
    // prettier-ignore
    const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
    // prettier-ignore
    const [loadingConversations, setLoadingConversations] = useState<boolean>(false);
    const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
    // prettier-ignore
    const [error, setError] = useState<string | null>(null);

    const {socket} = useSocket();
    // Listen for new messages to update conversation list
    useEffect(() => {
      if (!socket) return;

      function handleNewMessage(message: Messages) {
        console.log("New message received in conversation context:", message);
        setConversations((prev) => {
          const conversation = prev.find(c => c.id === message.conversationId);
          const newLastMessage = {
            id: message.id,
            content: message.content,
            createdAt: message.createdAt,
            sender: message.sender,
          };
          if (!conversation) return prev;
          const updated = prev.map(c => 
            c.id === message.conversationId ? {...c, lastMessage: newLastMessage} : c
          );
            const sorted = updated.sort((a, b) => {
              const timeA = a.lastMessage?.createdAt || "";
              const timeB = b.lastMessage?.createdAt || "";
              return timeB.localeCompare(timeA); // descending
            });
          return sorted;
        });
      }
      socket.on("newMessage", handleNewMessage);
      return () => {
        socket.off("newMessage", handleNewMessage);
      };
    }, [socket]);

    useEffect(() => {
      if (!socket) return;

      function handleOnlineUsers(payload: { userId: number, username: string }) {
        console.log("User came online:", payload.userId);
        setOnlineUsers((prev) => {
          const updated = new Set(prev);
          updated.add(payload.userId);
          return updated;
        });
      }

      function handleOfflineUsers(payload: {userId: number, lastSeen: string}) {
        console.log("User went offline:", payload.userId);
        setOnlineUsers((prev) => {
          const updated = new Set(prev);
          updated.delete(payload.userId);
          return updated;
        });
      }
      
      socket.on("friendOnline", handleOnlineUsers);
      socket.on("friendOffline", handleOfflineUsers);

      return () => {
        socket.off("friendOnline", handleOnlineUsers);
        socket.off("friendOffline", handleOfflineUsers);
      };
    }, [socket]);

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
      onlineUsers,
      fetchConversations,
      selectConversation,
    };
    return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export { ConversationContext, ConversationProvider };
