import { act, cleanup, render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConversationsResponse, Messages, PinnedMessageItem, User } from "@/types/chat.type";
import { queryClient } from "@/lib/queryClient";
import { conversationPinsQueryKey } from "@/hooks/queries/pins";
import { conversationsQueryKey } from "@/hooks/queries/conversations";
import { useConversationSockets } from "@/hooks/sockets/useConversationSockets";

// --- Mock useSocket and useAuth so hook can self-provision socket/userId ---

class MockSocket {
  handlers = new Map<string, (...args: unknown[]) => void>();
  on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    this.handlers.set(event, handler);
  });
  off = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    const existing = this.handlers.get(event);
    if (existing === handler) {
      this.handlers.delete(event);
    }
  });
  trigger(event: string, ...args: unknown[]) {
    const handler = this.handlers.get(event);
    handler?.(...args);
  }
}

const mockSocket = new MockSocket();

vi.mock("@/hooks/context/useSocket", () => ({
  default: () => ({
    socket: mockSocket,
    isConnected: true,
    presenceByUserId: new Map(),
    error: null,
  }),
}));

vi.mock("@/features/auth/providers/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "alice", avatar: null } }),
}));

// ---------------------------------------------------------------------------

const ALICE: User = { id: 1, username: "alice", avatar: null };
const BOB: User = { id: 2, username: "bob", avatar: null };

function makeConversation(overrides: Partial<ConversationsResponse> & { id: number }): ConversationsResponse {
  const { id, ...rest } = overrides;
  return {
    id,
    title: null,
    type: "PRIVATE",
    otherUser: BOB,
    pinSummary: null,
    lastMessage: null,
    ...rest,
  };
}

function makePinnedItem(overrides: Partial<PinnedMessageItem> & { messageId: number }): PinnedMessageItem {
  const { messageId, ...rest } = overrides;
  return {
    messageId,
    conversationId: 1,
    pinnedAt: "2026-03-10T08:00:00.000Z",
    pinnedBy: ALICE,
    message: {
      id: messageId,
      content: `message-${messageId}`,
      previewText: `message-${messageId}`,
      messageType: "TEXT",
      createdAt: "2026-03-10T07:00:00.000Z",
      sender: ALICE,
      attachments: [],
    },
    ...rest,
  };
}

function makeMessage(overrides: Partial<Messages> & { id: number; conversationId: number }): Messages {
  const { id, conversationId, ...rest } = overrides;
  return {
    id,
    conversationId,
    senderId: 1,
    content: "old",
    messageType: "TEXT",
    createdAt: "2026-03-10T07:00:00.000Z",
    editedAt: null,
    sender: ALICE,
    attachments: [],
    ...rest,
  };
}

function mountConversationHook(initialConversations: ConversationsResponse[]) {
  queryClient.setQueryData(conversationsQueryKey(1), initialConversations);

  function Harness() {
    const [, setTypingByConversation] = useState(new Map<number, Map<number, string>>());
    const [, setSystemMessages] = useState(new Map<number, string>());

    useConversationSockets({
      setTypingByConversation,
      setSystemMessages,
      clearActiveConversation: vi.fn(),
    });

    return null;
  }

  render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );

  return {
    getConversations: () =>
      queryClient.getQueryData<ConversationsResponse[]>(conversationsQueryKey(1)) ?? [],
  };
}

afterEach(() => {
  queryClient.clear();
  cleanup();
  mockSocket.handlers.clear();
  mockSocket.on.mockClear();
  mockSocket.off.mockClear();
});

