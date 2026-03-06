import type {
  DisplayMessage,
  Messages,
  OptimisticMessage,
  ReplyToPreview,
  User,
} from "@/types/chat.type";

type BuildOptimisticTextMessageParams = {
  tempId: number;
  conversationId: number;
  trimmedContent: string | null;
  messageType?: "TEXT" | "IMAGE";
  sender: User;
  replyToMessageId?: number | null;
  replyTo?: ReplyToPreview | null;
};

type BuildOptimisticMediaMessageParams = {
  tempId: number;
  conversationId: number;
  trimmed: string;
  sender: User;
  previewUrl: string | null;
  replyTo?: ReplyToPreview | null;
};

// Appends a message to the existing conversation history while cloning Maps for immutability.
export function addMessageToMap(
  map: Map<number, DisplayMessage[]>,
  conversationId: number,
  message: DisplayMessage
): Map<number, DisplayMessage[]> {
  const updated = new Map(map);
  const existing = updated.get(conversationId) || [];
  updated.set(conversationId, [...existing, message]);
  return updated;
}

// Removes a specific message (temporary or real) from the conversation cache.
export function removeMessageFromMap(
  map: Map<number, DisplayMessage[]>,
  conversationId: number,
  messageId: string | number
): Map<number, DisplayMessage[]> {
  const updated = new Map(map);
  const messages = updated.get(conversationId) || [];
  updated.set(
    conversationId,
    messages.filter((m) => m.id !== messageId)
  );
  return updated;
}

// Replaces a temp/optimistic message with the server-acknowledged message.
// Carries `_stableKey` from the old ID so React can keep the same DOM node.
export function replaceMessageInMap(
  map: Map<number, DisplayMessage[]>,
  conversationId: number,
  oldId: string | number,
  newMessage: Messages
): Map<number, DisplayMessage[]> {
  const updated = new Map(map);
  const messages = updated.get(conversationId) || [];
  const replaced = messages.map((m) =>
    m.id === oldId
      ? Object.assign({}, newMessage, { _stableKey: oldId })
      : m
  );
  updated.set(conversationId, replaced);
  return updated;
}

// Updates an optimistic message's metadata in-place (e.g. mark as failed).
// No-op if conversation or message not found.
export function updateOptimisticInMap(
  map: Map<number, DisplayMessage[]>,
  conversationId: number,
  messageId: number,
  patch: Partial<Pick<import("@/types/chat.type").OptimisticMeta, "_status" | "_progress">>
): Map<number, DisplayMessage[]> {
  const messages = map.get(conversationId);
  if (!messages) return map;

  const hasTarget = messages.some((m) => m.id === messageId && "_optimistic" in m);
  if (!hasTarget) return map;

  const updated = new Map(map);
  updated.set(
    conversationId,
    messages.map((m) =>
      m.id === messageId && "_optimistic" in m ? { ...m, ...patch } : m
    )
  );
  return updated;
}

// Updates a message in the conversation cache (e.g. server edit).
// No-op if conversation or message not found.
export function updateMessageInMap(
  map: Map<number, DisplayMessage[]>,
  conversationId: number,
  messageId: number,
  patchOrNextMessage: DisplayMessage | ((prev: DisplayMessage) => DisplayMessage)
): Map<number, DisplayMessage[]> {
  const messages = map.get(conversationId);
  if (!messages) return map;

  const index = messages.findIndex((m) => m.id === messageId);
  if (index === -1) return map;

  const prev = messages[index];
  const next =
    typeof patchOrNextMessage === "function" ? patchOrNextMessage(prev) : patchOrNextMessage;

  // Preserve the stable key used by MessageList for DOM continuity.
  const stableKey = "_stableKey" in prev ? (prev as unknown as { _stableKey: unknown })._stableKey : undefined;
  const merged =
    stableKey !== undefined && !("_stableKey" in next)
      ? Object.assign({}, next, { _stableKey: stableKey })
      : next;

  const updated = new Map(map);
  const cloned = messages.slice();
  cloned[index] = merged;
  updated.set(conversationId, cloned);
  return updated;
}

// Clears loaded reply previews that point at a deleted message without reordering the list.
export function clearReplyLinksInMap(
  map: Map<number, DisplayMessage[]>,
  conversationId: number,
  deletedMessageId: number
): Map<number, DisplayMessage[]> {
  const messages = map.get(conversationId);
  if (!messages) return map;

  let didChange = false;
  const nextMessages = messages.map((message) => {
    const isReplyingToDeletedMessage =
      message.replyToMessageId === deletedMessageId || message.replyTo?.id === deletedMessageId;

    if (!isReplyingToDeletedMessage) {
      return message;
    }

    didChange = true;
    return {
      ...message,
      replyToMessageId: null,
      replyTo: null,
    };
  });

  if (!didChange) return map;

  const updated = new Map(map);
  updated.set(conversationId, nextMessages);
  return updated;
}

export function buildOptimisticTextMessage({
  tempId,
  conversationId,
  trimmedContent,
  messageType = "TEXT",
  sender,
  replyToMessageId,
  replyTo,
}: BuildOptimisticTextMessageParams): OptimisticMessage {
  return {
    id: tempId,
    conversationId,
    content: trimmedContent,
    messageType,
    senderId: sender.id,
    sender: {
      id: sender.id,
      username: sender.username,
      avatar: sender.avatar || null,
    },
    attachments: [],
    createdAt: new Date().toISOString(),
    editedAt: null,
    replyToMessageId: replyToMessageId ?? replyTo?.id ?? null,
    replyTo: replyTo ?? null,
    _optimistic: true,
    _status: "sending",
  };
}

export function buildOptimisticMediaMessage({
  tempId,
  conversationId,
  trimmed,
  sender,
  previewUrl,
  replyTo,
}: BuildOptimisticMediaMessageParams): OptimisticMessage {
  return {
    ...buildOptimisticTextMessage({
      tempId,
      conversationId,
      trimmedContent: trimmed.length > 0 ? trimmed : null,
      messageType: "IMAGE",
      sender,
      replyToMessageId: replyTo?.id ?? null,
      replyTo: replyTo ?? null,
    }),
    _previewUrl: previewUrl ?? undefined,
    _progress: 0,
  };
}
