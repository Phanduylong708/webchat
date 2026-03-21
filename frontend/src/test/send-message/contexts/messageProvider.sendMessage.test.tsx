/**
 * Tests for the sender-side conversation cache patch in useSendMessageMutation.
 *
 * Receivers get the preview update via the "newMessage" socket broadcast.
 * The sender is excluded from that broadcast (socket.to(room)), so the mutation
 * patches the cache manually after the server ack arrives.
 */

import { act, cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConversationsResponse, Messages, SendMessageInput } from "@/types/chat.type";
import { conversationsQueryKey } from "@/hooks/queries/conversations";
import { useSendMessageMutation } from "@/hooks/queries/messages";

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

const mockEmitWithAckTimeout = vi.fn();
vi.mock("@/utils/socketAck.util", () => ({
  emitWithAckTimeout: (...args: unknown[]) => mockEmitWithAckTimeout(...args),
}));

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

let capturedMutateAsync: ((payload: SendMessageInput) => Promise<Messages>) | null = null;

function Probe() {
  const { mutateAsync } = useSendMessageMutation();
  capturedMutateAsync = mutateAsync;
  return null;
}

function mountHarness(queryClient: QueryClient) {
  render(
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  capturedMutateAsync = null;
  mockEmitWithAckTimeout.mockReset();
  mockSocketObj.emit.mockReset();
  mockSocketObj.on.mockReset();
  mockSocketObj.off.mockReset();
});

describe("useSendMessageMutation — sender-side conversation cache patch", () => {
  it("updates lastMessage preview and reorders conversations after sender ack", async () => {
    const queryClient = new QueryClient();

    queryClient.setQueryData(conversationsQueryKey(1), [
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
    ]);

    const serverMessage = makeServerMessage({
      id: 11,
      conversationId: 1,
      content: "hello",
      createdAt: "2026-03-13T10:00:00.000Z",
    });

    mockEmitWithAckTimeout.mockResolvedValueOnce({
      success: true,
      message: serverMessage,
    });

    mountHarness(queryClient);
    await act(async () => {});

    await act(async () => {
      await capturedMutateAsync!({ conversationId: 1, content: "hello" });
    });

    const latest =
      queryClient.getQueryData<ConversationsResponse[]>(conversationsQueryKey(1)) ?? [];

    expect(latest[0].id).toBe(1);
    expect(latest[0].lastMessage?.id).toBe(11);
    expect(latest[0].lastMessage?.content).toBe("hello");
    expect(latest[0].lastMessage?.previewText).toBe("hello");
    expect(latest[0].lastMessage?.createdAt).toBe("2026-03-13T10:00:00.000Z");
    expect(latest[1].id).toBe(2);
  });

  it("invalidates conversations query when ack message's conversation is not in cache", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(conversationsQueryKey(1), [makeConversation({ id: 99 })]);

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const serverMessage = makeServerMessage({ id: 1, conversationId: 42 });

    mockEmitWithAckTimeout.mockResolvedValueOnce({
      success: true,
      message: serverMessage,
    });

    mountHarness(queryClient);
    await act(async () => {});

    await act(async () => {
      await capturedMutateAsync!({ conversationId: 42, content: "hello" });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: conversationsQueryKey(1) }),
      );
    });

    invalidateSpy.mockRestore();
  });

  it("uses previewText 'image' for IMAGE messages with no text content", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(conversationsQueryKey(1), [makeConversation({ id: 1 })]);

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

    mountHarness(queryClient);
    await act(async () => {});

    await act(async () => {
      await capturedMutateAsync!({ conversationId: 1, content: undefined, attachmentIds: [7] });
    });

    const latest =
      queryClient.getQueryData<ConversationsResponse[]>(conversationsQueryKey(1)) ?? [];

    expect(latest[0].lastMessage?.previewText).toBe("image");
    expect(latest[0].lastMessage?.messageType).toBe("IMAGE");
  });
});
