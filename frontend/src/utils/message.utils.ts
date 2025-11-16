import type { Messages } from "@/types/chat.type";

// Appends a message to the existing conversation history while cloning Maps for immutability.
export function addMessageToMap(
  map: Map<number, Messages[]>,
  conversationId: number,
  message: Messages
): Map<number, Messages[]> {
  const updated = new Map(map);
  const existing = updated.get(conversationId) || [];
  updated.set(conversationId, [...existing, message]);
  return updated;
}

// Removes a specific message (temporary or real) from the conversation cache.
export function removeMessageFromMap(
  map: Map<number, Messages[]>,
  conversationId: number,
  messageId: string | number
): Map<number, Messages[]> {
  const updated = new Map(map);
  const messages = updated.get(conversationId) || [];
  updated.set(
    conversationId,
    messages.filter((m) => m.id !== messageId)
  );
  return updated;
}

// Replaces a temp/optimistic message with the server-acknowledged message.
export function replaceMessageInMap(
  map: Map<number, Messages[]>,
  conversationId: number,
  oldId: string | number,
  newMessage: Messages
): Map<number, Messages[]> {
  const updated = new Map(map);
  const messages = updated.get(conversationId) || [];
  const replaced = messages.map((m) => (m.id === oldId ? newMessage : m));
  updated.set(conversationId, replaced);
  return updated;
}