describe("useConversationSockets pin sync", () => {
  it("updates conversation pinSummary and loaded pins cache on messagePinned", async () => {
    const initial = [
      makeConversation({ id: 1 }),
      makeConversation({ id: 2 }),
    ];
    const { getConversations } = mountConversationHook(initial);
    queryClient.setQueryData(conversationPinsQueryKey(1), []);

    await act(async () => {});

    const pinnedItem = makePinnedItem({
      messageId: 41,
      pinnedAt: "2026-03-10T09:00:00.000Z",
    });

    act(() => {
      mockSocket.trigger("messagePinned", {
        conversationId: 1,
        pinnedCount: 1,
        latestPinnedMessage: {
          id: 41,
          previewText: "Pinned preview",
          messageType: "TEXT",
          pinnedAt: "2026-03-10T09:00:00.000Z",
        },
        pinnedItem,
      });
    });

    const latest = getConversations();
    expect(latest.map((conversation) => conversation.id)).toEqual([1, 2]);
    expect(latest[0].pinSummary?.pinnedCount).toBe(1);
    expect(latest[0].pinSummary?.latestPinnedMessage?.id).toBe(41);

    const cachedPins = queryClient.getQueryData<PinnedMessageItem[]>(conversationPinsQueryKey(1));
    expect(cachedPins).toHaveLength(1);
    expect(cachedPins?.[0]?.messageId).toBe(41);
  });

  it("updates conversation pinSummary and removes cache item on messageUnpinned", async () => {
    const initial = [
      makeConversation({
        id: 1,
        pinSummary: {
          pinnedCount: 2,
          latestPinnedMessage: {
            id: 51,
            previewText: "latest",
            messageType: "TEXT",
            pinnedAt: "2026-03-10T09:00:00.000Z",
          },
        },
      }),
    ];
    const { getConversations } = mountConversationHook(initial);
    queryClient.setQueryData(conversationPinsQueryKey(1), [
      makePinnedItem({ messageId: 51, pinnedAt: "2026-03-10T09:00:00.000Z" }),
      makePinnedItem({ messageId: 50, pinnedAt: "2026-03-10T08:00:00.000Z" }),
    ]);

    await act(async () => {});

    act(() => {
      mockSocket.trigger("messageUnpinned", {
        conversationId: 1,
        messageId: 51,
        pinnedCount: 1,
        latestPinnedMessage: {
          id: 50,
          previewText: "older",
          messageType: "TEXT",
          pinnedAt: "2026-03-10T08:00:00.000Z",
        },
      });
    });

    const latest = getConversations();
    expect(latest[0].pinSummary?.pinnedCount).toBe(1);
    expect(latest[0].pinSummary?.latestPinnedMessage?.id).toBe(50);

    const cachedPins = queryClient.getQueryData<PinnedMessageItem[]>(conversationPinsQueryKey(1));
    expect(cachedPins).toHaveLength(1);
    expect(cachedPins?.[0]?.messageId).toBe(50);
  });

  it("patches pinSummary and removes deleted pin cache entry on messageDeleted", async () => {
    const initial = [
      makeConversation({
        id: 1,
        pinSummary: {
          pinnedCount: 2,
          latestPinnedMessage: {
            id: 61,
            previewText: "latest",
            messageType: "TEXT",
            pinnedAt: "2026-03-10T09:00:00.000Z",
          },
        },
      }),
    ];
    const { getConversations } = mountConversationHook(initial);
    queryClient.setQueryData(conversationPinsQueryKey(1), [
      makePinnedItem({ messageId: 61, pinnedAt: "2026-03-10T09:00:00.000Z" }),
      makePinnedItem({ messageId: 60, pinnedAt: "2026-03-10T08:00:00.000Z" }),
    ]);

    await act(async () => {});

    act(() => {
      mockSocket.trigger("messageDeleted", {
        conversationId: 1,
        messageId: 61,
        pinSummary: {
          pinnedCount: 1,
          latestPinnedMessage: {
            id: 60,
            previewText: "older",
            messageType: "TEXT",
            pinnedAt: "2026-03-10T08:00:00.000Z",
          },
        },
      });
    });

    const latest = getConversations();
    expect(latest[0].pinSummary?.pinnedCount).toBe(1);
    expect(latest[0].pinSummary?.latestPinnedMessage?.id).toBe(60);

    const cachedPins = queryClient.getQueryData<PinnedMessageItem[]>(conversationPinsQueryKey(1));
    expect(cachedPins).toHaveLength(1);
    expect(cachedPins?.[0]?.messageId).toBe(60);
  });

  it("updates newest pinned preview and panel item when that message is edited", async () => {
    const initial = [
      makeConversation({
        id: 1,
        pinSummary: {
          pinnedCount: 1,
          latestPinnedMessage: {
            id: 70,
            previewText: "before edit",
            messageType: "TEXT",
            pinnedAt: "2026-03-10T09:00:00.000Z",
          },
        },
      }),
    ];
    const { getConversations } = mountConversationHook(initial);
    queryClient.setQueryData(conversationPinsQueryKey(1), [
      makePinnedItem({
        messageId: 70,
        message: {
          id: 70,
          content: "before edit",
          previewText: "before edit",
          messageType: "TEXT",
          createdAt: "2026-03-10T07:00:00.000Z",
          sender: ALICE,
          attachments: [],
        },
      }),
    ]);

    await act(async () => {});

    act(() => {
      mockSocket.trigger(
        "messageUpdated",
        makeMessage({
          id: 70,
          conversationId: 1,
          content: "after edit",
        }),
      );
    });

    const latest = getConversations();
    expect(latest[0].pinSummary?.latestPinnedMessage?.previewText).toBe("after edit");

    const cachedPins = queryClient.getQueryData<PinnedMessageItem[]>(conversationPinsQueryKey(1));
    expect(cachedPins?.[0]?.message.content).toBe("after edit");
  });
});
