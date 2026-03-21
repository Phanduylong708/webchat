import { type InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { DisplayMessage } from "@/types/chat.type";
import {
  removeMessageAndClearOrphanedReplyLinks,
  type MessagesPage,
} from "@/hooks/queries/messages";

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

function makeMessagesCache(...pages: DisplayMessage[][]): InfiniteData<MessagesPage> {
  return {
    pages: pages.map((messages) => ({
      messages,
      meta: { nextCursor: null, hasMore: false },
    })),
    pageParams: pages.map(() => undefined),
  };
}

describe("removeMessageAndClearOrphanedReplyLinks", () => {
  it("removes the deleted message and clears replies that point to it", () => {
    const prev = makeMessagesCache([
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
    ]);

    const next = removeMessageAndClearOrphanedReplyLinks(prev, 10);

    expect(next.pages[0].messages.map((message) => message.id)).toEqual([11]);
    expect(next.pages[0].messages[0].replyToMessageId).toBeNull();
    expect(next.pages[0].messages[0].replyTo).toBeNull();
  });

  it("does not reorder messages that remain in the same page", () => {
    const prev = makeMessagesCache([
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
    ]);

    const next = removeMessageAndClearOrphanedReplyLinks(prev, 10);

    expect(next.pages[0].messages.map((message: DisplayMessage) => message.id)).toEqual([11, 12]);
  });

  it("clears stale reply previews even when only replyTo.id matches", () => {
    const prev = makeMessagesCache([
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
    ]);

    const next = removeMessageAndClearOrphanedReplyLinks(prev, 10);

    expect(next.pages[0].messages[0].replyToMessageId).toBeNull();
    expect(next.pages[0].messages[0].replyTo).toBeNull();
  });

  it("clears reply links even when the reply and deleted message are on different pages", () => {
    const prev = makeMessagesCache(
      [
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
      ],
      [makeMessage({ id: 10, conversationId: 1, content: "target" })],
    );

    const next = removeMessageAndClearOrphanedReplyLinks(prev, 10);

    expect(next.pages[0].messages[0].replyToMessageId).toBeNull();
    expect(next.pages[0].messages[0].replyTo).toBeNull();
    expect(next.pages[1].messages).toEqual([]);
  });
});
