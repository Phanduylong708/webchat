/* global describe, it, expect */

import { parseSendMessagePayload } from "../../sockets/helpers/chat-message.util.js";

describe("chat-message.util parseSendMessagePayload (reply)", () => {
  it("should reject invalid replyToMessageId", () => {
    const result = parseSendMessagePayload({
      conversationId: 1,
      content: "hello",
      replyToMessageId: "abc",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        success: false,
        code: "INVALID_REPLY_TO_ID",
        error: "replyToMessageId must be a valid positive integer.",
      },
    });
  });

  it("should reject recipientId with replyToMessageId", () => {
    const result = parseSendMessagePayload({
      recipientId: 2,
      content: "hello",
      replyToMessageId: 10,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        success: false,
        code: "REPLY_TO_UNSUPPORTED_FOR_RECIPIENT",
        error: "replyToMessageId is only supported with conversationId.",
      },
    });
  });

  it("should return parsed replyToMessageId when provided", () => {
    const result = parseSendMessagePayload({
      conversationId: 1,
      content: "hello",
      replyToMessageId: "42",
    });

    expect(result.ok).toBe(true);
    expect(result.data.replyToMessageId).toBe(42);
  });

  it("should return null replyToMessageId when omitted", () => {
    const result = parseSendMessagePayload({
      conversationId: 1,
      content: "hello",
    });

    expect(result.ok).toBe(true);
    expect(result.data.replyToMessageId).toBeNull();
  });
});
