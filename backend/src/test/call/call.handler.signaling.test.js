/* global jest, describe, it, expect, beforeEach, afterEach */

import { handleCall, callSessions } from "../../sockets/handlers/call.handler.js";
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

describe("call.handler signaling", () => {
  let mockIo;
  let mockSocket;
  let mockCallback;

  beforeEach(async () => {
    jest.useFakeTimers();
    mockIo = createMockIo();
    mockSocket = createMockSocket({
      user: { id: 1, username: "alice", email: "alice@test.com" },
    });
    mockCallback = createMockCallback();

    callSessions.clear();
    jest.clearAllMocks();
    verifyMembership.mockResolvedValue(true);

    handleCall(mockIo, mockSocket);
    await mockSocket._trigger(
      "call:initiate",
      { conversationId: 1 },
      mockCallback
    );
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    callSessions.clear();
  });

  describe("call:offer", () => {
    it("should do nothing if callId is missing", async () => {
      await mockSocket._trigger("call:offer", {});

      expect(mockSocket.to).not.toHaveBeenCalled();
    });

    it("should do nothing if call does not exist", async () => {
      await mockSocket._trigger("call:offer", { callId: "non-existent" });

      expect(mockSocket.to).not.toHaveBeenCalled();
    });

    it("should relay offer to other call participants", async () => {
      const roomEmit = jest.fn();
      mockSocket.to.mockReturnValue({ emit: roomEmit });

      const payload = { callId: "mock-uuid-1234", sdp: "offer-sdp" };
      await mockSocket._trigger("call:offer", payload);

      expect(mockSocket.to).toHaveBeenCalledWith("call_mock-uuid-1234");
      expect(roomEmit).toHaveBeenCalledWith("call:offer", payload);
    });
  });

  describe("call:answer", () => {
    it("should do nothing if callId is missing", async () => {
      await mockSocket._trigger("call:answer", {});

      expect(mockSocket.to).not.toHaveBeenCalled();
    });

    it("should do nothing if call does not exist", async () => {
      await mockSocket._trigger("call:answer", { callId: "non-existent" });

      expect(mockSocket.to).not.toHaveBeenCalled();
    });

    it("should relay answer to other call participants", async () => {
      const roomEmit = jest.fn();
      mockSocket.to.mockReturnValue({ emit: roomEmit });

      const payload = { callId: "mock-uuid-1234", sdp: "answer-sdp" };
      await mockSocket._trigger("call:answer", payload);

      expect(mockSocket.to).toHaveBeenCalledWith("call_mock-uuid-1234");
      expect(roomEmit).toHaveBeenCalledWith("call:answer", payload);
    });
  });

  describe("call:candidate", () => {
    it("should do nothing if callId is missing", async () => {
      await mockSocket._trigger("call:candidate", {});

      expect(mockSocket.to).not.toHaveBeenCalled();
    });

    it("should do nothing if call does not exist", async () => {
      await mockSocket._trigger("call:candidate", { callId: "non-existent" });

      expect(mockSocket.to).not.toHaveBeenCalled();
    });

    it("should relay candidate to other call participants", async () => {
      const roomEmit = jest.fn();
      mockSocket.to.mockReturnValue({ emit: roomEmit });

      const payload = { callId: "mock-uuid-1234", candidate: "ice-candidate" };
      await mockSocket._trigger("call:candidate", payload);

      expect(mockSocket.to).toHaveBeenCalledWith("call_mock-uuid-1234");
      expect(roomEmit).toHaveBeenCalledWith("call:candidate", payload);
    });
  });
});
