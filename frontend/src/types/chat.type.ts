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
export type PinPermission = "ALL_MEMBERS" | "CREATOR_ONLY";

export interface LatestPinnedMessageSummary {
  id: number;
  previewText: string;
  messageType: MessageType;
  pinnedAt: string;
}

export interface PinSummary {
  pinnedCount: number;
  latestPinnedMessage: LatestPinnedMessageSummary | null;
}

export interface PinnedMessageItem {
  messageId: number;
  conversationId: number;
  pinnedAt: string;
  pinnedBy: User;
  message: {
    id: number;
    content: string | null;
    previewText: string;
    messageType: MessageType;
    createdAt: string;
    sender: User;
    attachments: Pick<AttachmentItem, "id" | "url" | "mimeType" | "originalFileName">[];
  };
}

export type ReplyToPreview = {
  id: number;
  content: string | null;
  messageType: MessageType;
  sender: User;
};

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
  replyToMessageId?: number;
  _replyTo?: ReplyToPreview; // client-only: optimistic quote preview
  _optimisticId?: number; // If set, reuse existing optimistic message instead of creating a new one
}

export interface ConversationsResponse {
  id: number;
  title: string | null;
  type: "PRIVATE" | "GROUP";
  otherUser?: User;
  memberCount?: number;
  previewMembers?: User[];
  pinSummary?: PinSummary | null;
  pinPermission?: PinPermission;
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
  pinSummary: PinSummary | null;
  pinPermission: PinPermission;
}


export interface Messages {
  id: number;
  conversationId: number;
  senderId: number;
  content: string | null;
  messageType: MessageType;
  createdAt: string;
  editedAt: string | null;
  sender: User;
  attachments: AttachmentItem[];
  replyToMessageId?: number | null;
  replyTo?: ReplyToPreview | null;
}

// Client-only metadata for optimistic (unsent/in-flight/failed) messages.
// Discriminant: "_optimistic" — check with `if ("_optimistic" in message)`.
export interface OptimisticMeta {
  _optimistic: true;
  _status: "sending" | "failed";
  _previewUrl?: string;   // URL.createObjectURL for local image preview
  _progress?: number;     // upload progress 0–100
}

export type OptimisticMessage = Messages & OptimisticMeta;
export type DisplayMessage = Messages | OptimisticMessage;



export interface MessageState {
  messagesByConversation: Map<number, DisplayMessage[]>; // cache messages per conversation
  pagination: Map<number, { nextCursor: number | null; hasMore: boolean }>; // meta for infinite scroll
  loadingMessages: boolean;
  loadingOlderByConversation: Set<number>;
  error: string | null;
}

export interface MessageContextValue extends MessageState {
  fetchMessages(conversationId: number): Promise<void>;
  sendMessage(payload: SendMessageInput): Promise<void>;
  loadOlderMessages(conversationId: number): Promise<void>;
  insertOptimisticMessage(message: OptimisticMessage): void;
  updateOptimistic(conversationId: number, messageId: number, patch: Partial<Pick<OptimisticMeta, "_status" | "_progress">>): void;
  removeOptimisticMessage(conversationId: number, messageId: number): void;
}
