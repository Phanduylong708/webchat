import { findOrCreatePrivateConversation } from "../../api/services/conversation.service.js";
import { deleteCloudAssetBestEffort } from "../../api/services/media.service.js";
import { prisma } from "../../shared/prisma.js";
import { verifyMembership } from "../helpers/helpers.js";
import { getConversationRoom, getUserRoom } from "../helpers/helpers.js";
import { getConversationPinState, registerPinMessageHandlers } from "./pin-message.handler.js";
import {
  parseSendMessagePayload,
  parseEditMessagePayload,
  parseDeleteMessagePayload,
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

      const {
        conversationId,
        recipientId,
        trimmedContent,
        hasContent,
        attachmentIds,
        hasAttachments,
        replyToMessageId,
      } = parsed.data;

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
      // Validate Reply
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

      // ── Atomic transaction ────────────────────────────────────────────────
      const message = await prisma.$transaction(async (tx) => {
        if (replyToMessageId !== null) {
          const replyTarget = await tx.message.findUnique({
            where: { id: replyToMessageId },
            select: { id: true, deletedAt: true },
          });

          if (!replyTarget || replyTarget.deletedAt !== null) {
            throw Object.assign(new Error("Reply target not found."), { code: "REPLY_TO_NOT_FOUND" });
          }
        }

        const messageType = hasAttachments ? "IMAGE" : "TEXT";

        const result = await tx.message.create({
          data: {
            conversationId: currentConversationId,
            senderId: currentUserId,
            content: hasContent ? trimmedContent : null,
            messageType,
            replyToMessageId: replyToMessageId ?? null,
          },
          include: {
            sender: { select: { id: true, username: true, avatar: true } },
            replyTo: {
              select: {
                id: true,
                content: true,
                messageType: true,
                sender: { select: { id: true, username: true, avatar: true } },
              },
            },
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

      const parsed = parseEditMessagePayload(payload);
      if (!parsed.ok) return callback(parsed.error);

      const { conversationId, messageId, trimmedContent } = parsed.data;
      const currentUserId = socket.data.user.id;

      const isMember = await verifyMembership(currentUserId, conversationId);
      if (!isMember) {
        return callback(ackError("NOT_A_MEMBER", "You are not a member of this conversation."));
      }

      const existing = await prisma.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          messageType: true,
          createdAt: true,
          deletedAt: true,
        },
      });

      if (!existing || existing.conversationId !== conversationId || existing.deletedAt !== null) {
        return callback(ackError("MESSAGE_NOT_FOUND", "Message not found."));
      }
      if (existing.senderId !== currentUserId) {
        return callback(ackError("NOT_OWNER", "You can only edit your own messages."));
      }

      const now = new Date();

      let nextContent = trimmedContent;
      if (existing.messageType === "TEXT") {
        if (trimmedContent.length === 0) {
          return callback(ackError("INVALID_CONTENT", "Text content cannot be empty."));
        }
      } else if (existing.messageType === "IMAGE") {
        nextContent = trimmedContent.length === 0 ? null : trimmedContent;
      } else {
        return callback(ackError("INVALID_CONTENT", "This message type cannot be edited."));
      }

      const updatedMessage = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.message.updateMany({
          where: {
            id: messageId,
            deletedAt: null,
          },
          data: {
            content: nextContent,
            editedAt: now,
          },
        });

        if (updateResult.count !== 1) {
          return null;
        }

        return tx.message.findUnique({
          where: { id: messageId },
          include: {
            sender: { select: { id: true, username: true, avatar: true } },
            replyTo: {
              select: {
                id: true,
                content: true,
                messageType: true,
                sender: { select: { id: true, username: true, avatar: true } },
              },
            },
            attachments: {
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
            },
          },
        });
      });

      if (!updatedMessage) {
        return callback(ackError("MESSAGE_NOT_FOUND", "Message not found."));
      }

      if (updatedMessage.deletedAt !== null) {
        return callback(ackError("MESSAGE_NOT_FOUND", "Message not found."));
      }

      socket.join(getConversationRoom(conversationId));
      io.to(getConversationRoom(conversationId)).emit("messageUpdated", updatedMessage);
      callback({ success: true, message: updatedMessage });
    } catch (error) {
      console.error("Error handling editMessage:", error);
      callback(ackError("INTERNAL_ERROR", "Internal server error."));
    }
  });

  socket.on("deleteMessage", async (payload, callback) => {
    try {
      if (typeof callback !== "function") return;

      const parsed = parseDeleteMessagePayload(payload);
      if (!parsed.ok) return callback(parsed.error);

      const { conversationId, messageId } = parsed.data;
      const currentUserId = socket.data.user.id;

      const isMember = await verifyMembership(currentUserId, conversationId);
      if (!isMember) {
        return callback(ackError("NOT_A_MEMBER", "You are not a member of this conversation."));
      }

      const targetMessage = await prisma.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          deletedAt: true,
          attachments: {
            select: {
              publicId: true,
            },
          },
        },
      });

      if (!targetMessage || targetMessage.conversationId !== conversationId || targetMessage.deletedAt !== null) {
        return callback(ackError("MESSAGE_NOT_FOUND", "Message not found."));
      }
      if (targetMessage.senderId !== currentUserId) {
        return callback(ackError("NOT_OWNER", "You can only delete your own messages."));
      }

      const beforeLast = await prisma.message.findFirst({
        where: { conversationId, deletedAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true },
      });

      const now = new Date();
      const deleteResult = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.message.updateMany({
          where: {
            id: messageId,
            deletedAt: null,
          },
          data: { deletedAt: now },
        });

        if (updateResult.count !== 1) {
          return { deleted: false, pinSummary: null };
        }

        await tx.message.updateMany({
          where: { replyToMessageId: messageId },
          data: { replyToMessageId: null },
        });

        const removedPinResult = await tx.conversationPin.deleteMany({
          where: {
            conversationId,
            messageId,
          },
        });

        if (removedPinResult.count === 1) {
          return {
            deleted: true,
            pinSummary: await getConversationPinState(tx, conversationId),
          };
        }

        return { deleted: true, pinSummary: null };
      });

      if (!deleteResult.deleted) {
        return callback(ackError("MESSAGE_NOT_FOUND", "Message not found."));
      }

      const payloadToEmit = {
        conversationId,
        messageId,
      };

      if (deleteResult.pinSummary) {
        payloadToEmit.pinSummary = deleteResult.pinSummary;
      }

      if (beforeLast?.id === messageId) {
        const nextLastMessage = await prisma.message.findFirst({
          where: { conversationId, deletedAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: {
            sender: { select: { id: true, username: true, avatar: true } },
            replyTo: {
              select: {
                id: true,
                content: true,
                messageType: true,
                sender: { select: { id: true, username: true, avatar: true } },
              },
            },
            attachments: {
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
            },
          },
        });

        payloadToEmit.nextLastMessage = nextLastMessage ?? null;
      }

      socket.join(getConversationRoom(conversationId));
      io.to(getConversationRoom(conversationId)).emit("messageDeleted", payloadToEmit);
      callback({ success: true });

      const publicIds = targetMessage.attachments
        .map((attachment) => attachment.publicId)
        .filter((publicId) => typeof publicId === "string" && publicId.length > 0);
      if (publicIds.length > 0) {
        void Promise.allSettled(publicIds.map((publicId) => deleteCloudAssetBestEffort(publicId)));
      }
    } catch (error) {
      console.error("Error handling deleteMessage:", error);
      callback(ackError("INTERNAL_ERROR", "Internal server error."));
    }
  });
  registerPinMessageHandlers(io, socket);

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
