export type ResponseType<T> = {
  success: boolean;
  data: T;
  message?: string;
};

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

export interface ConversationsDetail {
    id: number;
    title: string | null;
    type: "PRIVATE" | "GROUP";
    members: User[];
    creatorId: number;
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
  typingByConversation: Map<number, Map<number, string>>;
  systemMessages: Map<number, string>;
  createGroup: (title: string, memberIds: number[]) => Promise<{ success: boolean; message?: string }>;
  addMember: (conversationId: number, userId: number) => Promise<{ success: boolean; message?: string }>;
  leaveGroup: (conversationId: number) => Promise<{success: boolean; message?: string }>;
}

export interface MessageState {
  messagesByConversation: Map<number, Messages[]>; // cache messages per conversation
  pagination: Map<number, { nextCursor: number | null; hasMore: boolean }>; // meta for infinite scroll
  loadingMessages: boolean;
  loadingOlderByConversation: Set<number>;
  error: string | null;
}

export interface MessageContextValue extends MessageState {
  fetchMessages(conversationId: number): Promise<void>;
  sendMessage(conversationId: number, content: string): Promise<void>;
  loadOlderMessages(conversationId: number): Promise<void>;
  // loadOlderMessages(conversationId: number): Promise<void>; //TODO
}
