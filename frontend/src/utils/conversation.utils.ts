import type { ConversationsResponse, Messages, User } from "@/types/chat.type";

// Derives a human-readable preview text from a message.
// Returns content if present; otherwise a mime-family key ("image"/"video"/"file").
export function derivePreviewText(message: Messages): string {
  const text = message.content?.trim();
  if (text) return text;

  switch (message.messageType) {
    case "IMAGE":
      return "image";
    case "VIDEO":
      return "video";
    case "FILE":
      return "file";
    default:
      return "";
  }
}

// Maintains the typing map per conversation by cloning Maps instead of mutating
// in-place. This ensures React state updates correctly even with nested Map structures.
export function updateTypingMap(
  map: Map<number, Map<number, string>>,
  conversationId: number,
  userId: number,
  username: string,
  isTyping: boolean
): Map<number, Map<number, string>> {
  const updated = new Map(map);
  const currentInnerMap = updated.get(conversationId) || new Map<number, string>();
  const newInnerMap = new Map(currentInnerMap);

  if (isTyping) {
    newInnerMap.set(userId, username);
  } else {
    newInnerMap.delete(userId);
  }
  updated.set(conversationId, newInnerMap);
  return updated;
}

export function resolveLeavingUsername(
  payloadUser: User | undefined,
  fallbackMembers: User[],
  leavingUserId?: number
): string {
  if (payloadUser?.username) {
    return payloadUser.username;
  }
  if (leavingUserId) {
    // When socket payload only includes userId, try to find the username from previewMembers
    const found = fallbackMembers.find((member) => member.id === leavingUserId);
    if (found?.username) {
      return found.username;
    }
  }
  if (fallbackMembers.length > 0) {
    return fallbackMembers[0].username;
  }
  return "A member";
}

/**
 * Pure helper: patches the conversation list when a new message arrives.
 * Used by both the socket newMessage handler (for receivers) and the send
 * ack path (for the sender, who is excluded from the socket broadcast).
 *
 * Returns the same array reference if the conversation is not found.
 */
export function applyNewMessageToConversationList(
  prev: ConversationsResponse[],
  message: Messages,
): ConversationsResponse[] {
  const conversation = prev.find((c) => c.id === message.conversationId);
  if (!conversation) return prev;

  const previewText = derivePreviewText(message);
  const newLastMessage = {
    id: message.id,
    content: message.content,
    messageType: message.messageType,
    previewText,
    createdAt: message.createdAt,
    sender: message.sender,
    attachments: message.attachments?.map((a) => ({ mimeType: a.mimeType })),
  };

  const updated = prev.map((c) =>
    c.id === message.conversationId ? { ...c, lastMessage: newLastMessage } : c,
  );

  // Resort so most-recently-messaged conversation floats to top.
  return updated.sort((a, b) => {
    const timeA = a.lastMessage?.createdAt ?? "";
    const timeB = b.lastMessage?.createdAt ?? "";
    return timeB.localeCompare(timeA);
  });
}
