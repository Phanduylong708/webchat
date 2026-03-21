import { useMutation, useQuery } from "@tanstack/react-query";
import { getConversationPins } from "@/features/conversation/api/conversation.api";
import useSocket from "@/app/providers/useSocket";
import { emitWithAckTimeout } from "@/utils/socketAck.util";
import type { PinnedMessageItem } from "@/types/chat.type";

type ConversationPinMutationInput = {
  conversationId: number;
  messageId: number;
};

type PinMessageAck = {
  success: boolean;
  error?: string;
  code?: string;
};

const PIN_ACK_TIMEOUT_MS = 12_000;
const CONVERSATION_PINS_STALE_TIME_MS = 30_000;

const conversationPinsQueryKey = (conversationId: number) => ["conversation-pins", conversationId] as const;

export function useConversationPinsQuery(conversationId: number, enabled: boolean) {
  return useQuery<PinnedMessageItem[]>({
    queryKey: conversationPinsQueryKey(conversationId),
    queryFn: () => getConversationPins(conversationId),
    enabled: enabled && Number.isInteger(conversationId) && conversationId > 0,
    staleTime: CONVERSATION_PINS_STALE_TIME_MS,
    retry: false,
  });
}

export function usePinMessageMutation() {
  const { socket, isConnected } = useSocket();

  return useMutation({
    mutationFn: async (payload: ConversationPinMutationInput) => {
      if (!socket || !isConnected) {
        throw new Error("Socket is not connected");
      }

      return emitWithAckTimeout<PinMessageAck | undefined, PinMessageAck>({
        socket,
        event: "pinMessage",
        payload,
        timeoutMs: PIN_ACK_TIMEOUT_MS,
        timeoutErrorMessage: "pinMessage timed out - no server acknowledgement",
        isSuccess: (ack): ack is PinMessageAck => Boolean(ack?.success),
        getErrorMessage: (ack) => ack?.error || "pinMessage failed",
      });
    },
  });
}

export function useUnpinMessageMutation() {
  const { socket, isConnected } = useSocket();

  return useMutation({
    mutationFn: async (payload: ConversationPinMutationInput) => {
      if (!socket || !isConnected) {
        throw new Error("Socket is not connected");
      }

      return emitWithAckTimeout<PinMessageAck | undefined, PinMessageAck>({
        socket,
        event: "unpinMessage",
        payload,
        timeoutMs: PIN_ACK_TIMEOUT_MS,
        timeoutErrorMessage: "unpinMessage timed out - no server acknowledgement",
        isSuccess: (ack): ack is PinMessageAck => Boolean(ack?.success),
        getErrorMessage: (ack) => ack?.error || "unpinMessage failed",
      });
    },
  });
}

export { conversationPinsQueryKey };
