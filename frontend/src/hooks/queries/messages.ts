import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useAuth } from "@/hooks/context/useAuth";
import useSocket from "@/hooks/context/useSocket";
import { getMessages } from "@/api/message.api";
import { emitWithAckTimeout } from "@/utils/socketAck.util";
import { applyNewMessageToConversationList } from "@/utils/conversation.utils";
import { buildOptimisticTextMessage } from "@/utils/message.utils";
import { conversationsQueryKey } from "@/hooks/queries/conversations";
import type {
  DisplayMessage,
  Messages,
  OptimisticMessage,
  SendMessageInput,
  ConversationsResponse,
} from "@/types/chat.type";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessagesPage {
  messages: DisplayMessage[];
  meta: {
    nextCursor: number | null;
    hasMore: boolean;
  };
}

// What the socket ack returns after a successful sendMessage
interface SendMessageAck {
  success: boolean;
  message?: Messages;
  error?: string;
  code?: string;
}

const SEND_ACK_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Query key
//
// Defined here so that every caller — the query hook, the mutation, and the
// socket handler — all reference the same stable key. A mismatch here would
// mean patches go to the wrong cache entry and messages silently disappear.
// ---------------------------------------------------------------------------

export const messagesQueryKey = (conversationId: number) => ["messages", conversationId] as const;

// ---------------------------------------------------------------------------
// Cache patch helpers
//
// Extracted from setQueryData callbacks so each operation reads like a sentence
// instead of a nested arrow function. The shape we're working with:
//
//   InfiniteData<MessagesPage> = {
//     pages: MessagesPage[],      ← pages[0] is the most recent batch
//     pageParams: unknown[]
//   }
// ---------------------------------------------------------------------------

// Appends an incoming message to the end of the most recent page.
// "Most recent" = pages[0], because useInfiniteQuery loads newest first.
function appendIncomingMessageToCache(
  currentCache: InfiniteData<MessagesPage>,
  incomingMessage: DisplayMessage,
): InfiniteData<MessagesPage> {
  const updatedPages = currentCache.pages.map((page, pageIndex) => {
    const isNewestPage = pageIndex === 0;
    if (!isNewestPage) return page;
    return { ...page, messages: [...page.messages, incomingMessage] };
  });
  return { ...currentCache, pages: updatedPages };
}

// Replaces an optimistic message with the server-confirmed version.
// Carries _stableKey from the old temp ID so React keeps the same DOM node
// instead of unmounting and remounting the bubble (which would cause a flash).
function replaceOptimisticMessageWithServerMessage(
  currentCache: InfiniteData<MessagesPage>,
  optimisticMessageId: number,
  serverMessage: Messages,
): InfiniteData<MessagesPage> {
  const updatedPages = currentCache.pages.map((page) => ({
    ...page,
    messages: page.messages.map((existingMessage) => {
      if (existingMessage.id !== optimisticMessageId) return existingMessage;
      // Preserve the stable key so the React list keeps the same DOM node
      return { ...serverMessage, _stableKey: optimisticMessageId };
    }),
  }));
  return { ...currentCache, pages: updatedPages };
}

// Replaces an existing message with an updated version (e.g. after an edit).
// Scans all pages because the edited message could be anywhere in history.
// Also preserves _stableKey if the message was previously reconciled from
// an optimistic state — without this, a server-pushed edit would change the
// React key and cause the DOM node to flash on screen.
function replaceUpdatedMessageAcrossAllPages(
  currentCache: InfiniteData<MessagesPage>,
  updatedMessage: Messages,
): InfiniteData<MessagesPage> {
  const updatedPages = currentCache.pages.map((page) => ({
    ...page,
    messages: page.messages.map((existingMessage) => {
      if (existingMessage.id !== updatedMessage.id) return existingMessage;
      // Carry _stableKey forward so the React list key doesn't change
      const stableKey = existingMessage._stableKey;
      return stableKey !== undefined ? { ...updatedMessage, _stableKey: stableKey } : updatedMessage;
    }),
  }));
  return { ...currentCache, pages: updatedPages };
}

