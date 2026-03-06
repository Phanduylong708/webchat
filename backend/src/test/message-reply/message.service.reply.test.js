/* global jest, describe, it, expect, beforeEach */

jest.mock("../../shared/prisma.js", () => ({
  prisma: {
    conversationMember: {
      findUnique: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from "../../shared/prisma.js";
import { getMessages } from "../../api/services/message.service.js";

describe("message.service getMessages (reply)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.conversationMember.findUnique.mockResolvedValue({ id: 1 });
    prisma.message.findMany.mockResolvedValue([]);
  });

  it("should request minimal replyTo preview in message history include", async () => {
    await getMessages(10, 1, null, 20);

    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ conversationId: 10, deletedAt: null }),
        include: expect.objectContaining({
          replyTo: {
            select: {
              id: true,
              content: true,
              messageType: true,
              sender: { select: { id: true, username: true, avatar: true } },
            },
          },
        }),
      }),
    );
  });
});
