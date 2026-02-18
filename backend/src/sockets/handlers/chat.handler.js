import { findOrCreatePrivateConversation } from "../../api/services/conversation.service.js";
import { prisma } from "../../shared/prisma.js";
import { verifyMembership } from "../helpers/helpers.js";
import { getConversationRoom, getUserRoom } from "../helpers/helpers.js";
import {
  parseSendMessagePayload,
  ackError,
  validateAttachmentsPreflight,
} from "../helpers/chat-message.util.js";

async function handleChatMessage(io, socket) {
  socket.on("sendMessage", async (payload, callback) => {
    try {
      if (typeof callback !== "function") return;

      // ── Parse & validate payload ──────────────────────────────────────────
      const parsed = parseSendMessagePayload(payload);
      if (!parsed.ok) return callback(parsed.error);

      const { conversationId, recipientId, trimmedContent, hasContent, attachmentIds, hasAttachments } =
        parsed.data;

      const currentUserId = socket.data.user.id;
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

      // ── Pre-flight attachment validation ──────────────────────────────────
      if (hasAttachments) {
        const preflightError = await validateAttachmentsPreflight(attachmentIds, currentUserId);
        if (preflightError) return callback(preflightError);
      }

      // ── Atomic transaction ────────────────────────────────────────────────
      const message = await prisma.$transaction(async (tx) => {
        const messageType = hasAttachments ? "IMAGE" : "TEXT";

        const result = await tx.message.create({
          data: {
            conversationId: currentConversationId,
            senderId: currentUserId,
            content: hasContent ? trimmedContent : null,
            messageType,
          },
          include: {
            sender: { select: { id: true, username: true, avatar: true } },
          },
        });

        if (hasAttachments) {
          // TOCTOU guard: re-validate inside transaction with strict conditions
          const updateResult = await tx.messageAttachment.updateMany({
            where: {
              id: { in: attachmentIds },
              uploadedByUserId: currentUserId,
              status: "PENDING",
              messageId: null,
            },
            data: { messageId: result.id, status: "ATTACHED" },
          });

          if (updateResult.count !== attachmentIds.length) {
            throw Object.assign(
              new Error("Attachment conflict: one or more attachments were already used."),
              { code: "ATTACHMENT_CONFLICT" },
            );
          }

          result.attachments = await tx.messageAttachment.findMany({
            where: { messageId: result.id },
            select: {
              id: true,
              url: true,
              publicId: true,
              mimeType: true,
              sizeBytes: true,
              width: true,
              height: true,
              originalFileName: true,
              createdAt: true,
            },
          });
        } else {
          result.attachments = [];
        }

        await tx.conversation.update({
          where: { id: currentConversationId },
          data: { updatedAt: new Date() },
        });

        return result;
      });

      // ── Broadcast + ack ───────────────────────────────────────────────────
      socket.join(getConversationRoom(currentConversationId));
      socket.to(getConversationRoom(currentConversationId)).emit("newMessage", message);
      callback({ success: true, message });
    } catch (error) {
      console.error("Error handling sendMessage:", error);
      if (error.code === "ATTACHMENT_CONFLICT") {
        return callback(ackError("ATTACHMENT_CONFLICT", error.message));
      }
      callback(ackError("INTERNAL_ERROR", "Internal server error."));
    }
  });

  // ── Typing indicators ───────────────────────────────────────────────────

  socket.on("typing:start", async (payload) => {
    try {
      const conversationId = parseInt(payload.conversationId, 10);
      if (isNaN(conversationId)) {
        console.warn("Invalid conversationId in typing:start");
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
        isTyping: true,
      });
    } catch (error) {
      console.warn("Error in typing:start handler:", error);
    }
  });

  socket.on("typing:stop", async (payload) => {
    try {
      const conversationId = parseInt(payload.conversationId, 10);
      if (isNaN(conversationId)) {
        console.warn("Invalid conversationId in typing:stop");
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
        isTyping: false,
      });
    } catch (error) {
      console.warn("Error in typing:stop handler:", error);
    }
  });
}

export { handleChatMessage };
