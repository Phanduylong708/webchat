import { describe, expect, it } from "vitest";

import type { DisplayMessage } from "@/types/chat.type";
import { updateMessageInMap } from "../../../utils/message.utils";

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

describe("message.utils updateMessageInMap", () => {
  it("returns same map when conversation not in cache", () => {
    const prev = new Map<number, DisplayMessage[]>();
    const next = updateMessageInMap(prev, 1, 10, makeMessage({ id: 10, conversationId: 1 }));
    expect(next).toBe(prev);
  });

  it("returns same map when message not found", () => {
    const prev = new Map<number, DisplayMessage[]>([[1, [makeMessage({ id: 10, conversationId: 1 })]]]);
    const next = updateMessageInMap(prev, 1, 999, makeMessage({ id: 999, conversationId: 1 }));
    expect(next).toBe(prev);
  });

  it("patches message by id without reordering and preserves _stableKey", () => {
    const original = Object.assign(makeMessage({ id: 10, conversationId: 1 }), {
      _stableKey: "temp-1",
    }) as DisplayMessage & { _stableKey: string };

    const prev = new Map<number, DisplayMessage[]>([[1, [original, makeMessage({ id: 11, conversationId: 1 })]]]);

    const updated = makeMessage({
      id: 10,
      conversationId: 1,
      content: "new",
      editedAt: "2026-02-27T09:10:00.000Z",
    });

    const next = updateMessageInMap(prev, 1, 10, updated);

    expect(next).not.toBe(prev);
    expect((next.get(1) ?? []).map((m: DisplayMessage) => m.id)).toEqual([10, 11]);
    expect(next.get(1)?.[0].content).toBe("new");
    expect((next.get(1)?.[0] as unknown as { _stableKey?: string })._stableKey).toBe("temp-1");
  });
});
