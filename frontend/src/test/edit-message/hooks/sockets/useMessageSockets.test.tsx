import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

import type { DisplayMessage } from "@/types/chat.type";
import { useMessageSockets } from "../../../../hooks/sockets/useMessageSockets";

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

describe("useMessageSockets", () => {
  it("patches cache on messageUpdated", async () => {
    const socket = new MockSocket();

    const original = Object.assign(makeMessage({ id: 10, conversationId: 1 }), {
      _stableKey: "temp-1",
    }) as DisplayMessage & { _stableKey: string };

    const initial = new Map<number, DisplayMessage[]>([[1, [original]]]);
    let latest = initial;

    function Harness() {
      const [state, setState] = useState(initial);
      useMessageSockets({ socket: socket as unknown as never, setMessagesByConversation: setState });
      useEffect(() => {
        latest = state;
      }, [state]);
      return null;
    }

    render(<Harness />);
    await act(async () => {});

    expect(socket.on).toHaveBeenCalledWith("newMessage", expect.any(Function));
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

    expect(latest.get(1)?.[0].content).toBe("new");
    expect((latest.get(1)?.[0] as unknown as { _stableKey?: string })._stableKey).toBe("temp-1");
  });

  it("removes deleted messages and clears reply links on messageDeleted", async () => {
    const socket = new MockSocket();

    const initial = new Map<number, DisplayMessage[]>([
      [
        1,
        [
          makeMessage({ id: 10, conversationId: 1, content: "target" }),
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
      ],
    ]);

    let latest = initial;

    function Harness() {
      const [state, setState] = useState(initial);
      useMessageSockets({ socket: socket as unknown as never, setMessagesByConversation: setState });
      useEffect(() => {
        latest = state;
      }, [state]);
      return null;
    }

    render(<Harness />);
    await act(async () => {});

    act(() => {
      socket.trigger("messageDeleted", { conversationId: 1, messageId: 10 });
    });

    expect((latest.get(1) ?? []).map((message) => message.id)).toEqual([11]);
    expect(latest.get(1)?.[0].replyToMessageId).toBeNull();
    expect(latest.get(1)?.[0].replyTo).toBeNull();
  });

  it("does not create an empty cache entry when messageDeleted arrives for an unloaded conversation", async () => {
    const socket = new MockSocket();
    const initial = new Map<number, DisplayMessage[]>([[1, [makeMessage({ id: 10, conversationId: 1 })]]]);
    let latest = initial;

    function Harness() {
      const [state, setState] = useState(initial);
      useMessageSockets({ socket: socket as unknown as never, setMessagesByConversation: setState });
      useEffect(() => {
        latest = state;
      }, [state]);
      return null;
    }

    render(<Harness />);
    await act(async () => {});

    act(() => {
      socket.trigger("messageDeleted", { conversationId: 99, messageId: 10 });
    });

    expect(latest).toBe(initial);
    expect(latest.has(99)).toBe(false);
  });
});
