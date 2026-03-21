import { act, cleanup, render } from "@testing-library/react";
import { type InfiniteData, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DisplayMessage } from "@/types/chat.type";
import { messagesQueryKey, type MessagesPage } from "@/features/chat/hooks/messages";
import { useMessageSockets } from "@/features/chat/hooks/useMessageSockets";

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

function makeMessage(overrides: Partial<DisplayMessage> & { id: number; conversationId: number }): DisplayMessage {
  const base: DisplayMessage = {
    id: 0,
    conversationId: 0,
    senderId: 1,
    content: "old",
    messageType: "TEXT",
    createdAt: "2026-02-27T09:00:00.000Z",
    editedAt: null,
    sender: { id: 1, username: "alice", avatar: null },
    attachments: [],
  };

  return { ...base, ...overrides } as DisplayMessage;
}

function makeMessagesCache(...pages: DisplayMessage[][]): InfiniteData<MessagesPage> {
  return {
    pages: pages.map((messages) => ({
      messages,
      meta: { nextCursor: null, hasMore: false },
    })),
    pageParams: pages.map(() => undefined),
  };
}

function Harness() {
  useMessageSockets();
  return null;
}

function mountHarness(queryClient: QueryClient) {
  render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  mockSocket.handlers.clear();
  mockSocket.on.mockClear();
  mockSocket.off.mockClear();
});

describe("useMessageSockets", () => {
  it("patches query cache on messageUpdated and preserves _stableKey", async () => {
    const queryClient = new QueryClient();
    const original = Object.assign(makeMessage({ id: 10, conversationId: 1 }), {
      _stableKey: -10,
    }) as DisplayMessage & { _stableKey: number };

    queryClient.setQueryData(messagesQueryKey(1), makeMessagesCache([original]));

    mountHarness(queryClient);
    await act(async () => {});

    const updated = makeMessage({
      id: 10,
      conversationId: 1,
      content: "new",
      editedAt: "2026-02-27T09:10:00.000Z",
    });

    act(() => {
      mockSocket.trigger("messageUpdated", updated);
    });

    const latest = queryClient.getQueryData<InfiniteData<MessagesPage>>(messagesQueryKey(1));
    expect(latest?.pages[0].messages[0].content).toBe("new");
    expect((latest?.pages[0].messages[0] as DisplayMessage & { _stableKey?: number })._stableKey).toBe(-10);
  });

  it("removes deleted messages and clears reply links across loaded pages", async () => {
    const queryClient = new QueryClient();

    queryClient.setQueryData(
      messagesQueryKey(1),
      makeMessagesCache(
        [
          makeMessage({
            id: 11,
            conversationId: 1,
            content: "reply",
            replyToMessageId: 10,
            replyTo: {
              id: 10,
              content: "target",
              messageType: "TEXT",
              sender: { id: 1, username: "alice", avatar: null },
            },
          }),
        ],
        [makeMessage({ id: 10, conversationId: 1, content: "target" })],
      ),
    );

    mountHarness(queryClient);
    await act(async () => {});

    act(() => {
      mockSocket.trigger("messageDeleted", { conversationId: 1, messageId: 10 });
    });

    const latest = queryClient.getQueryData<InfiniteData<MessagesPage>>(messagesQueryKey(1));
    expect(latest?.pages[0].messages.map((message) => message.id)).toEqual([11]);
    expect(latest?.pages[0].messages[0].replyToMessageId).toBeNull();
    expect(latest?.pages[0].messages[0].replyTo).toBeNull();
    expect(latest?.pages[1].messages).toEqual([]);
  });

  it("does not create an empty cache entry when messageDeleted arrives for an unloaded conversation", async () => {
    const queryClient = new QueryClient();
    const initialCache = makeMessagesCache([makeMessage({ id: 10, conversationId: 1 })]);

    queryClient.setQueryData(messagesQueryKey(1), initialCache);

    mountHarness(queryClient);
    await act(async () => {});

    act(() => {
      mockSocket.trigger("messageDeleted", { conversationId: 99, messageId: 10 });
    });

    expect(queryClient.getQueryData(messagesQueryKey(99))).toBeUndefined();
    expect(queryClient.getQueryData(messagesQueryKey(1))).toBe(initialCache);
  });
});
