export type ResponseType<T> = {
    success: boolean;
    data: T;
    message?: string;
}

export interface User {
    id: number;
    username: string;
    avatar: string | null;
}

export interface ConversationsResponse {
    id: number;
    title: string | null;
    type: "PRIVATE" | "GROUP";
    otherUser?: User;
    memberCount?: number;
    previewMembers?: User[];
    lastMessage: {
        id: number;
        content: string;
        createdAt: string;
        sender: User;
    } | null;
}

export interface Messages {
    id: number;
    conversationId: number;
    senderId: number;
    content: string;
    createdAt: string;
    sender: User;
}

export interface ConversationState {
  conversations: ConversationsResponse[];
  activeConversationId: number | null;
  loadingConversations: boolean;
  error: string | null;
}

export interface ConversationContextValue extends ConversationState {
  fetchConversations: () => Promise<void>;
  selectConversation: (id: number) => Promise<void>;
  // Additional actions and setters will be added as we implement more steps
}