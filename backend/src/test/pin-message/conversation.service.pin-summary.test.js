/* global jest, describe, it, expect, beforeEach */

jest.mock("../../shared/prisma.js", () => ({
  prisma: {
    conversationMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    conversation: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from "../../shared/prisma.js";
import {
  buildPinSummary,
  getConversations,
} from "../../api/services/conversation.service.js";

describe("conversation.service pin summary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null pinSummary when a conversation has no pins", async () => {
    prisma.conversationMember.findMany.mockResolvedValue([
      {
        conversation: {
          id: 11,
          type: "PRIVATE",
          title: null,
          pinPermission: "ALL_MEMBERS",
          members: [
            {
              userId: 1,
              user: { id: 1, username: "alice", avatar: null },
            },
            {
              userId: 2,
              user: { id: 2, username: "bob", avatar: null },
            },
          ],
          messages: [],
          pins: [],
          _count: { pins: 0 },
        },
      },
    ]);

    const conversations = await getConversations(1);

    expect(conversations).toEqual([
      expect.objectContaining({
        id: 11,
        pinPermission: "ALL_MEMBERS",
        pinSummary: null,
      }),
    ]);
  });

  it("uses the same deleted-message filter for latest pin and pin count", async () => {
    prisma.conversationMember.findMany.mockResolvedValue([]);

    await getConversations(1);

    expect(prisma.conversationMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          conversation: expect.objectContaining({
            include: expect.objectContaining({
              pins: expect.objectContaining({
                where: { message: { deletedAt: null } },
                orderBy: [{ pinnedAt: "desc" }, { id: "desc" }],
                take: 1,
              }),
              _count: {
                select: {
                  pins: {
                    where: { message: { deletedAt: null } },
                  },
                },
              },
            }),
          }),
        }),
      }),
    );
  });

  it("falls back to media preview keys for non-text pinned messages", () => {
    const imageSummary = buildPinSummary(1, {
      pinnedAt: new Date("2026-03-08T12:00:00.000Z"),
      message: {
        id: 101,
        content: null,
        messageType: "IMAGE",
        attachments: [{ mimeType: "image/png" }],
      },
    });

    const fileSummary = buildPinSummary(1, {
      pinnedAt: new Date("2026-03-08T13:00:00.000Z"),
      message: {
        id: 102,
        content: null,
        messageType: "FILE",
        attachments: [{ mimeType: "application/pdf" }],
      },
    });

    expect(imageSummary).toEqual({
      pinnedCount: 1,
      latestPinnedMessage: {
        id: 101,
        previewText: "image",
        messageType: "IMAGE",
        pinnedAt: "2026-03-08T12:00:00.000Z",
      },
    });
    expect(fileSummary).toEqual({
      pinnedCount: 1,
      latestPinnedMessage: {
        id: 102,
        previewText: "file",
        messageType: "FILE",
        pinnedAt: "2026-03-08T13:00:00.000Z",
      },
    });
  });
});
