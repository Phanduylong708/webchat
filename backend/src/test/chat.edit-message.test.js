/* global jest, describe, it, expect, beforeEach, afterEach */

import { handleChatMessage } from "../sockets/handlers/chat.handler.js";
import { createMockSocket, createMockIo, createMockCallback } from "./mocks/socket.mock.js";

jest.mock("../sockets/helpers/helpers.js", () => ({
  verifyMembership: jest.fn(),
  getConversationRoom: jest.fn((id) => `conversation_${id}`),
  getUserRoom: jest.fn((id) => `user_${id}`),
}));

jest.mock("../shared/prisma.js", () => ({
  prisma: {
    message: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { verifyMembership } from "../sockets/helpers/helpers.js";
import { prisma } from "../shared/prisma.js";

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
    handleChatMessage(mockIo, mockSocket);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should not throw if callback is missing", async () => {
    prisma.message.findUnique.mockResolvedValue(null);

    await expect(
      mockSocket._trigger("editMessage", { conversationId: 1, messageId: 1, content: "hi" })
    ).resolves.toBeUndefined();
  });

  it("should reject invalid ids", async () => {
    await mockSocket._trigger(
      "editMessage",
      { conversationId: "abc", messageId: 1, content: "hi" },
      mockCallback
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "INVALID_CONVERSATION_ID",
      error: "conversationId must be a valid positive integer.",
    });
  });

  it("should reject when not a member", async () => {
    verifyMembership.mockResolvedValue(false);

    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 1, content: "hi" },
      mockCallback
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
      mockCallback
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
    });

    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 10, content: "hi" },
      mockCallback
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "NOT_OWNER",
      error: "You can only edit your own messages.",
    });
  });

  it("should reject when edit window expired", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 1,
      senderId: 1,
      messageType: "TEXT",
      createdAt: new Date("2026-02-27T09:00:00.000Z"),
    });

    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 10, content: "hi" },
      mockCallback
    );

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "EDIT_WINDOW_EXPIRED",
      error: "Edit window has expired.",
    });
  });

  it("should reject TEXT edit when content is empty after trim", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 1,
      senderId: 1,
      messageType: "TEXT",
      createdAt: new Date("2026-02-27T09:09:00.000Z"),
    });

    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 10, content: "   " },
      mockCallback
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
    };
    prisma.message.update.mockResolvedValue(updated);

    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 10, content: "   " },
      mockCallback
    );

    expect(prisma.message.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ content: null }),
      })
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
    };
    prisma.message.update.mockResolvedValue(updated);

    await mockSocket._trigger(
      "editMessage",
      { conversationId: 1, messageId: 10, content: "  hello  " },
      mockCallback
    );

    expect(mockIo._mockEmit).toHaveBeenCalledWith("messageUpdated", updated);
    expect(mockCallback).toHaveBeenCalledWith({ success: true, message: updated });
  });
});
