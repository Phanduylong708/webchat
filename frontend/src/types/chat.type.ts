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
  onlineUsers: Set<number>;
  // Additional actions and setters will be added as we implement more steps
}

export interface MessageState {
  messagesByConversation: Map<number, Messages[]>; // cache messages per conversation
  // pagination: Map<number, {cursor: number | null; hasMore: boolean}>; // meta for infinite scroll
  loadingMessages: boolean;
  error: string | null;
}

export interface MessageContextValue extends MessageState {
  fetchMessages(conversationId: number): Promise<void>;
  sendMessage(conversationId: number, content: string): Promise<void>;
  // loadOlderMessages(conversationId: number): Promise<void>; //TODO
}