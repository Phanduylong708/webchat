import { prisma } from "../../shared/prisma.js";
import { createHTTPError } from "../../shared/utils/error.util.js";
import { deleteCloudAssetBestEffort } from "./media.service.js";
import { getConversationPinState } from "../../shared/utils/conversation.util.js";

const ATTACHMENT_SELECT = {
  id: true,
  url: true,
  publicId: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  originalFileName: true,
  createdAt: true,
};

const REPLY_TO_SELECT = {
  id: true,
  content: true,
  messageType: true,
  sender: { select: { id: true, username: true, avatar: true } },
};

async function getMessages(conversationId, userId, before, limit) {
  const isMember = await prisma.conversationMember.findUnique({
    // Check if user is a member of the conversation
    where: {
      userId_conversationId: { userId, conversationId },
    },
  });
  if (!isMember) {
    // If not a member, throw an error
    throw createHTTPError(403, "Not a member of conversation");
  }

  const where = { conversationId, deletedAt: null }; // Prepare query conditions
  if (before) {
    // If 'before' cursor is provided, add it to the conditions
    where.id = { lt: before }; // Fetch messages with IDs less than 'before'
  }
  const messages = await prisma.message.findMany({
    // Fetch messages from the database
    where,
    orderBy: { id: "desc" }, // Order messages by ID in descending order
    take: limit + 1, // Fetch one extra message to determine if there are more messages
    include: {
      sender: { select: { id: true, username: true, avatar: true } },
      replyTo: { select: REPLY_TO_SELECT },
      attachments: { select: ATTACHMENT_SELECT },
    },
  });

  const hasMore = messages.length > limit; // Check if there are more messages to fetch
  let nextCursor = null; //if there are more messages, set the next cursor
  if (hasMore) {
    messages.pop(); // Remove the extra message used for pagination check
    nextCursor = messages[messages.length - 1].id; // Set the next cursor to the ID of the last message
  }
  messages.reverse(); // Reverse messages to have them in ascending order
  return {
    messages,
    meta: {
      // Return messages along with pagination metadata
      limit,
      hasMore,
      nextCursor,
    },
  };
}

/**
 * Creates a new message, handles attachment linking, and bumps conversation updatedAt.
 * Throws a coded Error on business rule violations (REPLY_TO_NOT_FOUND, ATTACHMENT_CONFLICT).
 */
async function createMessage(conversationId, senderId, { trimmedContent, hasContent, attachmentIds, hasAttachments, replyToMessageId }) {
  return prisma.$transaction(async (tx) => {
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

    const message = await tx.message.create({
      data: {
        conversationId,
        senderId,
        content: hasContent ? trimmedContent : null,
        messageType,
        replyToMessageId: replyToMessageId ?? null,
      },
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
        replyTo: { select: REPLY_TO_SELECT },
      },
    });

    if (hasAttachments) {
      // TOCTOU guard: re-validate inside transaction with strict conditions
      const updateResult = await tx.messageAttachment.updateMany({
        where: {
          id: { in: attachmentIds },
          uploadedByUserId: senderId,
          status: "PENDING",
          messageId: null,
        },
        data: { messageId: message.id, status: "ATTACHED" },
      });

      if (updateResult.count !== attachmentIds.length) {
        throw Object.assign(
          new Error("Attachment conflict: one or more attachments were already used."),
          { code: "ATTACHMENT_CONFLICT" },
        );
      }

      message.attachments = await tx.messageAttachment.findMany({
        where: { messageId: message.id },
        select: ATTACHMENT_SELECT,
      });
    } else {
      message.attachments = [];
    }

    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  });
}

/**
 * Edits a message's content. Validates ownership and message type rules.
 * Throws a coded Error on business rule violations.
 */
async function editMessage(messageId, conversationId, senderId, trimmedContent) {
  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      messageType: true,
      deletedAt: true,
    },
  });

  if (!existing || existing.conversationId !== conversationId || existing.deletedAt !== null) {
    throw Object.assign(new Error("Message not found."), { code: "MESSAGE_NOT_FOUND" });
  }
  if (existing.senderId !== senderId) {
    throw Object.assign(new Error("You can only edit your own messages."), { code: "NOT_OWNER" });
  }

  let nextContent = trimmedContent;
  if (existing.messageType === "TEXT") {
    if (trimmedContent.length === 0) {
      throw Object.assign(new Error("Text content cannot be empty."), { code: "INVALID_CONTENT" });
    }
  } else if (existing.messageType === "IMAGE") {
    nextContent = trimmedContent.length === 0 ? null : trimmedContent;
  } else {
    throw Object.assign(new Error("This message type cannot be edited."), { code: "INVALID_CONTENT" });
  }

  const updatedMessage = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.message.updateMany({
      where: { id: messageId, deletedAt: null },
      data: { content: nextContent, editedAt: new Date() },
    });

    if (updateResult.count !== 1) {
      return null;
    }

    return tx.message.findUnique({
      where: { id: messageId },
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
        replyTo: { select: REPLY_TO_SELECT },
        attachments: { select: ATTACHMENT_SELECT },
      },
    });
  });

  if (!updatedMessage || updatedMessage.deletedAt !== null) {
    throw Object.assign(new Error("Message not found."), { code: "MESSAGE_NOT_FOUND" });
  }

  return updatedMessage;
}

/**
 * Soft-deletes a message, nullifies reply references, removes any associated pin,
 * and schedules cloud asset cleanup. Returns the deleted message payload for broadcasting.
 * Throws a coded Error on business rule violations.
 */
async function deleteMessage(messageId, conversationId, senderId) {
  const targetMessage = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      deletedAt: true,
      attachments: { select: { publicId: true } },
    },
  });

  if (!targetMessage || targetMessage.conversationId !== conversationId || targetMessage.deletedAt !== null) {
    throw Object.assign(new Error("Message not found."), { code: "MESSAGE_NOT_FOUND" });
  }
  if (targetMessage.senderId !== senderId) {
    throw Object.assign(new Error("You can only delete your own messages."), { code: "NOT_OWNER" });
  }

  const beforeLast = await prisma.message.findFirst({
    where: { conversationId, deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });

  const deleteResult = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.message.updateMany({
      where: { id: messageId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (updateResult.count !== 1) {
      return { deleted: false, pinSummary: null };
    }

    await tx.message.updateMany({
      where: { replyToMessageId: messageId },
      data: { replyToMessageId: null },
    });

    const removedPinResult = await tx.conversationPin.deleteMany({
      where: { conversationId, messageId },
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
    throw Object.assign(new Error("Message not found."), { code: "MESSAGE_NOT_FOUND" });
  }

  let nextLastMessage = null;
  if (beforeLast?.id === messageId) {
    nextLastMessage = await prisma.message.findFirst({
      where: { conversationId, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
        replyTo: { select: REPLY_TO_SELECT },
        attachments: { select: ATTACHMENT_SELECT },
      },
    });
  }

  // Fire-and-forget cloud cleanup
  const publicIds = targetMessage.attachments
    .map((a) => a.publicId)
    .filter((id) => typeof id === "string" && id.length > 0);
  if (publicIds.length > 0) {
    void Promise.allSettled(publicIds.map((id) => deleteCloudAssetBestEffort(id)));
  }

  return {
    pinSummary: deleteResult.pinSummary,
    nextLastMessage: beforeLast?.id === messageId ? (nextLastMessage ?? null) : undefined,
  };
}

export { getMessages, createMessage, editMessage, deleteMessage };
