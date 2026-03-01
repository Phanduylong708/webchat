import { act, cleanup, render } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConversationsResponse, DisplayMessage } from "@/types/chat.type";
import { useConversationSockets } from "../../../../hooks/sockets/useConversationSockets";

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

afterEach(() => cleanup());

describe("useConversationSockets", () => {
  it("updates sidebar lastMessage preview on messageUpdated without reordering", async () => {
    const socket = new MockSocket();

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

    let latest = initial;

    function Harness() {
      const [conversations, setConversations] = useState(initial);
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
        latest = conversations;
      }, [conversations]);

      return null;
    }

    render(<Harness />);
    await act(async () => {});

    expect(socket.on).toHaveBeenCalledWith("messageUpdated", expect.any(Function));

    const updated = makeMessage({
      id: 10,
      conversationId: 1,
      content: "new",
      editedAt: "2026-02-27T09:10:00.000Z",
    });

    act(() => {
      socket.trigger("messageUpdated", updated);
    });

    expect(latest.map((c) => c.id)).toEqual([1, 2]);
    expect(latest[0].lastMessage?.content).toBe("new");
    expect(latest[0].lastMessage?.previewText).toBe("new");
  });
});
