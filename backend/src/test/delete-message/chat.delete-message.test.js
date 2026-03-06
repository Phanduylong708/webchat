/* global jest, describe, it, expect, beforeEach, afterEach */

import { handleChatMessage } from "../../sockets/handlers/chat.handler.js";
import { createMockSocket, createMockIo, createMockCallback } from "../mocks/socket.mock.js";

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
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("../../api/services/media.service.js", () => ({
  deleteCloudAssetBestEffort: jest.fn(),
}));

import { verifyMembership } from "../../sockets/helpers/helpers.js";
import { prisma } from "../../shared/prisma.js";
import { deleteCloudAssetBestEffort } from "../../api/services/media.service.js";

describe("chat.handler deleteMessage", () => {
  let mockIo;
  let mockSocket;
  let mockCallback;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-04T09:10:00.000Z"));

    mockIo = createMockIo();
    mockSocket = createMockSocket({ user: { id: 1, username: "alice", email: "alice@test.com" } });
    mockCallback = createMockCallback();

    jest.clearAllMocks();
    verifyMembership.mockResolvedValue(true);
    prisma.message.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        message: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }),
    );

    handleChatMessage(mockIo, mockSocket);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should not throw if callback is missing", async () => {
    await expect(
      mockSocket._trigger("deleteMessage", { conversationId: 1, messageId: 1 }),
    ).resolves.toBeUndefined();
  });

  it("should reject invalid conversationId", async () => {
    await mockSocket._trigger(
      "deleteMessage",
      { conversationId: "abc", messageId: 1 },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "INVALID_CONVERSATION_ID",
      error: "conversationId must be a valid positive integer.",
    });
  });

  it("should reject invalid messageId", async () => {
    await mockSocket._trigger(
      "deleteMessage",
      { conversationId: 1, messageId: "abc" },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "INVALID_MESSAGE_ID",
      error: "messageId must be a valid positive integer.",
    });
  });

  it("should reject when not a member", async () => {
    verifyMembership.mockResolvedValue(false);

    await mockSocket._trigger(
      "deleteMessage",
      { conversationId: 1, messageId: 10 },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "NOT_A_MEMBER",
      error: "You are not a member of this conversation.",
    });
  });

  it("should reject when message is not found", async () => {
    prisma.message.findUnique.mockResolvedValue(null);

    await mockSocket._trigger(
      "deleteMessage",
      { conversationId: 1, messageId: 999 },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "MESSAGE_NOT_FOUND",
      error: "Message not found.",
    });
  });

  it("should reject when message belongs to another conversation", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 2,
      senderId: 1,
      deletedAt: null,
      attachments: [],
    });

    await mockSocket._trigger(
      "deleteMessage",
      { conversationId: 1, messageId: 10 },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "MESSAGE_NOT_FOUND",
      error: "Message not found.",
    });
  });

  it("should reject when message is already deleted", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 1,
      senderId: 1,
      deletedAt: new Date("2026-03-04T00:00:00.000Z"),
      attachments: [],
    });

    await mockSocket._trigger(
      "deleteMessage",
      { conversationId: 1, messageId: 10 },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "MESSAGE_NOT_FOUND",
      error: "Message not found.",
    });
  });

  it("should reject when not owner", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 1,
      senderId: 2,
      deletedAt: null,
      attachments: [],
    });

    await mockSocket._trigger(
      "deleteMessage",
      { conversationId: 1, messageId: 10 },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "NOT_OWNER",
      error: "You can only delete your own messages.",
    });
  });

  it("should reject when guarded soft delete affects no rows", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 1,
      senderId: 1,
      deletedAt: null,
      attachments: [],
    });
    prisma.message.findFirst.mockResolvedValue({ id: 10 });

    const tx = {
      message: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 0 }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    await mockSocket._trigger(
      "deleteMessage",
      { conversationId: 1, messageId: 10 },
      mockCallback,
    );

    expect(tx.message.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      }),
    );
    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "MESSAGE_NOT_FOUND",
      error: "Message not found.",
    });
  });

  it("should soft delete, clear reply links, emit messageDeleted, and cleanup assets on success", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 1,
      senderId: 1,
      deletedAt: null,
      attachments: [{ publicId: "chat/asset-1" }],
    });
    prisma.message.findFirst
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({
        id: 9,
        conversationId: 1,
        senderId: 2,
        content: "previous",
        messageType: "TEXT",
        createdAt: new Date("2026-03-04T09:09:00.000Z"),
        deletedAt: null,
        sender: { id: 2, username: "bob", avatar: null },
        replyTo: null,
        attachments: [],
      });

    const tx = {
      message: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 3 }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    deleteCloudAssetBestEffort.mockResolvedValue(true);

    await mockSocket._trigger(
      "deleteMessage",
      { conversationId: 1, messageId: 10 },
      mockCallback,
    );

    expect(tx.message.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 10, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      }),
    );
    expect(tx.message.updateMany).toHaveBeenNthCalledWith(2, {
      where: { replyToMessageId: 10 },
      data: { replyToMessageId: null },
    });
    expect(mockSocket.join).toHaveBeenCalledWith("conversation_1");
    expect(mockIo.to).toHaveBeenCalledWith("conversation_1");
    expect(mockIo._mockEmit).toHaveBeenCalledWith("messageDeleted", {
      conversationId: 1,
      messageId: 10,
      nextLastMessage: expect.objectContaining({ id: 9 }),
    });
    expect(mockCallback).toHaveBeenCalledWith({ success: true });
    expect(deleteCloudAssetBestEffort).toHaveBeenCalledWith("chat/asset-1");
  });

  it("should emit nextLastMessage as null when deleting the final preview message", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 1,
      senderId: 1,
      deletedAt: null,
      attachments: [],
    });
    prisma.message.findFirst.mockResolvedValueOnce({ id: 10 }).mockResolvedValueOnce(null);

    const tx = {
      message: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    await mockSocket._trigger(
      "deleteMessage",
      { conversationId: 1, messageId: 10 },
      mockCallback,
    );

    expect(mockIo._mockEmit).toHaveBeenCalledWith("messageDeleted", {
      conversationId: 1,
      messageId: 10,
      nextLastMessage: null,
    });
    expect(mockCallback).toHaveBeenCalledWith({ success: true });
  });
});
