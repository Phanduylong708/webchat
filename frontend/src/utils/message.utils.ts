import type { Messages, DisplayMessage } from "@/types/chat.type";

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
