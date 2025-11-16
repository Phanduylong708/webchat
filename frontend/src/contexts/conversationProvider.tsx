import { useEffect, useState, type JSX } from "react";
import type {
  ConversationsResponse,
  ConversationContextValue,
} from "@/types/chat.type";
import {
  getConversations,
  createGroupApi,
  addMemberApi,
  leaveGroupApi,
} from "@/api/conversation.api";
import useSocket from "@/hooks/useSocket";
import { useConversationSockets } from "@/hooks/useConversationSockets";
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
    const [typingByConversation, setTypingByConversation] = useState<Map<number, Map<number, string>>>(new Map());
    const [systemMessages, setSystemMessages] = useState<Map<number, string>>(new Map());
    // prettier-ignore
    const [error, setError] = useState<string | null>(null);

    const {socket} = useSocket();
    useConversationSockets({
      socket,
      setConversations,
      setOnlineUsers,
      setTypingByConversation,
      setSystemMessages,
    });




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

    //GROUP 
  async function createGroup(title: string, memberIds: number[]): Promise<{ success: boolean; message?: string
  }> {
    setError(null);
    try {
      await createGroupApi(title, memberIds);
      await fetchConversations();
      return { success: true };
    } catch (error) {
      console.error("Error creating group:", error);
      const message = "Failed to create group";
      setError(message);
      return { success: false, message };
    }
  }

    async function addMember(conversationId: number, userId: number): Promise<{ success: boolean; message?: string }> {
      setError(null);
      try {
        await addMemberApi(conversationId, userId);
        return {success: true};
      } catch (error) {
        console.error("Error adding member:", error);
        setError("Failed to add member");
        return {success: false, message: "Failed to add member"};
      }
    }

    async function leaveGroup(conversationId: number): Promise<{success: boolean; message?: string }> {
      setError(null);
      try {
        await leaveGroupApi(conversationId);
        // Remove the conversation from the list
        setConversations((prev) => prev.filter(c => c.id !== conversationId));
        // If the active conversation is the one left, clear it
        if (activeConversationId === conversationId) {
          setActiveConversationId(null);
        }
        return {success: true};
      } catch (error) {
        console.error("Error leaving group:", error);
        setError("Failed to leave group");
        return {success: false, message: "Failed to leave group"};
      }
    }

    const value: ConversationContextValue = {
      conversations,
      activeConversationId,
      loadingConversations,
      error,
      onlineUsers,
      typingByConversation,
      systemMessages,
      fetchConversations,
      selectConversation,
      createGroup,
      addMember,
      leaveGroup,
    };
    return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export { ConversationContext, ConversationProvider };