// Removes a deleted message AND nulls out any reply references pointing to it.
//
// Why scan all pages for reply links: a message in page 0 (recent) might reply
// to a message in page 5 (older). The backend doesn't know which messages the
// client has loaded, so this cleanup is the client's responsibility.
function removeMessageAndClearOrphanedReplyLinks(
  currentCache: InfiniteData<MessagesPage>,
  deletedMessageId: number,
): InfiniteData<MessagesPage> {
  const updatedPages = currentCache.pages.map((page) => {
    const messagesWithoutDeleted = page.messages.filter((message) => message.id !== deletedMessageId);
    const messagesWithClearedReplyLinks = messagesWithoutDeleted.map((message) => {
      const pointsToDeletedMessage =
        message.replyToMessageId === deletedMessageId || message.replyTo?.id === deletedMessageId;
      if (!pointsToDeletedMessage) return message;
      return { ...message, replyToMessageId: null, replyTo: null };
    });
    return { ...page, messages: messagesWithClearedReplyLinks };
  });
  return { ...currentCache, pages: updatedPages };
}

// ---------------------------------------------------------------------------
// useMessagesQuery
//
// Fetches messages for a conversation using cursor-based pagination.
// Each "page" is a batch of 10 messages going backwards in time.
// The query key includes conversationId, so switching conversations
// automatically fetches the new one (or serves from cache if already loaded).
// ---------------------------------------------------------------------------

const MESSAGES_PAGE_SIZE = 10;
const MESSAGES_STALE_TIME = 30 * 1000; // 30 seconds

