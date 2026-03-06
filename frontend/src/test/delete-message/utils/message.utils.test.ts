import { describe, expect, it } from "vitest";

import type { DisplayMessage } from "@/types/chat.type";
import { clearReplyLinksInMap } from "../../../utils/message.utils";

function makeMessage(overrides: Partial<DisplayMessage> & { id: number; conversationId: number }): DisplayMessage {
  const base: DisplayMessage = {
    id: 0,
    conversationId: 0,
    senderId: 1,
    content: "old",
    messageType: "TEXT",
    createdAt: "2026-03-04T09:00:00.000Z",
    editedAt: null,
    sender: { id: 1, username: "alice", avatar: null },
    attachments: [],
    replyToMessageId: null,
    replyTo: null,
  };
  return { ...base, ...overrides } as DisplayMessage;
}

describe("message.utils clearReplyLinksInMap", () => {
  it("returns same map when conversation not in cache", () => {
    const prev = new Map<number, DisplayMessage[]>();
    const next = clearReplyLinksInMap(prev, 1, 10);
    expect(next).toBe(prev);
  });

  it("clears reply fields for messages replying to the deleted message", () => {
    const prev = new Map<number, DisplayMessage[]>([
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

    const next = clearReplyLinksInMap(prev, 1, 10);

    expect(next).not.toBe(prev);
    expect(next.get(1)?.[1].replyToMessageId).toBeNull();
    expect(next.get(1)?.[1].replyTo).toBeNull();
  });

  it("does not reorder the message list", () => {
    const prev = new Map<number, DisplayMessage[]>([
      [
        1,
        [
          makeMessage({ id: 10, conversationId: 1 }),
          makeMessage({
            id: 11,
            conversationId: 1,
            replyToMessageId: 10,
            replyTo: {
              id: 10,
              content: "target",
              messageType: "TEXT",
              sender: { id: 1, username: "alice", avatar: null },
            },
          }),
          makeMessage({ id: 12, conversationId: 1 }),
        ],
      ],
    ]);

    const next = clearReplyLinksInMap(prev, 1, 10);

    expect((next.get(1) ?? []).map((message) => message.id)).toEqual([10, 11, 12]);
  });

  it("also clears stale reply previews when only replyTo.id matches", () => {
    const prev = new Map<number, DisplayMessage[]>([
      [
        1,
        [
          makeMessage({
            id: 11,
            conversationId: 1,
            replyToMessageId: null,
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

    const next = clearReplyLinksInMap(prev, 1, 10);

    expect(next.get(1)?.[0].replyToMessageId).toBeNull();
    expect(next.get(1)?.[0].replyTo).toBeNull();
  });
});
