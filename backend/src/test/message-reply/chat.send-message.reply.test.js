/* global jest, describe, it, expect, beforeEach */

import { handleChatMessage } from "../../sockets/handlers/chat.handler.js";
import { createMockSocket, createMockIo, createMockCallback } from "../mocks/socket.mock.js";

jest.mock("../../api/services/conversation.service.js", () => ({
  findOrCreatePrivateConversation: jest.fn(),
}));

jest.mock("../../sockets/helpers/helpers.js", () => ({
  verifyMembership: jest.fn(),
  getConversationRoom: jest.fn((id) => `conversation_${id}`),
  getUserRoom: jest.fn((id) => `user_${id}`),
}));

jest.mock("../../shared/prisma.js", () => ({
  prisma: {
    $transaction: jest.fn(),
    message: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { verifyMembership } from "../../sockets/helpers/helpers.js";
import { prisma } from "../../shared/prisma.js";

describe("chat.handler sendMessage (reply)", () => {
  let mockIo;
  let mockSocket;
  let mockCallback;

  beforeEach(() => {
    jest.clearAllMocks();

    mockIo = createMockIo();
    mockSocket = createMockSocket({ user: { id: 1, username: "alice", email: "alice@test.com" } });
    mockCallback = createMockCallback();

    verifyMembership.mockResolvedValue(true);
    handleChatMessage(mockIo, mockSocket);
  });

  it("should reject when reply target is not found", async () => {
    prisma.message.findUnique.mockResolvedValue(null);

    await mockSocket._trigger(
      "sendMessage",
      { conversationId: 1, content: "hello", replyToMessageId: 99 },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "REPLY_TO_NOT_FOUND",
      error: "Reply target not found.",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("should reject when reply target is in another conversation", async () => {
    prisma.message.findUnique.mockResolvedValue({ id: 99, conversationId: 2 });

    await mockSocket._trigger(
      "sendMessage",
      { conversationId: 1, content: "hello", replyToMessageId: 99 },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "REPLY_TO_WRONG_CONVERSATION",
      error: "Reply target must be in the same conversation.",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("should persist replyToMessageId and include minimal replyTo preview on success", async () => {
    prisma.message.findUnique.mockResolvedValue({ id: 99, conversationId: 1 });

    const createdMessage = {
      id: 1001,
      conversationId: 1,
      senderId: 1,
      content: "hello",
      messageType: "TEXT",
      sender: { id: 1, username: "alice", avatar: null },
      replyTo: {
        id: 99,
        content: "parent",
        messageType: "TEXT",
        sender: { id: 2, username: "bob", avatar: null },
      },
    };

    const tx = {
      message: {
        create: jest.fn().mockResolvedValue(createdMessage),
      },
      conversation: {
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    await mockSocket._trigger(
      "sendMessage",
      { conversationId: 1, content: "hello", replyToMessageId: 99 },
      mockCallback,
    );

    expect(tx.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: 1,
          senderId: 1,
          content: "hello",
          messageType: "TEXT",
          replyToMessageId: 99,
        }),
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
    expect(mockCallback).toHaveBeenCalledWith({ success: true, message: expect.any(Object) });
  });
});
