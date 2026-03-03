import { prisma } from "../../shared/prisma.js";

// ── ID parsing ──────────────────────────────────────────────────────────────

/**
 * Parse a value to a safe positive integer.
 * Accepts both number and numeric string (defensive for socket payloads).
 * Returns null for anything invalid or non-positive.
 */
function parseSocketInt(value) {
  if (value === null || value === undefined) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    return null;
  }
  return n;
}

// ── Payload parsing ─────────────────────────────────────────────────────────

/**
 * Parse and validate the sendMessage payload IDs, content, and attachmentIds.
 * Returns { ok, data?, error? }.
 */
function parseSendMessagePayload(payload) {
  const raw = payload ?? {};

  // Parse IDs
  const rawConversationId = raw.conversationId ?? null;
  const rawRecipientId = raw.recipientId ?? null;
  const rawReplyToMessageId = raw.replyToMessageId ?? null;

  const conversationId = rawConversationId !== null ? parseSocketInt(rawConversationId) : null;
  const recipientId = rawRecipientId !== null ? parseSocketInt(rawRecipientId) : null;
  const replyToMessageId =
    rawReplyToMessageId !== null ? parseSocketInt(rawReplyToMessageId) : null;

  if (rawConversationId !== null && conversationId === null) {
    return {
      ok: false,
      error: ackError("INVALID_CONVERSATION_ID", "conversationId must be a valid positive integer."),
    };
  }
  if (rawRecipientId !== null && recipientId === null) {
    return {
      ok: false,
      error: ackError("INVALID_RECIPIENT_ID", "recipientId must be a valid positive integer."),
    };
  }
  if (rawReplyToMessageId !== null && replyToMessageId === null) {
    return {
      ok: false,
      error: ackError("INVALID_REPLY_TO_ID", "replyToMessageId must be a valid positive integer."),
    };
  }

  // Identifier xor check
  if (conversationId !== null && recipientId !== null) {
    return {
      ok: false,
      error: ackError("AMBIGUOUS_IDENTIFIER", "Cannot specify both conversationId and recipientId."),
    };
  }
  if (conversationId === null && recipientId === null) {
    return {
      ok: false,
      error: ackError("MISSING_IDENTIFIER", "Must specify either conversationId or recipientId."),
    };
  }
  if (recipientId !== null && replyToMessageId !== null) {
    return {
      ok: false,
      error: ackError(
        "REPLY_TO_UNSUPPORTED_FOR_RECIPIENT",
        "replyToMessageId is only supported with conversationId.",
      ),
    };
  }

  // Parse attachmentIds
  const rawAttachmentIds = raw.attachmentIds ?? null;
  let attachmentIds = null;
  if (rawAttachmentIds !== null) {
    if (!Array.isArray(rawAttachmentIds)) {
      return { ok: false, error: ackError("INVALID_ATTACHMENT_IDS", "attachmentIds must be an array.") };
    }
    attachmentIds = rawAttachmentIds.map((id) => parseSocketInt(id));
    if (attachmentIds.some((id) => id === null)) {
      return {
        ok: false,
        error: ackError("INVALID_ATTACHMENT_ID", "All attachment IDs must be valid positive integers."),
      };
    }
  }

  // Content
  const content = raw.content;
  const trimmedContent = typeof content === "string" ? content.trim() : "";
  const hasContent = trimmedContent.length > 0;
  const hasAttachments = Array.isArray(attachmentIds) && attachmentIds.length > 0;

  if (!hasContent && !hasAttachments) {
    return {
      ok: false,
      error: ackError("EMPTY_MESSAGE", "Message must have content or at least one attachment."),
    };
  }

  // Phase A cap
  if (hasAttachments && attachmentIds.length > 1) {
    return {
      ok: false,
      error: ackError(
        "ATTACHMENT_LIMIT_EXCEEDED",
        "Only one attachment is allowed per message in this phase.",
      ),
    };
  }

  return {
    ok: true,
    data: {
      conversationId,
      recipientId,
      trimmedContent,
      hasContent,
      attachmentIds,
      hasAttachments,
      replyToMessageId,
    },
  };
}

/**
 * Parse and validate the editMessage payload IDs and content.
 * Returns { ok, data?, error? }.
 */
function parseEditMessagePayload(payload) {
  const raw = payload ?? {};

  const rawConversationId = raw.conversationId ?? null;
  const rawMessageId = raw.messageId ?? null;

  const conversationId = parseSocketInt(rawConversationId);
  const messageId = parseSocketInt(rawMessageId);

  if (conversationId === null) {
    return {
      ok: false,
      error: ackError("INVALID_CONVERSATION_ID", "conversationId must be a valid positive integer."),
    };
  }
  if (messageId === null) {
    return {
      ok: false,
      error: ackError("INVALID_MESSAGE_ID", "messageId must be a valid positive integer."),
    };
  }

  const content = raw.content;
  if (typeof content !== "string") {
    return {
      ok: false,
      error: ackError("INVALID_CONTENT", "content must be a string (can be empty)."),
    };
  }
  const trimmedContent = content.trim();

  return {
    ok: true,
    data: { conversationId, messageId, trimmedContent },
  };
}

// ── Ack helper ──────────────────────────────────────────────────────────────

/**
 * Build a canonical error ack payload.
 */
function ackError(code, error) {
  return { success: false, error, code };
}

// ── Attachment pre-flight ───────────────────────────────────────────────────

/**
 * Optimistic pre-flight validation for attachments (outside transaction).
 * Returns null on success, or an ack error payload on failure.
 */
async function validateAttachmentsPreflight(attachmentIds, currentUserId) {
  const attachments = await prisma.messageAttachment.findMany({
    where: { id: { in: attachmentIds } },
    select: { id: true, uploadedByUserId: true, status: true, messageId: true },
  });

  if (attachments.length !== attachmentIds.length) {
    return ackError("ATTACHMENT_NOT_FOUND", "One or more attachments not found.");
  }

  for (const attachment of attachments) {
    if (attachment.uploadedByUserId !== currentUserId) {
      return ackError("ATTACHMENT_FORBIDDEN", "You do not own one or more attachments.");
    }
    if (attachment.status !== "PENDING") {
      return ackError("ATTACHMENT_INVALID_STATUS", "One or more attachments are not in PENDING status.");
    }
    if (attachment.messageId !== null) {
      return ackError("ATTACHMENT_ALREADY_USED", "One or more attachments are already linked to a message.");
    }
  }

  return null;
}

export {
  parseSocketInt,
  parseSendMessagePayload,
  parseEditMessagePayload,
  ackError,
  validateAttachmentsPreflight,
};
