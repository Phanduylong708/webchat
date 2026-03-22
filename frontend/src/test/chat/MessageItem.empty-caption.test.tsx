import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import MessageItem from "@/features/chat/components/message/MessageItem";
import type { OptimisticMessage } from "@/types/chat.type";

afterEach(() => {
  cleanup();
});

function buildOptimisticImageMessage(
  patch: Partial<OptimisticMessage> = {},
): OptimisticMessage {
  return {
    id: -1,
    conversationId: 1,
    senderId: 1,
    content: null,
    messageType: "IMAGE",
    createdAt: "2026-03-04T10:00:00.000Z",
    editedAt: null,
    sender: { id: 1, username: "alice", avatar: null },
    attachments: [],
    replyToMessageId: null,
    replyTo: null,
    _optimistic: true,
    _status: "sending",
    _previewUrl: "blob:test-image",
    ...patch,
  };
}

describe("MessageItem empty caption rendering", () => {
  it("does not render empty text bubble for image-only message without reply", () => {
    const message = buildOptimisticImageMessage();

    const { container } = render(
      <MessageItem
        message={message}
        scrollContainerId="scrollableDiv-1"
        isOwn={true}
        isFirstInGroup={true}
        isLastInGroup={true}
      />,
    );

    const bubbles = container.querySelectorAll('[data-message-bubble="true"]');
    expect(bubbles.length).toBe(0);
  });

  it("keeps quote bubble when image-only message has reply reference", () => {
    const message = buildOptimisticImageMessage({
      replyToMessageId: 88,
      replyTo: {
        id: 88,
        content: "parent",
        messageType: "TEXT",
        sender: { id: 2, username: "bob", avatar: null },
      },
    });

    const { container } = render(
      <MessageItem
        message={message}
        scrollContainerId="scrollableDiv-1"
        isOwn={true}
        isFirstInGroup={true}
        isLastInGroup={true}
      />,
    );

    const bubbles = container.querySelectorAll('[data-message-bubble="true"]');
    expect(bubbles.length).toBe(1);
  });
});
