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
    },
  },
}));

import { verifyMembership } from "../../sockets/helpers/helpers.js";
import { prisma } from "../../shared/prisma.js";

describe("chat.handler editMessage", () => {
  let mockIo;
  let mockSocket;
  let mockCallback;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-27T09:10:00.000Z"));

    mockIo = createMockIo();
    mockSocket = createMockSocket({ user: { id: 1, username: "alice", email: "alice@test.com" } });
    mockCallback = createMockCallback();

    jest.clearAllMocks();
    verifyMembership.mockResolvedValue(true);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        message: {
          updateMany: jest.fn(),
          findUnique: jest.fn(),
        },
      }),
    );
    handleChatMessage(mockIo, mockSocket);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should not throw if callback is missing", async () => {
    prisma.message.findUnique.mockResolvedValue(null);

    await expect(
      mockSocket._trigger("editMessage", { conversationId: 1, messageId: 1, content: "hi" }),
    ).resolves.toBeUndefined();
  });

  it("should reject invalid ids", async () => {
    await mockSocket._trigger(
      "editMessage",
      { conversationId: "abc", messageId: 1, content: "hi" },
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
      "editMessage",
      { conversationId: 1, messageId: "abc", content: "hi" },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "INVALID_MESSAGE_ID",
      error: "messageId must be a valid positive integer.",
    });
  });

  it("should reject invalid content type", async () => {
    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 1, content: null },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "INVALID_CONTENT",
      error: "content must be a string (can be empty).",
    });
  });

  it("should reject when not a member", async () => {
    verifyMembership.mockResolvedValue(false);

    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 1, content: "hi" },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "NOT_A_MEMBER",
      error: "You are not a member of this conversation.",
    });
  });

  it("should reject when message not found", async () => {
    prisma.message.findUnique.mockResolvedValue(null);

    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 999, content: "hi" },
      mockCallback,
    );

    expect(prisma.message.findUnique).toHaveBeenCalled();
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
      messageType: "TEXT",
      createdAt: new Date("2026-02-27T09:09:00.000Z"),
      deletedAt: null,
    });

    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 10, content: "hi" },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "NOT_OWNER",
      error: "You can only edit your own messages.",
    });
  });

  it("should reject when message is soft deleted", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 1,
      senderId: 1,
      messageType: "TEXT",
      createdAt: new Date("2026-02-27T09:09:00.000Z"),
      deletedAt: new Date("2026-03-04T00:00:00.000Z"),
    });

    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 10, content: "hi" },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "MESSAGE_NOT_FOUND",
      error: "Message not found.",
    });
  });

  it("should reject when message is deleted before guarded write", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 1,
      senderId: 1,
      messageType: "TEXT",
      createdAt: new Date("2026-02-27T09:09:00.000Z"),
      deletedAt: null,
    });

    const tx = {
      message: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 10, content: "hi" },
      mockCallback,
    );

    expect(tx.message.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10, deletedAt: null },
      }),
    );
    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "MESSAGE_NOT_FOUND",
      error: "Message not found.",
    });
  });

  it("should reject TEXT edit when content is empty after trim", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 1,
      senderId: 1,
      messageType: "TEXT",
      createdAt: new Date("2026-02-27T09:09:00.000Z"),
      deletedAt: null,
    });

    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 10, content: "   " },
      mockCallback,
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "INVALID_CONTENT",
      error: "Text content cannot be empty.",
    });
  });

  it("should allow IMAGE caption to become null", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 1,
      senderId: 1,
      messageType: "IMAGE",
      createdAt: new Date("2026-02-27T09:09:00.000Z"),
      deletedAt: null,
    });

    const updated = {
      id: 10,
      conversationId: 1,
      senderId: 1,
      messageType: "IMAGE",
      content: null,
      createdAt: new Date("2026-02-27T09:09:00.000Z"),
      editedAt: new Date("2026-02-27T09:10:00.000Z"),
      sender: { id: 1, username: "alice", avatar: null },
      attachments: [],
      deletedAt: null,
    };
    const tx = {
      message: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(updated),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 10, content: "   " },
      mockCallback,
    );

    expect(tx.message.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10, deletedAt: null },
        data: expect.objectContaining({ content: null, editedAt: expect.any(Date) }),
      }),
    );
    expect(mockIo.to).toHaveBeenCalledWith("conversation_1");
    expect(mockIo._mockEmit).toHaveBeenCalledWith("messageUpdated", updated);
    expect(mockCallback).toHaveBeenCalledWith({ success: true, message: updated });
  });

  it("should ack success and broadcast messageUpdated on success", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 1,
      senderId: 1,
      messageType: "TEXT",
      createdAt: new Date("2026-02-27T09:09:00.000Z"),
      deletedAt: null,
    });

    const updated = {
      id: 10,
      conversationId: 1,
      senderId: 1,
      messageType: "TEXT",
      content: "hello",
      createdAt: new Date("2026-02-27T09:09:00.000Z"),
      editedAt: new Date("2026-02-27T09:10:00.000Z"),
      sender: { id: 1, username: "alice", avatar: null },
      attachments: [],
      deletedAt: null,
    };
    const tx = {
      message: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(updated),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 10, content: "  hello  " },
      mockCallback,
    );

    expect(tx.message.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10, deletedAt: null },
        data: expect.objectContaining({ content: "hello", editedAt: expect.any(Date) }),
      }),
    );
    expect(mockIo._mockEmit).toHaveBeenCalledWith("messageUpdated", updated);
    expect(mockCallback).toHaveBeenCalledWith({ success: true, message: updated });
  });
});
