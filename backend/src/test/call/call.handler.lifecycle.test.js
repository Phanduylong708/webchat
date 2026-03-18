/* global jest, describe, it, expect, beforeEach, afterEach */

import {
  handleCall,
  callSessions,
  CALL_TIMEOUT_MS,
} from "../../sockets/handlers/call.handler.js";
import {
  createMockSocket,
  createMockIo,
  createMockCallback,
} from "../mocks/socket.mock.js";

jest.mock("../../sockets/helpers/helpers.js", () => ({
  verifyMembership: jest.fn(),
  getConversationRoom: jest.fn((id) => `conversation_${id}`),
  getCallRoom: jest.fn((id) => `call_${id}`),
  maybeAck: jest.fn((cb, payload) => cb && cb(payload)),
  getConversationType: jest.fn().mockResolvedValue("direct"),
  getConversationMemberIds: jest.fn().mockResolvedValue([1, 2]),
  getOnlineUserIds: jest.fn((_io, ids) => ids),
}));

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "mock-uuid-1234"),
}));

import { verifyMembership } from "../../sockets/helpers/helpers.js";

describe("call.handler lifecycle", () => {
  let mockIo;
  let mockSocket;
  let mockCallback;

  beforeEach(() => {
    jest.useFakeTimers();
    mockIo = createMockIo();
    mockSocket = createMockSocket({
      user: { id: 1, username: "alice", email: "alice@test.com" },
    });
    mockCallback = createMockCallback();

    callSessions.clear();
    jest.clearAllMocks();
    verifyMembership.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    callSessions.clear();
  });

  describe("call:initiate", () => {
    beforeEach(() => {
      handleCall(mockIo, mockSocket);
    });

    it("should fail if conversationId is missing", async () => {
      await mockSocket._trigger("call:initiate", {}, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: "conversationId is required",
      });
    });

    it("should fail if conversationId is invalid", async () => {
      await mockSocket._trigger(
        "call:initiate",
        { conversationId: "abc" },
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: "conversationId is required",
      });
    });

    it("should fail if user is unauthorized", async () => {
      mockSocket.data.user = null;

      await mockSocket._trigger(
        "call:initiate",
        { conversationId: 1 },
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: "Unauthorized",
      });
    });

    it("should fail if user is not a member of conversation", async () => {
      verifyMembership.mockResolvedValue(false);

      await mockSocket._trigger(
        "call:initiate",
        { conversationId: 1 },
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: "Not a member of this conversation",
      });
    });

    it("should create call session and notify conversation room", async () => {
      const roomEmit = jest.fn();
      mockSocket.to.mockReturnValue({ emit: roomEmit });

      await mockSocket._trigger(
        "call:initiate",
        { conversationId: 1 },
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        callId: "mock-uuid-1234",
      });

      expect(callSessions.has("mock-uuid-1234")).toBe(true);
      const session = callSessions.get("mock-uuid-1234");
      expect(session.conversationId).toBe(1);
      expect(session.initiatorId).toBe(1);
      expect(session.status).toBe("ringing");

      expect(mockSocket.to).toHaveBeenCalledWith("conversation_1");
      expect(roomEmit).toHaveBeenCalledWith("call:initiate", {
        callId: "mock-uuid-1234",
        conversationId: 1,
        caller: mockSocket.data.user,
        timeoutMs: CALL_TIMEOUT_MS,
      });
    });

    it("should use provided callId if given", async () => {
      await mockSocket._trigger(
        "call:initiate",
        { conversationId: 1, callId: "custom-id" },
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        callId: "custom-id",
      });
      expect(callSessions.has("custom-id")).toBe(true);
    });

    it("should trigger timeout after CALL_TIMEOUT_MS", async () => {
      await mockSocket._trigger(
        "call:initiate",
        { conversationId: 1 },
        mockCallback
      );

      expect(callSessions.has("mock-uuid-1234")).toBe(true);

      jest.advanceTimersByTime(CALL_TIMEOUT_MS);

      expect(callSessions.has("mock-uuid-1234")).toBe(false);
      expect(mockIo._mockEmit).toHaveBeenCalledWith("call:end", {
        callId: "mock-uuid-1234",
        conversationId: 1,
        reason: "timeout",
      });
    });
  });

  describe("call:join", () => {
    beforeEach(async () => {
      handleCall(mockIo, mockSocket);
      await mockSocket._trigger(
        "call:initiate",
        { conversationId: 1 },
        mockCallback
      );
      jest.clearAllMocks();
    });

    it("should do nothing if callId is missing", async () => {
      await mockSocket._trigger("call:join", {});

      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it("should do nothing if call does not exist", async () => {
      await mockSocket._trigger("call:join", { callId: "non-existent" });

      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it("should do nothing if user is not authorized", async () => {
      mockSocket.data.user = null;

      await mockSocket._trigger("call:join", { callId: "mock-uuid-1234" });

      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it("should do nothing if user is not a member of conversation", async () => {
      verifyMembership.mockResolvedValue(false);

      await mockSocket._trigger("call:join", { callId: "mock-uuid-1234" });

      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it("should join call room and return call context", async () => {
      const joinCallback = createMockCallback();

      await mockSocket._trigger(
        "call:join",
        { callId: "mock-uuid-1234" },
        joinCallback
      );

      expect(mockSocket.join).toHaveBeenCalledWith("call_mock-uuid-1234");
      expect(mockIo.to).toHaveBeenCalledWith("call_mock-uuid-1234");
      expect(mockIo._mockEmit).toHaveBeenCalledWith(
        "call:join",
        expect.objectContaining({
          callId: "mock-uuid-1234",
          user: expect.objectContaining({ id: 1, username: "alice" }),
        })
      );

      expect(joinCallback).toHaveBeenCalledWith({
        success: true,
        conversationId: 1,
        conversationType: "direct",
        isInitiator: true,
        participants: [
          {
            id: 1,
            username: "alice",
            avatar: null,
            audioMuted: true,
            videoMuted: true,
            videoSource: "camera",
          },
        ],
        status: "ringing",
      });
    });

    it("should clear timeout and change status when non-initiator joins", async () => {
      const mockSocket2 = createMockSocket({
        user: { id: 2, username: "bob", email: "bob@test.com" },
      });
      handleCall(mockIo, mockSocket2);

      const session = callSessions.get("mock-uuid-1234");
      expect(session.status).toBe("ringing");
      expect(session.timeoutHandle).not.toBeNull();

      await mockSocket2._trigger("call:join", { callId: "mock-uuid-1234" });

      expect(session.status).toBe("active");
      expect(session.timeoutHandle).toBeNull();
    });

    it("should not clear timeout if initiator joins again", async () => {
      const session = callSessions.get("mock-uuid-1234");
      const originalTimeout = session.timeoutHandle;

      await mockSocket._trigger("call:join", { callId: "mock-uuid-1234" });

      expect(session.status).toBe("ringing");
      expect(session.timeoutHandle).toBe(originalTimeout);
    });
  });

  describe("call:leave", () => {
    beforeEach(async () => {
      handleCall(mockIo, mockSocket);
      await mockSocket._trigger(
        "call:initiate",
        { conversationId: 1 },
        mockCallback
      );
      await mockSocket._trigger("call:join", { callId: "mock-uuid-1234" });
      jest.clearAllMocks();
    });

    it("should do nothing if callId is missing", async () => {
      await mockSocket._trigger("call:leave", {});

      expect(mockSocket.leave).not.toHaveBeenCalled();
    });

    it("should remove user from call and emit leave event", async () => {
      const mockSocket2 = createMockSocket({
        user: { id: 2, username: "bob", email: "bob@test.com" },
      });
      handleCall(mockIo, mockSocket2);
      await mockSocket2._trigger("call:join", { callId: "mock-uuid-1234" });

      const mockSocket3 = createMockSocket({
        user: { id: 3, username: "charlie", email: "charlie@test.com" },
      });
      handleCall(mockIo, mockSocket3);
      await mockSocket3._trigger("call:join", { callId: "mock-uuid-1234" });
      jest.clearAllMocks();

      const roomEmit = jest.fn();
      mockSocket.to.mockReturnValue({ emit: roomEmit });

      await mockSocket._trigger("call:leave", { callId: "mock-uuid-1234" });

      expect(mockSocket.leave).toHaveBeenCalledWith("call_mock-uuid-1234");

      const session = callSessions.get("mock-uuid-1234");
      expect(session).toBeDefined();
      expect(session.participants.has(1)).toBe(false);
      expect(session.participants.size).toBe(2);

      expect(mockSocket.to).toHaveBeenCalledWith("call_mock-uuid-1234");
      expect(roomEmit).toHaveBeenCalledWith("call:leave", {
        callId: "mock-uuid-1234",
        conversationId: 1,
        user: mockSocket.data.user,
        reason: "leave",
      });
    });

    it("should auto-end call when less than 2 participants remain", async () => {
      await mockSocket._trigger("call:leave", { callId: "mock-uuid-1234" });

      expect(callSessions.has("mock-uuid-1234")).toBe(false);
      expect(mockIo._mockEmit).toHaveBeenCalledWith("call:end", {
        callId: "mock-uuid-1234",
        conversationId: 1,
        reason: "insufficient_participants",
      });
    });
  });

  describe("call:end", () => {
    beforeEach(async () => {
      handleCall(mockIo, mockSocket);
      await mockSocket._trigger(
        "call:initiate",
        { conversationId: 1 },
        mockCallback
      );
      jest.clearAllMocks();
    });

    it("should do nothing if callId is missing", async () => {
      await mockSocket._trigger("call:end", {});

      expect(callSessions.has("mock-uuid-1234")).toBe(true);
    });

    it("should do nothing if call does not exist", async () => {
      await mockSocket._trigger("call:end", { callId: "non-existent" });

      expect(callSessions.has("mock-uuid-1234")).toBe(true);
    });

    it("should end call for all participants and cleanup", async () => {
      await mockSocket._trigger("call:end", { callId: "mock-uuid-1234" });

      expect(callSessions.has("mock-uuid-1234")).toBe(false);
      expect(mockIo.to).toHaveBeenCalledWith("call_mock-uuid-1234");
      expect(mockIo.to).toHaveBeenCalledWith("conversation_1");
      expect(mockIo._mockEmit).toHaveBeenCalledWith("call:end", {
        callId: "mock-uuid-1234",
        conversationId: 1,
        reason: "ended",
      });
    });
  });

  describe("disconnect", () => {
    it("should leave all calls user was participating in", async () => {
      handleCall(mockIo, mockSocket);
      await mockSocket._trigger(
        "call:initiate",
        { conversationId: 1 },
        mockCallback
      );
      await mockSocket._trigger("call:join", { callId: "mock-uuid-1234" });
      jest.clearAllMocks();

      await mockSocket._trigger("disconnect");

      expect(mockSocket.leave).toHaveBeenCalledWith("call_mock-uuid-1234");
    });

    it("should do nothing if user is not authorized", async () => {
      handleCall(mockIo, mockSocket);
      await mockSocket._trigger(
        "call:initiate",
        { conversationId: 1 },
        mockCallback
      );
      mockSocket.data.user = null;
      jest.clearAllMocks();

      await mockSocket._trigger("disconnect");

      expect(mockSocket.leave).not.toHaveBeenCalled();
    });

    it("should cleanup multiple calls if user was participating in multiple", async () => {
      handleCall(mockIo, mockSocket);
      await mockSocket._trigger(
        "call:initiate",
        { conversationId: 1, callId: "call-1" },
        mockCallback
      );
      await mockSocket._trigger("call:join", { callId: "call-1" });

      await mockSocket._trigger(
        "call:initiate",
        { conversationId: 2, callId: "call-2" },
        mockCallback
      );
      await mockSocket._trigger("call:join", { callId: "call-2" });

      jest.clearAllMocks();

      await mockSocket._trigger("disconnect");

      expect(mockSocket.leave).toHaveBeenCalledTimes(2);
      expect(mockSocket.leave).toHaveBeenCalledWith("call_call-1");
      expect(mockSocket.leave).toHaveBeenCalledWith("call_call-2");
    });
  });
});
