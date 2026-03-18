import { findOrCreatePrivateConversation } from "../../api/services/conversation.service.js";
import { createMessage, editMessage, deleteMessage } from "../../api/services/message.service.js";
import { prisma } from "../../shared/prisma.js";
import { verifyMembership, getConversationRoom, getUserRoom } from "../helpers/helpers.js";
import { registerPinMessageHandlers } from "./pin-message.handler.js";
import {
  parseSendMessagePayload,
  parseEditMessagePayload,
  parseDeleteMessagePayload,
  ackError,
  validateAttachmentsPreflight,
} from "../helpers/chat-message.util.js";
import { checkRateLimit } from "../../shared/middlewares/rateLimiter.middleware.js";

async function handleChatMessage(io, socket) {
  socket.on("sendMessage", async (payload, callback) => {
    try {
      if (typeof callback !== "function") return;

      const currentUserId = socket.data.user.id;
      const { allowed, retryAfter } = await checkRateLimit({
        key: `rl:sendMessage:${currentUserId}`,
        limit: 20,
        windowSec: 10,
      });
      if (!allowed) {
        return callback(ackError("RATE_LIMITED", `Too many requests. Try again in ${retryAfter}s.`));
      }

      // ── Parse & validate payload ──────────────────────────────────────────
      const parsed = parseSendMessagePayload(payload);
      if (!parsed.ok) return callback(parsed.error);

      const {
        conversationId,
        recipientId,
        trimmedContent,
        hasContent,
        attachmentIds,
        hasAttachments,
        replyToMessageId,
      } = parsed.data;

      let currentConversationId = conversationId;

      // ── Resolve conversation ──────────────────────────────────────────────
      if (recipientId !== null) {
        try {
          const privateConversationId = await findOrCreatePrivateConversation(currentUserId, recipientId);
          currentConversationId = privateConversationId;
          io.in(getUserRoom(recipientId)).socketsJoin(getConversationRoom(currentConversationId));
        } catch (err) {
          console.error("Error finding/creating private conversation:", err);
          return callback(ackError("CONVERSATION_ERROR", err.message));
        }
      }

      if (conversationId !== null) {
        const isMember = await verifyMembership(currentUserId, currentConversationId);
        if (!isMember) {
          return callback(ackError("NOT_A_MEMBER", "You are not a member of this conversation."));
        }
      }

      // ── Validate reply target ─────────────────────────────────────────────
      if (replyToMessageId !== null) {
        const replyTarget = await prisma.message.findUnique({
          where: { id: replyToMessageId },
          select: { id: true, conversationId: true, deletedAt: true },
        });
        if (!replyTarget || replyTarget.deletedAt !== null) {
          return callback(ackError("REPLY_TO_NOT_FOUND", "Reply target not found."));
        }
        if (replyTarget.conversationId !== currentConversationId) {
          return callback(
            ackError("REPLY_TO_WRONG_CONVERSATION", "Reply target must be in the same conversation."),
          );
        }
      }

      // ── Pre-flight attachment validation ──────────────────────────────────
      if (hasAttachments) {
        const preflightError = await validateAttachmentsPreflight(attachmentIds, currentUserId);
        if (preflightError) return callback(preflightError);
      }

      // ── Create message via service ────────────────────────────────────────
      const message = await createMessage(currentConversationId, currentUserId, {
        trimmedContent,
        hasContent,
        attachmentIds,
        hasAttachments,
        replyToMessageId,
      });

      // ── Broadcast + ack ───────────────────────────────────────────────────
      socket.join(getConversationRoom(currentConversationId));
      socket.to(getConversationRoom(currentConversationId)).emit("newMessage", message);
      callback({ success: true, message });
    } catch (error) {
      if (error.code === "ATTACHMENT_CONFLICT") {
        return callback(ackError("ATTACHMENT_CONFLICT", error.message));
      }
      if (error.code === "REPLY_TO_NOT_FOUND") {
        return callback(ackError("REPLY_TO_NOT_FOUND", error.message));
      }
      console.error("Error handling sendMessage:", error);
      callback(ackError("INTERNAL_ERROR", "Internal server error."));
    }
  });

  socket.on("editMessage", async (payload, callback) => {
    try {
      if (typeof callback !== "function") return;

      const currentUserId = socket.data.user.id;
      const { allowed, retryAfter } = await checkRateLimit({
        key: `rl:editMessage:${currentUserId}`,
        limit: 10,
        windowSec: 10,
      });
      if (!allowed) {
        return callback(ackError("RATE_LIMITED", `Too many requests. Try again in ${retryAfter}s.`));
      }

      const parsed = parseEditMessagePayload(payload);
      if (!parsed.ok) return callback(parsed.error);

      const { conversationId, messageId, trimmedContent } = parsed.data;

      const isMember = await verifyMembership(currentUserId, conversationId);
      if (!isMember) {
        return callback(ackError("NOT_A_MEMBER", "You are not a member of this conversation."));
      }

      const updatedMessage = await editMessage(messageId, conversationId, currentUserId, trimmedContent);

      socket.join(getConversationRoom(conversationId));
      io.to(getConversationRoom(conversationId)).emit("messageUpdated", updatedMessage);
      callback({ success: true, message: updatedMessage });
    } catch (error) {
      if (error.code === "MESSAGE_NOT_FOUND") {
        return callback(ackError("MESSAGE_NOT_FOUND", error.message));
      }
      if (error.code === "NOT_OWNER") {
        return callback(ackError("NOT_OWNER", error.message));
      }
      if (error.code === "INVALID_CONTENT") {
        return callback(ackError("INVALID_CONTENT", error.message));
      }
      console.error("Error handling editMessage:", error);
      callback(ackError("INTERNAL_ERROR", "Internal server error."));
    }
  });

  socket.on("deleteMessage", async (payload, callback) => {
    try {
      if (typeof callback !== "function") return;

      const currentUserId = socket.data.user.id;
      const { allowed, retryAfter } = await checkRateLimit({
        key: `rl:deleteMessage:${currentUserId}`,
        limit: 10,
        windowSec: 10,
      });
      if (!allowed) {
        return callback(ackError("RATE_LIMITED", `Too many requests. Try again in ${retryAfter}s.`));
      }

      const parsed = parseDeleteMessagePayload(payload);
      if (!parsed.ok) return callback(parsed.error);

      const { conversationId, messageId } = parsed.data;

      const isMember = await verifyMembership(currentUserId, conversationId);
      if (!isMember) {
        return callback(ackError("NOT_A_MEMBER", "You are not a member of this conversation."));
      }

      const result = await deleteMessage(messageId, conversationId, currentUserId);

      const payloadToEmit = { conversationId, messageId };
      if (result.pinSummary) {
        payloadToEmit.pinSummary = result.pinSummary;
      }
      if (result.nextLastMessage !== undefined) {
        payloadToEmit.nextLastMessage = result.nextLastMessage;
      }

      socket.join(getConversationRoom(conversationId));
      io.to(getConversationRoom(conversationId)).emit("messageDeleted", payloadToEmit);
      callback({ success: true });
    } catch (error) {
      if (error.code === "MESSAGE_NOT_FOUND") {
        return callback(ackError("MESSAGE_NOT_FOUND", error.message));
      }
      if (error.code === "NOT_OWNER") {
        return callback(ackError("NOT_OWNER", error.message));
      }
      console.error("Error handling deleteMessage:", error);
      callback(ackError("INTERNAL_ERROR", "Internal server error."));
    }
  });

  registerPinMessageHandlers(io, socket);

  // ── Typing indicators ───────────────────────────────────────────────────

  async function handleTypingEvent(payload, isTyping) {
    try {
      const conversationId = parseInt(payload.conversationId, 10);
      if (isNaN(conversationId)) {
        console.warn("Invalid conversationId in typing event");
        return;
      }
      const currentUserId = socket.data.user.id;
      const currentUsername = socket.data.user.username;
      const isMember = await verifyMembership(currentUserId, conversationId);
      if (!isMember) {
        console.warn(`User ${currentUserId} is not a member of conversation ${conversationId}`);
        return;
      }
      socket.to(getConversationRoom(conversationId)).emit("userTyping", {
        userId: currentUserId,
        username: currentUsername,
        conversationId,
        isTyping,
      });
    } catch (error) {
      console.warn("Error in typing handler:", error);
    }
  }

  socket.on("typing:start", (payload) => handleTypingEvent(payload, true));
  socket.on("typing:stop", (payload) => handleTypingEvent(payload, false));
}

export { handleChatMessage };
