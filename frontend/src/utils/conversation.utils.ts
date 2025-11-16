import type { User } from "@/types/chat.type";

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
