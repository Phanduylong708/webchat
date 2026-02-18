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

export type MessageType = "TEXT" | "IMAGE" | "VIDEO" | "FILE";

export interface AttachmentItem {
  id: number;
  url: string;
  publicId: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  originalFileName: string | null;
  createdAt: string;
  status?: "PENDING" | "ATTACHED";
}

export interface SendMessageInput {
  conversationId: number;
  content?: string;
  attachmentIds?: number[];
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
    content: string | null;
    messageType: MessageType;
    previewText: string;
    createdAt: string;
    sender: User;
    attachments?: Pick<AttachmentItem, "mimeType">[];
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
  content: string | null;
  messageType: MessageType;
  createdAt: string;
  sender: User;
  attachments: AttachmentItem[];
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
  sendMessage(payload: SendMessageInput): Promise<void>;
  loadOlderMessages(conversationId: number): Promise<void>;
}
