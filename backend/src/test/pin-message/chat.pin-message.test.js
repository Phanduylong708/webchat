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
    conversation: {
      findUnique: jest.fn(),
    },
    conversationPin: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../api/services/media.service.js", () => ({
  deleteCloudAssetBestEffort: jest.fn(),
}));

import { verifyMembership } from "../../sockets/helpers/helpers.js";
import { prisma } from "../../shared/prisma.js";

function buildPinnedRow(overrides = {}) {
  return {
    messageId: 10,
    conversationId: 1,
    pinnedAt: new Date("2026-03-09T10:00:00.000Z"),
    pinnedBy: { id: 1, username: "alice", avatar: null },
    message: {
      id: 10,
      content: "hello world",
      messageType: "TEXT",
      createdAt: new Date("2026-03-09T09:00:00.000Z"),
      sender: { id: 2, username: "bob", avatar: null },
      attachments: [],
    },
    ...overrides,
  };
}

function buildLatestPin(overrides = {}) {
  return {
    pinnedAt: new Date("2026-03-09T10:00:00.000Z"),
    message: {
      id: 10,
      content: "hello world",
      messageType: "TEXT",
      attachments: [],
    },
    ...overrides,
  };
}

describe("chat.handler pinMessage/unpinMessage", () => {
  let mockIo;
  let mockSocket;
  let mockCallback;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-09T10:00:00.000Z"));

    mockIo = createMockIo();
    mockSocket = createMockSocket({ user: { id: 1, username: "alice", email: "alice@test.com" } });
    mockCallback = createMockCallback();

    jest.clearAllMocks();

    verifyMembership.mockResolvedValue(true);
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 1,
      deletedAt: null,
    });
    prisma.conversation.findUnique.mockResolvedValue({
      id: 1,
      type: "GROUP",
      creatorId: 1,
      pinPermission: "ALL_MEMBERS",
    });
    prisma.conversationPin.findUnique.mockResolvedValue({ id: 99 });

    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        message: {
          findFirst: jest.fn().mockResolvedValue({ id: 10 }),
        },
        conversationPin: {
          findUnique: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
          create: jest.fn().mockResolvedValue(buildPinnedRow()),
          findFirst: jest.fn().mockResolvedValue(buildLatestPin()),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }),
    );

    handleChatMessage(mockIo, mockSocket);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("rejects invalid conversationId", async () => {
    await mockSocket._trigger("pinMessage", { conversationId: "abc", messageId: 10 }, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "INVALID_CONVERSATION_ID",
      error: "conversationId must be a valid positive integer.",
    });
  });

  it("rejects invalid messageId", async () => {
    await mockSocket._trigger("pinMessage", { conversationId: 1, messageId: "abc" }, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "INVALID_MESSAGE_ID",
      error: "messageId must be a valid positive integer.",
    });
  });

  it("rejects when the user is not a member", async () => {
    verifyMembership.mockResolvedValue(false);

    await mockSocket._trigger("pinMessage", { conversationId: 1, messageId: 10 }, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "NOT_A_MEMBER",
      error: "You are not a member of this conversation.",
    });
    expect(mockIo._mockEmit).not.toHaveBeenCalled();
  });

  it("rejects when the message belongs to another conversation", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 2,
      deletedAt: null,
    });

    await mockSocket._trigger("pinMessage", { conversationId: 1, messageId: 10 }, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "MESSAGE_NOT_FOUND",
      error: "Message not found.",
    });
    expect(mockIo._mockEmit).not.toHaveBeenCalled();
  });

  it("rejects when the message is deleted", async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 10,
      conversationId: 1,
      deletedAt: new Date("2026-03-09T09:59:00.000Z"),
    });

    await mockSocket._trigger("pinMessage", { conversationId: 1, messageId: 10 }, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "MESSAGE_NOT_FOUND",
      error: "Message not found.",
    });
    expect(mockIo._mockEmit).not.toHaveBeenCalled();
  });

  it("rejects duplicate pins", async () => {
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        message: {
          findFirst: jest.fn().mockResolvedValue({ id: 10 }),
        },
        conversationPin: {
          findUnique: jest.fn().mockResolvedValue({ id: 55 }),
          count: jest.fn(),
          create: jest.fn(),
          findFirst: jest.fn(),
          deleteMany: jest.fn(),
        },
      }),
    );

    await mockSocket._trigger("pinMessage", { conversationId: 1, messageId: 10 }, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "MESSAGE_ALREADY_PINNED",
      error: "Message is already pinned.",
    });
    expect(mockIo._mockEmit).not.toHaveBeenCalled();
  });

  it("rejects when the pin limit is reached", async () => {
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        message: {
          findFirst: jest.fn().mockResolvedValue({ id: 10 }),
        },
        conversationPin: {
          findUnique: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValueOnce(10),
          create: jest.fn(),
          findFirst: jest.fn(),
          deleteMany: jest.fn(),
        },
      }),
    );

    await mockSocket._trigger("pinMessage", { conversationId: 1, messageId: 10 }, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "PIN_LIMIT_REACHED",
      error: "Conversation pin limit reached.",
    });
    expect(mockIo._mockEmit).not.toHaveBeenCalled();
  });

  it("rejects when the message is deleted between precheck and transactional write", async () => {
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        message: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        conversationPin: {
          findUnique: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
          findFirst: jest.fn(),
          deleteMany: jest.fn(),
        },
      }),
    );

    await mockSocket._trigger("pinMessage", { conversationId: 1, messageId: 10 }, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "MESSAGE_NOT_FOUND",
      error: "Message not found.",
    });
    expect(mockIo._mockEmit).not.toHaveBeenCalled();
  });

  it("enforces creator-only group pin permission", async () => {
    mockSocket = createMockSocket({ user: { id: 2, username: "bob", email: "bob@test.com" } });
    prisma.conversation.findUnique.mockResolvedValue({
      id: 1,
      type: "GROUP",
      creatorId: 1,
      pinPermission: "CREATOR_ONLY",
    });

    handleChatMessage(mockIo, mockSocket);

    await mockSocket._trigger("pinMessage", { conversationId: 1, messageId: 10 }, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "NO_PIN_PERMISSION",
      error: "You do not have permission to manage pins in this conversation.",
    });
    expect(mockIo._mockEmit).not.toHaveBeenCalled();
  });

  it("pins successfully and emits a small update payload", async () => {
    await mockSocket._trigger("pinMessage", { conversationId: 1, messageId: 10 }, mockCallback);

    expect(mockSocket.join).toHaveBeenCalledWith("conversation_1");
    expect(mockIo.to).toHaveBeenCalledWith("conversation_1");
    expect(mockIo._mockEmit).toHaveBeenCalledWith("messagePinned", {
      conversationId: 1,
      pinnedCount: 1,
      latestPinnedMessage: {
        id: 10,
        previewText: "hello world",
        messageType: "TEXT",
        pinnedAt: "2026-03-09T10:00:00.000Z",
      },
      pinnedItem: {
        messageId: 10,
        conversationId: 1,
        pinnedAt: "2026-03-09T10:00:00.000Z",
        pinnedBy: { id: 1, username: "alice", avatar: null },
        message: {
          id: 10,
          content: "hello world",
          messageType: "TEXT",
          createdAt: "2026-03-09T09:00:00.000Z",
          sender: { id: 2, username: "bob", avatar: null },
          attachments: [],
        },
      },
    });
    expect(mockCallback).toHaveBeenCalledWith({ success: true });
  });

  it("unpins successfully and emits summary plus messageId", async () => {
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        message: {
          findFirst: jest.fn(),
        },
        conversationPin: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          count: jest.fn().mockResolvedValue(0),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      }),
    );

    await mockSocket._trigger("unpinMessage", { conversationId: 1, messageId: 10 }, mockCallback);

    expect(mockSocket.join).toHaveBeenCalledWith("conversation_1");
    expect(mockIo.to).toHaveBeenCalledWith("conversation_1");
    expect(mockIo._mockEmit).toHaveBeenCalledWith("messageUnpinned", {
      conversationId: 1,
      messageId: 10,
      pinnedCount: 0,
      latestPinnedMessage: null,
    });
    expect(mockCallback).toHaveBeenCalledWith({ success: true });
  });

  it("rejects unpin when the pin does not exist", async () => {
    prisma.conversationPin.findUnique.mockResolvedValue(null);

    await mockSocket._trigger("unpinMessage", { conversationId: 1, messageId: 10 }, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith({
      success: false,
      code: "PIN_NOT_FOUND",
      error: "Pin not found.",
    });
    expect(mockIo._mockEmit).not.toHaveBeenCalled();
  });
});
