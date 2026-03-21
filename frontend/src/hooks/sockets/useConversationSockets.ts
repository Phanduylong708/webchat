import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTypingSync } from "@/hooks/sockets/conversation/useTypingSync";
import { useMessageSync } from "@/hooks/sockets/conversation/useMessageSync";
import { useMembershipSync } from "@/hooks/sockets/conversation/useMembershipSync";
import { conversationsQueryKey } from "@/hooks/queries/conversations";
import useSocket from "@/hooks/context/useSocket";
import { useAuth } from "@/features/auth/providers/useAuth";

type TypingSetter = Dispatch<SetStateAction<Map<number, Map<number, string>>>>;
type SystemMessageSetter = Dispatch<SetStateAction<Map<number, string>>>;

interface UseConversationSocketsParams {
  setTypingByConversation: TypingSetter;
  setSystemMessages: SystemMessageSetter;
  /**
   * Called when the current user is kicked from a conversation.
   * The callback receives the kicked conversation ID so it can conditionally
   * clear the URL param only when that conversation is currently active.
   */
  clearActiveConversation: (conversationId: number) => void;
}

/**
 * Centralizes all socket listeners that impact conversation state.
 * Server state (conversation list) is patched via TanStack Query cache.
 * Ephemeral UI state (typing, system messages) is patched via setter props.
 */
export function useConversationSockets({
  setTypingByConversation,
  setSystemMessages,
  clearActiveConversation,
}: UseConversationSocketsParams): void {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  // Re-sync both caches after a socket reconnect.
  // Required safety net for staleTime: Infinity — without this a dropped
  // connection leaves the cache stale indefinitely.
  useEffect(() => {
    if (!socket || !currentUserId) return;
    const userId = currentUserId;
    function handleReconnect() {
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId) });
      // Invalidate all cached conversation-details entries so any open dialogs
      // refetch after reconnect rather than showing stale member lists.
      void queryClient.invalidateQueries({ queryKey: ["conversation-details"] });
    }
    socket.on("connect", handleReconnect);
    return () => {
      socket.off("connect", handleReconnect);
    };
  }, [socket, currentUserId, queryClient]);

  useMessageSync({ socket, currentUserId });
  useTypingSync({ socket, setTypingByConversation });
  useMembershipSync({ socket, currentUserId, setSystemMessages, clearActiveConversation });
}
