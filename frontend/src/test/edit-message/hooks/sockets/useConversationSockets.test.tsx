import { act, cleanup, render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConversationsResponse, DisplayMessage } from "@/types/chat.type";
import { queryClient } from "@/lib/queryClient";
import { conversationsQueryKey } from "@/hooks/queries/conversations";
import { useConversationSockets } from "../../../../hooks/sockets/useConversationSockets";

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

function makeConversation(overrides: Partial<ConversationsResponse> & { id: number }): ConversationsResponse {
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

afterEach(() => {
  queryClient.clear();
  cleanup();
  mockSocket.handlers.clear();
  mockSocket.on.mockClear();
  mockSocket.off.mockClear();
});

function getConversations() {
  return queryClient.getQueryData<ConversationsResponse[]>(conversationsQueryKey(1)) ?? [];
}

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

function mountHarness() {
  render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe("useConversationSockets", () => {
  it("updates sidebar lastMessage preview on messageUpdated without reordering", async () => {
    const initial: ConversationsResponse[] = [
      {
        id: 1,
        title: null,
        type: "PRIVATE",
        otherUser: { id: 2, username: "bob", avatar: null },
        lastMessage: {
          id: 10,
          content: "old",
          messageType: "TEXT",
          previewText: "old",
          createdAt: "2026-02-27T09:00:00.000Z",
          sender: { id: 1, username: "alice", avatar: null },
          attachments: [],
        },
      },
      {
        id: 2,
        title: null,
        type: "PRIVATE",
        otherUser: { id: 3, username: "carol", avatar: null },
        lastMessage: {
          id: 20,
          content: "zzz",
          messageType: "TEXT",
          previewText: "zzz",
          createdAt: "2026-02-27T09:05:00.000Z",
          sender: { id: 3, username: "carol", avatar: null },
          attachments: [],
        },
      },
    ];

    queryClient.setQueryData(conversationsQueryKey(1), initial);
    mountHarness();
    await act(async () => {});

    expect(mockSocket.on).toHaveBeenCalledWith("messageUpdated", expect.any(Function));

    const updated = makeMessage({
      id: 10,
      conversationId: 1,
      content: "new",
      editedAt: "2026-02-27T09:10:00.000Z",
    });

    act(() => {
      mockSocket.trigger("messageUpdated", updated);
    });

    const latest = getConversations();
    expect(latest.map((c) => c.id)).toEqual([1, 2]);
    expect(latest[0].lastMessage?.content).toBe("new");
    expect(latest[0].lastMessage?.previewText).toBe("new");
  });

  it("backfills sidebar preview on messageDeleted without reordering conversations", async () => {
    const initial: ConversationsResponse[] = [
      makeConversation({
        id: 1,
        lastMessage: {
          id: 10,
          content: "preview",
          messageType: "TEXT",
          previewText: "preview",
          createdAt: "2026-02-27T09:10:00.000Z",
          sender: { id: 1, username: "alice", avatar: null },
          attachments: [],
        },
      }),
      makeConversation({
        id: 2,
        lastMessage: {
          id: 20,
          content: "later",
          messageType: "TEXT",
          previewText: "later",
          createdAt: "2026-02-27T09:15:00.000Z",
          sender: { id: 2, username: "bob", avatar: null },
          attachments: [],
        },
      }),
    ];

    queryClient.setQueryData(conversationsQueryKey(1), initial);
    mountHarness();
    await act(async () => {});

    act(() => {
      mockSocket.trigger("messageDeleted", {
        conversationId: 1,
        messageId: 10,
        nextLastMessage: makeMessage({
          id: 9,
          conversationId: 1,
          content: "older",
          createdAt: "2026-02-27T09:05:00.000Z",
        }),
      });
    });

    const latest = getConversations();
    expect(latest.map((conversation) => conversation.id)).toEqual([1, 2]);
    expect(latest[0].lastMessage?.id).toBe(9);
    expect(latest[0].lastMessage?.previewText).toBe("older");
    expect(latest[1].lastMessage?.id).toBe(20);
  });

  it("sets lastMessage to null when deleting the final preview message", async () => {
    const initial: ConversationsResponse[] = [
      makeConversation({
        id: 1,
        lastMessage: {
          id: 10,
          content: "preview",
          messageType: "TEXT",
          previewText: "preview",
          createdAt: "2026-02-27T09:10:00.000Z",
          sender: { id: 1, username: "alice", avatar: null },
          attachments: [],
        },
      }),
    ];

    queryClient.setQueryData(conversationsQueryKey(1), initial);
    mountHarness();
    await act(async () => {});

    act(() => {
      mockSocket.trigger("messageDeleted", {
        conversationId: 1,
        messageId: 10,
        nextLastMessage: null,
      });
    });

    expect(getConversations()[0].lastMessage).toBeNull();
  });

  it("ignores messageDeleted when the deleted message is not the current preview", async () => {
    const initial: ConversationsResponse[] = [
      makeConversation({
        id: 1,
        lastMessage: {
          id: 10,
          content: "preview",
          messageType: "TEXT",
          previewText: "preview",
          createdAt: "2026-02-27T09:10:00.000Z",
          sender: { id: 1, username: "alice", avatar: null },
          attachments: [],
        },
      }),
    ];

    queryClient.setQueryData(conversationsQueryKey(1), initial);
    mountHarness();
    await act(async () => {});

    act(() => {
      mockSocket.trigger("messageDeleted", {
        conversationId: 1,
        messageId: 999,
        nextLastMessage: makeMessage({
          id: 9,
          conversationId: 1,
          content: "older",
        }),
      });
    });

    const latest = getConversations();
    expect(latest[0].lastMessage?.id).toBe(10);
  });
});
