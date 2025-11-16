import type { User } from "@/types/chat.type";

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

// Returns the best available username for system messages when a member leaves.
// Preference order:
// 1. Username provided in socket payload (definitive source)
// 2. Matching member from preview list (best effort if payload lacks user)
// 3. First preview member (fallback to some name to avoid anonymous text)
// 4. Default to generic "A member"
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
