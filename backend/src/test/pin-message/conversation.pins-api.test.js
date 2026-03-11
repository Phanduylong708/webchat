/* global jest, describe, it, expect, beforeEach */

jest.mock("../../shared/prisma.js", () => ({
  prisma: {
    conversationMember: {
      findUnique: jest.fn(),
    },
    conversationPin: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from "../../shared/prisma.js";
import { getConversationPins } from "../../api/services/conversation.service.js";

describe("conversation pins API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.conversationMember.findUnique.mockResolvedValue({ id: 1 });
    prisma.conversationPin.findMany.mockResolvedValue([]);
  });

  it("rejects non-members from fetching pins", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue(null);

    await expect(getConversationPins(10, 2)).rejects.toMatchObject({
      statusCode: 403,
      message: "Not a member of conversation",
    });
    expect(prisma.conversationPin.findMany).not.toHaveBeenCalled();
  });

  it("requests newest pins first and limits the result to 10", async () => {
    const pins = [
      {
        messageId: 5,
        conversationId: 10,
        pinnedAt: new Date("2026-03-09T10:00:00.000Z"),
        pinnedBy: { id: 1, username: "alice", avatar: null },
        message: {
          id: 5,
          content: "newest",
          previewText: "newest",
          messageType: "TEXT",
          createdAt: new Date("2026-03-09T09:00:00.000Z"),
          sender: { id: 1, username: "alice", avatar: null },
          attachments: [],
        },
      },
      {
        messageId: 4,
        conversationId: 10,
        pinnedAt: new Date("2026-03-08T10:00:00.000Z"),
        pinnedBy: { id: 2, username: "bob", avatar: null },
        message: {
          id: 4,
          content: "older",
          previewText: "older",
          messageType: "TEXT",
          createdAt: new Date("2026-03-08T09:00:00.000Z"),
          sender: { id: 2, username: "bob", avatar: null },
          attachments: [],
        },
      },
    ];
    prisma.conversationPin.findMany.mockResolvedValue(pins);

    const result = await getConversationPins(10, 1);

    expect(prisma.conversationPin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversationId: 10,
        }),
        orderBy: [{ pinnedAt: "desc" }, { id: "desc" }],
        take: 10,
      }),
    );
    expect(result).toEqual(pins);
    expect(result.map((pin) => pin.messageId)).toEqual([5, 4]);
  });

  it("filters out pins whose messages were soft-deleted", async () => {
    await getConversationPins(99, 1);

    expect(prisma.conversationPin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          conversationId: 99,
          message: {
            deletedAt: null,
          },
        },
      }),
    );
  });

  it("returns media preview fallback for pinned non-text messages", async () => {
    prisma.conversationPin.findMany.mockResolvedValue([
      {
        messageId: 7,
        conversationId: 10,
        pinnedAt: new Date("2026-03-09T10:00:00.000Z"),
        pinnedBy: { id: 1, username: "alice", avatar: null },
        message: {
          id: 7,
          content: null,
          messageType: "IMAGE",
          createdAt: new Date("2026-03-09T09:00:00.000Z"),
          sender: { id: 1, username: "alice", avatar: null },
          attachments: [{ id: 1, url: "x", mimeType: "image/png", originalFileName: "a.png" }],
        },
      },
    ]);

    const result = await getConversationPins(10, 1);

    expect(result[0].message.previewText).toBe("image");
  });
});
