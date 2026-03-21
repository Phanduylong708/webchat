import type {
  DisplayMessage,
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
  };
}
