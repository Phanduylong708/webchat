import { act, cleanup, render } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConversationsResponse, Messages, PinnedMessageItem, User } from "@/types/chat.type";
import { queryClient } from "@/lib/queryClient";
import { conversationPinsQueryKey } from "@/hooks/queries/pins";
import { useConversationSockets } from "@/hooks/sockets/useConversationSockets";

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
  const socket = new MockSocket();
  let latestConversations = initialConversations;

  function Harness() {
    const [conversations, setConversations] = useState(initialConversations);
    const [, setTypingByConversation] = useState(new Map());
    const [, setSystemMessages] = useState(new Map());
    const [, setActiveConversationId] = useState<number | null>(null);

    useConversationSockets({
      socket: socket as unknown as never,
      currentUserId: 1,
      setConversations,
      setTypingByConversation,
      setSystemMessages,
      setActiveConversationId,
    });

    useEffect(() => {
      latestConversations = conversations;
    }, [conversations]);

    return null;
  }

  render(<Harness />);
  return {
    socket,
    getConversations: () => latestConversations,
  };
}

afterEach(() => {
  queryClient.clear();
  cleanup();
});

describe("useConversationSockets pin sync", () => {
  it("updates conversation pinSummary and loaded pins cache on messagePinned", async () => {
    const initial = [
      makeConversation({ id: 1 }),
      makeConversation({ id: 2 }),
    ];
    const { socket, getConversations } = mountConversationHook(initial);
    queryClient.setQueryData(conversationPinsQueryKey(1), []);

    await act(async () => {});

    const pinnedItem = makePinnedItem({
      messageId: 41,
      pinnedAt: "2026-03-10T09:00:00.000Z",
    });

    act(() => {
      socket.trigger("messagePinned", {
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
    const { socket, getConversations } = mountConversationHook(initial);
    queryClient.setQueryData(conversationPinsQueryKey(1), [
      makePinnedItem({ messageId: 51, pinnedAt: "2026-03-10T09:00:00.000Z" }),
      makePinnedItem({ messageId: 50, pinnedAt: "2026-03-10T08:00:00.000Z" }),
    ]);

    await act(async () => {});

    act(() => {
      socket.trigger("messageUnpinned", {
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
    const { socket, getConversations } = mountConversationHook(initial);
    queryClient.setQueryData(conversationPinsQueryKey(1), [
      makePinnedItem({ messageId: 61, pinnedAt: "2026-03-10T09:00:00.000Z" }),
      makePinnedItem({ messageId: 60, pinnedAt: "2026-03-10T08:00:00.000Z" }),
    ]);

    await act(async () => {});

    act(() => {
      socket.trigger("messageDeleted", {
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
    const { socket, getConversations } = mountConversationHook(initial);
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
      socket.trigger(
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