export function useMessagesQuery(conversationId: number | null) {
  return useInfiniteQuery<MessagesPage, Error, InfiniteData<MessagesPage>>({
    queryKey: conversationId ? messagesQueryKey(conversationId) : ["messages", "none"],
    queryFn: ({ pageParam }) =>
      getMessages(conversationId!, pageParam as number | undefined, MESSAGES_PAGE_SIZE),
    initialPageParam: undefined,
    getNextPageParam: (lastFetchedPage) => {
      // Return undefined (not null) to signal "no more pages" to TanStack Query.
      // In v5, null is a valid pageParam and would cause an infinite fetch loop.
      const { hasMore, nextCursor } = lastFetchedPage.meta;
      return hasMore && nextCursor != null ? nextCursor : undefined;
    },
    enabled: conversationId !== null,
    staleTime: MESSAGES_STALE_TIME,
    // Don't refetch on window focus — the socket keeps the cache live,
    // and a refetch would wipe any optimistic messages still in-flight.
    refetchOnWindowFocus: false,
    // refetchOnReconnect is intentionally left at default (true).
    // When the socket drops and reconnects, we may have missed newMessage events
    // during the gap — a refetch is the safest way to catch up.
    // Don't retry failed fetches — if the server is unreachable, retrying
    // just adds latency before the error state is shown to the user.
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// useInsertOptimisticMessageIntoCache
//
// Used by ChatInput during the media flow to manually inject an optimistic
// bubble before the upload begins. Returns a function, not a hook, so it can
// be called imperatively inside an event handler.
//
// Why not do this in onMutate: the media flow inserts the bubble first, then
// uploads the file while showing progress, then calls mutate() with the
// attachment ID. onMutate only runs at the point mutate() is called — too late
// to show the preview during the upload phase.
// ---------------------------------------------------------------------------

export function useInsertOptimisticMessageIntoCache() {
  const queryClient = useQueryClient();

  return function insertOptimisticMessage(
    conversationId: number,
    optimisticMessage: OptimisticMessage,
  ): void {
    queryClient.setQueryData<InfiniteData<MessagesPage>>(messagesQueryKey(conversationId), (currentCache) => {
      if (!currentCache) return currentCache;
      return appendIncomingMessageToCache(currentCache, optimisticMessage);
    });
  };
}

// ---------------------------------------------------------------------------
// useUpdateOptimisticMessageInCache
//
// Used by ChatInput to patch an existing optimistic message mid-flight,
// e.g. updating _progress during upload or marking _status as "failed".
// Limit: this scans all pages then scans all messages.
// This is fine for now. Trade off for simplicity
// ---------------------------------------------------------------------------

export function useUpdateOptimisticMessageInCache() {
  const queryClient = useQueryClient();

  return function updateOptimisticMessage(
    conversationId: number,
    optimisticMessageId: number,
    patch: Partial<Pick<OptimisticMessage, "_status" | "_progress">>,
  ): void {
    queryClient.setQueryData<InfiniteData<MessagesPage>>(messagesQueryKey(conversationId), (currentCache) => {
      if (!currentCache) return currentCache;
      const updatedPages = currentCache.pages.map((page) => ({
        ...page,
        messages: page.messages.map((message) => {
          if (message.id !== optimisticMessageId) return message;
          if (!("_optimistic" in message)) return message;
          return { ...message, ...patch };
        }),
      }));
      return { ...currentCache, pages: updatedPages };
    });
  };
}

// ---------------------------------------------------------------------------
// useRemoveOptimisticMessageFromCache
//
// Used in FailedActions to discard a failed optimistic message.
// Also revokes the blob URL if one was created for a local image preview,
// to prevent a memory leak.
// ---------------------------------------------------------------------------

export function useRemoveOptimisticMessageFromCache() {
  const queryClient = useQueryClient();

  return function removeOptimisticMessage(conversationId: number, optimisticMessageId: number): void {
    // Capture the blob URL before the cache update, because after removal
    // the message object is gone and the URL is no longer accessible.
    const currentCache = queryClient.getQueryData<InfiniteData<MessagesPage>>(
      messagesQueryKey(conversationId),
    );
    const messageToRemove = currentCache?.pages
      .flatMap((page) => page.messages)
      .find((message) => message.id === optimisticMessageId);

    if (
      messageToRemove &&
      "_optimistic" in messageToRemove &&
      messageToRemove._previewUrl?.startsWith("blob:")
    ) {
      // Deferred so the URL is still valid during the current render cycle
      queueMicrotask(() => URL.revokeObjectURL(messageToRemove._previewUrl!));
    }

    queryClient.setQueryData<InfiniteData<MessagesPage>>(messagesQueryKey(conversationId), (currentCache) => {
      if (!currentCache) return currentCache;
      return removeMessageAndClearOrphanedReplyLinks(currentCache, optimisticMessageId);
    });
  };
}

// ---------------------------------------------------------------------------
// useSendMessageMutation
//
// Handles the full optimistic send lifecycle:
//
//   onMutate  → inject optimistic text bubble (text-only flow)
//              or skip injection (media flow, bubble already inserted)
//   [socket emit]
//   onSuccess → replace optimistic with server message + revoke blob URL
//              + patch sender's conversation list sidebar
//   onError   → restore cache from snapshot taken in onMutate
// ---------------------------------------------------------------------------

export function useSendMessageMutation() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sendPayload: SendMessageInput): Promise<Messages> => {
      if (!socket || !socket.connected) {
        throw new Error("Socket is not connected");
      }
      // Guard here (not in onMutate) so that if the user is somehow missing,
      // the mutation fails cleanly and onError can restore the cache snapshot.
      if (!user) {
        throw new Error("Cannot send message: user is not authenticated");
      }

      const socketPayload: Record<string, unknown> = {
        conversationId: sendPayload.conversationId,
      };
      const trimmedContent = sendPayload.content?.trim() || null;
      if (trimmedContent) socketPayload.content = trimmedContent;
      if (sendPayload.attachmentIds?.length) socketPayload.attachmentIds = sendPayload.attachmentIds;
      if (sendPayload.replyToMessageId != null) socketPayload.replyToMessageId = sendPayload.replyToMessageId;

      const ack = await emitWithAckTimeout<SendMessageAck | undefined, SendMessageAck>({
        socket,
        event: "sendMessage",
        payload: socketPayload,
        timeoutMs: SEND_ACK_TIMEOUT_MS,
        timeoutErrorMessage: "Send timed out — no server acknowledgement",
        isSuccess: (value): value is SendMessageAck => Boolean(value?.success && value.message),
        getErrorMessage: (value) => value?.error ?? "Send failed",
      });

      return ack.message!;
    },

    onMutate: async (sendPayload) => {
      const { conversationId, _optimisticId } = sendPayload;

      // Cancel any background refetch so it doesn't overwrite the optimistic bubble
      await queryClient.cancelQueries({ queryKey: messagesQueryKey(conversationId) });

      // Snapshot the cache so we can restore it if the send fails
      const snapshotBeforeMutation = queryClient.getQueryData<InfiniteData<MessagesPage>>(
        messagesQueryKey(conversationId),
      );

      // Media flow: ChatInput already inserted the optimistic bubble before calling
      // mutate (so it could track upload progress). Don't insert a second one.
      if (_optimisticId !== undefined) {
        return { snapshotBeforeMutation, optimisticMessageId: _optimisticId };
      }

      // Text-only flow: build and inject the optimistic bubble now.
      // If user is somehow null at this point (e.g. auth state changed mid-flight),
      // skip injection — the mutation will still fail in mutationFn and onError
      // will restore the snapshot.
      if (!user) {
        return { snapshotBeforeMutation, optimisticMessageId: undefined };
      }

      const optimisticMessageId = -Date.now();
      const trimmedContent = sendPayload.content?.trim() ?? null;
      const hasAttachment = (sendPayload.attachmentIds?.length ?? 0) > 0;

      const optimisticMessage: OptimisticMessage = buildOptimisticTextMessage({
        tempId: optimisticMessageId,
        conversationId,
        trimmedContent,
        messageType: hasAttachment ? "IMAGE" : "TEXT",
        sender: user,
        replyToMessageId: sendPayload.replyToMessageId ?? null,
        replyTo: sendPayload._replyTo ?? null,
      });

      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        messagesQueryKey(conversationId),
        (currentCache) => {
          if (!currentCache) return currentCache;
          return appendIncomingMessageToCache(currentCache, optimisticMessage);
        },
      );

      return { snapshotBeforeMutation, optimisticMessageId };
    },

    onSuccess: (serverMessage, sendPayload, onMutateResult) => {
      const { conversationId } = sendPayload;
      const { optimisticMessageId } = onMutateResult ?? {};

      // Only media messages carry a blob URL for the local preview.
      // Text messages go straight to the server without creating a blob.
      const wasMediaSend = sendPayload._optimisticId !== undefined;

      if (wasMediaSend && optimisticMessageId !== undefined) {
        // Revoke the blob URL now that the server has stored the real image URL.
        // Deferred so the URL is still valid during the current render cycle.
        const currentCache = queryClient.getQueryData<InfiniteData<MessagesPage>>(
          messagesQueryKey(conversationId),
        );
        const optimisticMessageBeforeReplace = currentCache?.pages
          .flatMap((page) => page.messages)
          .find((message) => message.id === optimisticMessageId);

        if (
          optimisticMessageBeforeReplace &&
          "_optimistic" in optimisticMessageBeforeReplace &&
          optimisticMessageBeforeReplace._previewUrl?.startsWith("blob:")
        ) {
          queueMicrotask(() => URL.revokeObjectURL(optimisticMessageBeforeReplace._previewUrl!));
        }
      }

      if (optimisticMessageId !== undefined) {
        queryClient.setQueryData<InfiniteData<MessagesPage>>(
          messagesQueryKey(conversationId),
          (currentCache) => {
            if (!currentCache) {
              // Cache was null when onMutate ran (e.g. query hadn't resolved yet),
              // so the optimistic bubble was never inserted. Seed the cache with
              // the confirmed server message so it isn't silently lost.
              return {
                pages: [{ messages: [serverMessage], meta: { nextCursor: null, hasMore: false } }],
                pageParams: [undefined],
              };
            }
            return replaceOptimisticMessageWithServerMessage(
              currentCache,
              optimisticMessageId,
              serverMessage,
            );
          },
        );
      }

      // Patch the sender's conversation list sidebar.
      // The backend emits "newMessage" to everyone in the room except the sender,
      // so the sender's sidebar won't update automatically — we do it manually here.
      if (!user) return;
      const senderUserId = user.id;
      queryClient.setQueryData<ConversationsResponse[]>(
        conversationsQueryKey(senderUserId),
        (currentConversationList) => {
          if (!currentConversationList) return currentConversationList;
          const patchedList = applyNewMessageToConversationList(currentConversationList, serverMessage);
          // If the conversation wasn't in the cache (e.g. a brand-new one),
          // invalidate so the list re-fetches and picks it up.
          if (patchedList === currentConversationList) {
            void queryClient.invalidateQueries({
              queryKey: conversationsQueryKey(senderUserId),
            });
          }
          return patchedList;
        },
      );
    },

    onError: (_error, sendPayload, onMutateResult) => {
      // Restore the cache to the pre-mutation snapshot.
      //
      // Text flow: the snapshot was taken before the optimistic bubble was inserted,
      // so restoring it removes the bubble entirely.
      //
      // Media flow: the bubble was inserted before mutate() was called (for progress
      // tracking), so the snapshot already contains it. Restoring keeps the bubble
      // in "sending" state — ChatInput's error handler is responsible for calling
      // useUpdateOptimisticMessageInCache to mark it "failed".
      const { snapshotBeforeMutation } = onMutateResult ?? {};
      if (snapshotBeforeMutation !== undefined) {
        queryClient.setQueryData(messagesQueryKey(sendPayload.conversationId), snapshotBeforeMutation);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Cache patch functions for external use
//
// Exported so useMessageSockets can patch the cache when socket events arrive,
// without duplicating the patch logic or importing the whole mutation hook.
// ---------------------------------------------------------------------------

export {
  appendIncomingMessageToCache,
  replaceUpdatedMessageAcrossAllPages,
  removeMessageAndClearOrphanedReplyLinks,
};

// Also export the MessagesPage type so useMessageSockets can type its cache patches
export type { MessagesPage };
