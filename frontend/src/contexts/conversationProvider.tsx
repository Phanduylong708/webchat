import { useEffect, useState, type JSX } from "react";
import type {
  ConversationsResponse,
  ConversationContextValue,
  User,
  ConversationsDetail,
} from "@/types/chat.type";
import {
  getConversations,
  createGroupApi,
  addMemberApi,
  leaveGroupApi,
} from "@/api/conversation.api";
import type { Messages } from "@/types/chat.type";
import useSocket from "@/hooks/useSocket";
import { ConversationContext } from "./conversationContext";

//helper
function updateTypingMap(
  map: Map<number, Map<number, string>>,
  conversationId: number,
  userId: number,
  username: string,
  isTyping: boolean
): Map<number, Map<number, string>> {
  const updated = new Map(map); // Clone outer Map
  const currentInnerMap =
    updated.get(conversationId) || new Map<number, string>();
  const newInnerMap = new Map(currentInnerMap); // Clone inner Map

  if (isTyping) {
    newInnerMap.set(userId, username);
  } else {
    newInnerMap.delete(userId);
  }
  updated.set(conversationId, newInnerMap);
  return updated;
}

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
    // Listen for online/offline user events
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
    // Listen for typing events
    useEffect(() => {
      if (!socket) return;

      function handleTypingEvent(payload: { userId: number, username: string, conversationId: number, isTyping: boolean }) {
        console.log("Typing event received:", payload);
        setTypingByConversation((prev) => 
          updateTypingMap(prev, payload.conversationId, payload.userId, payload.username, payload.isTyping)
        );
      }
      socket.on("userTyping", handleTypingEvent);
      return () => {
        socket.off("userTyping", handleTypingEvent);
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

    async function addMember(conversationId: number, userId: number): Promise<void> {
      setError(null);
      try {
        await addMemberApi(conversationId, userId);
      } catch (error) {
        console.error("Error adding member:", error);
        setError("Failed to add member");
      }
    }

    async function leaveGroup(conversationId: number): Promise<void> {
      setError(null);
      try {
        await leaveGroupApi(conversationId);
        // Remove the conversation from the list
        setConversations((prev) => prev.filter(c => c.id !== conversationId));
        // If the active conversation is the one left, clear it
        if (activeConversationId === conversationId) {
          setActiveConversationId(null);
        }
      } catch (error) {
        console.error("Error leaving group:", error);
        setError("Failed to leave group");
      }
    }

    useEffect(() => {
      if (!socket) return;

      function handleMemberAdded(payload: {
        conversationId: number;
        member: User;
      }) {
        // Listen for member added events
        console.log("Member added to conversation:", payload);
        setConversations((prev) => {
          // Update the conversation's member list
          return prev.map((c) => {
            if (c.id === payload.conversationId) {  
              const existingMembers = c.previewMembers || [];
              const memberExists = existingMembers.some(m => m.id === payload.member.id);
              if (memberExists) return c; // No change if member already exists
              const updatedMembers = [...existingMembers, payload.member];
              const updatedCount = (c.memberCount || 0) + 1; // Increment count
              return {
                ...c,
                previewMembers: updatedMembers,
                memberCount: updatedCount,
              }; 
            }
            return c; 
          });
        });
      }
      socket.on("memberAdded", handleMemberAdded);
      return () => {
        socket.off("memberAdded", handleMemberAdded);
      };
    }, [socket]);

    useEffect(() => {
      if (!socket) return;
      function handleAddedToConversation(payload: {conversation: ConversationsDetail}) {
        console.log("Added to new conversation:", payload);
        const newConv: ConversationsResponse = {
          id: payload.conversation.id,
          title: payload.conversation.title,
          type: payload.conversation.type,
          memberCount: payload.conversation.members.length,
          previewMembers: payload.conversation.members.slice(0, 3),
          lastMessage: null,
        };
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === newConv.id);
            if (exists) return prev; // Already exists
            return [newConv, ...prev];
          });
      }
      socket.on("addedToConversation", handleAddedToConversation);
      return () => {
        socket.off("addedToConversation", handleAddedToConversation);
      };
    }, [socket]);

    useEffect(() => {
      if (!socket) return;
      function handleMemberLeft(payload: { conversationId: number; userId: number }) {
      console.log("Member left conversation:", payload);
      setConversations((prev) => {
        return prev.map((c) => {
          if (c.id === payload.conversationId) {
            const existingMembers = c.previewMembers || [];
            const updatedMembers = existingMembers.filter(
              (m) => m.id !== payload.userId
            );
            const updatedCount = Math.max(0, (c.memberCount || 1) - 1); // Decrement count
            return {
              ...c,
              previewMembers: updatedMembers,
              memberCount: updatedCount,
            };
          }
          return c;
        });
      });
    }
    socket.on("memberLeft", handleMemberLeft);
    return () => {socket.off("memberLeft", handleMemberLeft)};
    }, [socket]);


    const value: ConversationContextValue = {
      conversations,
      activeConversationId,
      loadingConversations,
      error,
      onlineUsers,
      typingByConversation,
      fetchConversations,
      selectConversation,
      createGroup,
      addMember,
      leaveGroup,
    };
    return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export { ConversationContext, ConversationProvider };
