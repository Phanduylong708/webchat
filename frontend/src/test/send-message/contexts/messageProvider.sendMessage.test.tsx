/**
 * Tests for the sender-side conversation cache patch in MessageProvider.sendMessage.
 *
 * Receivers get the preview update via the "newMessage" socket broadcast.
 * The sender is excluded from that broadcast (socket.to(room)), so the fix
 * patches the cache manually after the server ack arrives. These tests lock
 * that path against regression.
 */

import { act, cleanup, render, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConversationsResponse, Messages } from "@/types/chat.type";
import { queryClient } from "@/lib/queryClient";
import { conversationsQueryKey } from "@/hooks/queries/conversations";
import { MessageProvider } from "../../../contexts/messageProvider";
import { useMessage } from "../../../hooks/context/useMessage";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockSocketObj = {
  connected: true,
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock("@/hooks/context/useSocket", () => ({
  default: () => ({
    socket: mockSocketObj,
    isConnected: true,
    presenceByUserId: new Map(),
    error: null,
  }),
}));

vi.mock("@/hooks/context/useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, username: "alice", avatar: null },
  }),
}));

// Prevent real socket listener setup in useMessageSockets.
vi.mock("@/hooks/sockets/useMessageSockets", () => ({
  useMessageSockets: () => undefined,
}));

// Intercept emitWithAckTimeout so tests control what the server "acks" back.
const mockEmitWithAckTimeout = vi.fn();
vi.mock("@/utils/socketAck.util", () => ({
  emitWithAckTimeout: (...args: unknown[]) => mockEmitWithAckTimeout(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConversation(
  overrides: Partial<ConversationsResponse> & { id: number },
): ConversationsResponse {
  const { id, ...rest } = overrides;
  return {
    id,
    title: null,
    type: "PRIVATE",
    otherUser: { id: id + 100, username: `user-${id}`, avatar: null },
    lastMessage: null,
    ...rest,
  };
}

function makeServerMessage(overrides: Partial<Messages> & { id: number; conversationId: number }): Messages {
  return {
    senderId: 1,
    content: "hello",
    messageType: "TEXT",
    createdAt: "2026-03-13T10:00:00.000Z",
    editedAt: null,
    sender: { id: 1, username: "alice", avatar: null },
    attachments: [],
    ...overrides,
  };
}

function getConversations(): ConversationsResponse[] {
  return queryClient.getQueryData<ConversationsResponse[]>(conversationsQueryKey(1)) ?? [];
}

// A child component that exposes sendMessage so tests can call it.
let capturedSendMessage: ((payload: import("@/types/chat.type").SendMessageInput) => Promise<void>) | null = null;

function Probe() {
  const { sendMessage } = useMessage();
  capturedSendMessage = sendMessage;
  return null;
}

function mountProvider() {
  render(
    <QueryClientProvider client={queryClient}>
      <MessageProvider>
        <Probe />
      </MessageProvider>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  queryClient.clear();
  cleanup();
  capturedSendMessage = null;
  mockEmitWithAckTimeout.mockReset();
  mockSocketObj.emit.mockReset();
  mockSocketObj.on.mockReset();
  mockSocketObj.off.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MessageProvider.sendMessage — sender-side conversation cache patch", () => {
  it("updates lastMessage preview and reorders conversations after sender ack", async () => {
    // Conversation 1: older last message → will receive new message from sender.
    // Conversation 2: newer last message → should float to top only if it's the most recent.
    const initial: ConversationsResponse[] = [
      makeConversation({
        id: 2,
        lastMessage: {
          id: 20,
          content: "newer",
          messageType: "TEXT",
          previewText: "newer",
          createdAt: "2026-03-13T09:05:00.000Z",
          sender: { id: 2, username: "bob", avatar: null },
          attachments: [],
        },
      }),
      makeConversation({
        id: 1,
        lastMessage: {
          id: 10,
          content: "old",
          messageType: "TEXT",
          previewText: "old",
          createdAt: "2026-03-13T09:00:00.000Z",
          sender: { id: 2, username: "bob", avatar: null },
          attachments: [],
        },
      }),
    ];
    queryClient.setQueryData(conversationsQueryKey(1), initial);

    const serverMessage = makeServerMessage({
      id: 11,
      conversationId: 1,
      content: "hello",
      // Timestamp newer than both existing messages → conversation 1 should float to top.
      createdAt: "2026-03-13T10:00:00.000Z",
    });

    mockEmitWithAckTimeout.mockResolvedValueOnce({
      success: true,
      message: serverMessage,
    });

    mountProvider();
    await act(async () => {});

    await act(async () => {
      await capturedSendMessage!({ conversationId: 1, content: "hello" });
    });

    const latest = getConversations();

    // Conversation 1 should now be first (most recent message).
    expect(latest[0].id).toBe(1);
    expect(latest[0].lastMessage?.id).toBe(11);
    expect(latest[0].lastMessage?.content).toBe("hello");
    expect(latest[0].lastMessage?.previewText).toBe("hello");
    expect(latest[0].lastMessage?.createdAt).toBe("2026-03-13T10:00:00.000Z");

    // Conversation 2 stays second.
    expect(latest[1].id).toBe(2);
  });

  it("invalidates conversations query when ack message's conversation is not in cache", async () => {
    // Seed cache with a different conversation — not the one being sent to.
    const initial: ConversationsResponse[] = [
      makeConversation({ id: 99 }),
    ];
    queryClient.setQueryData(conversationsQueryKey(1), initial);

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const serverMessage = makeServerMessage({
      id: 1,
      // conversationId 42 is NOT in cache.
      conversationId: 42,
    });

    mockEmitWithAckTimeout.mockResolvedValueOnce({
      success: true,
      message: serverMessage,
    });

    mountProvider();
    await act(async () => {});

    await act(async () => {
      await capturedSendMessage!({ conversationId: 42, content: "hello" });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: conversationsQueryKey(1) }),
      );
    });

    invalidateSpy.mockRestore();
  });

  it("uses previewText 'image' for IMAGE messages with no text content", async () => {
    const initial: ConversationsResponse[] = [
      makeConversation({ id: 1 }),
    ];
    queryClient.setQueryData(conversationsQueryKey(1), initial);

    const serverMessage = makeServerMessage({
      id: 5,
      conversationId: 1,
      content: null,
      messageType: "IMAGE",
      createdAt: "2026-03-13T10:00:00.000Z",
    });

    mockEmitWithAckTimeout.mockResolvedValueOnce({
      success: true,
      message: serverMessage,
    });

    mountProvider();
    await act(async () => {});

    await act(async () => {
      await capturedSendMessage!({ conversationId: 1, content: undefined, attachmentIds: [7] });
    });

    const latest = getConversations();
    expect(latest[0].lastMessage?.previewText).toBe("image");
    expect(latest[0].lastMessage?.messageType).toBe("IMAGE");
  });
});
