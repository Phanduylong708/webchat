/* global describe, it, expect */

import { parsePinMessagePayload } from "../../sockets/helpers/chat-message.util.js";

describe("chat-message.util parsePinMessagePayload", () => {
  it("rejects invalid conversationId", () => {
    const result = parsePinMessagePayload({
      conversationId: "abc",
      messageId: 10,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        success: false,
        code: "INVALID_CONVERSATION_ID",
        error: "conversationId must be a valid positive integer.",
      },
    });
  });

  it("rejects invalid messageId", () => {
    const result = parsePinMessagePayload({
      conversationId: 1,
      messageId: "abc",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        success: false,
        code: "INVALID_MESSAGE_ID",
        error: "messageId must be a valid positive integer.",
      },
    });
  });

  it("returns parsed ids for a valid payload", () => {
    const result = parsePinMessagePayload({
      conversationId: "1",
      messageId: "10",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        conversationId: 1,
        messageId: 10,
      },
    });
  });
});
