import { serializeLatestPinnedMessage } from "../../api/services/conversation.service.js";
import { prisma } from "../../shared/prisma.js";
import { verifyMembership, getConversationRoom } from "../helpers/helpers.js";
import { parsePinMessagePayload, ackError } from "../helpers/chat-message.util.js";

const PINNED_ITEM_SELECT = {
  messageId: true,
  conversationId: true,
  pinnedAt: true,
  pinnedBy: {
    select: { id: true, username: true, avatar: true },
  },
  message: {
    select: {
      id: true,
      content: true,
      messageType: true,
      createdAt: true,
      sender: {
        select: { id: true, username: true, avatar: true },
      },
      attachments: {
        take: 1,
        select: {
          id: true,
          url: true,
          mimeType: true,
          originalFileName: true,
        },
      },
    },
  },
};

const PIN_SUMMARY_SELECT = {
  pinnedAt: true,
  message: {
    select: {
      id: true,
      content: true,
      messageType: true,
      attachments: {
        take: 1,
        select: { mimeType: true },
      },
    },
  },
};

function canManagePins(conversation, currentUserId) {
  if (conversation.type === "PRIVATE") {
    return true;
  }

  return conversation.pinPermission !== "CREATOR_ONLY" || conversation.creatorId === currentUserId;
}

function serializePinnedItem(pin) {
  return {
    messageId: pin.messageId,
    conversationId: pin.conversationId,
    pinnedAt: pin.pinnedAt.toISOString(),
    pinnedBy: pin.pinnedBy,
    message: {
      id: pin.message.id,
      content: pin.message.content,
      messageType: pin.message.messageType,
      createdAt: pin.message.createdAt.toISOString(),
      sender: pin.message.sender,
      attachments: pin.message.attachments,
    },
  };
}

async function getConversationPinState(tx, conversationId) {
  const [pinnedCount, latestPin] = await Promise.all([
    tx.conversationPin.count({
      where: {
        conversationId,
        message: { deletedAt: null },
      },
    }),
    tx.conversationPin.findFirst({
      where: {
        conversationId,
        message: { deletedAt: null },
      },
      orderBy: [{ pinnedAt: "desc" }, { id: "desc" }],
      select: PIN_SUMMARY_SELECT,
    }),
  ]);

  return {
    pinnedCount,
    latestPinnedMessage: serializeLatestPinnedMessage(latestPin),
  };
}

function registerPinMessageHandlers(io, socket) {
  socket.on("pinMessage", async (payload, callback) => {
    try {
      if (typeof callback !== "function") return;

      const parsed = parsePinMessagePayload(payload);
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
          deletedAt: true,
        },
      });

      if (!targetMessage || targetMessage.conversationId !== conversationId || targetMessage.deletedAt !== null) {
        return callback(ackError("MESSAGE_NOT_FOUND", "Message not found."));
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          type: true,
          creatorId: true,
          pinPermission: true,
        },
      });

      if (!conversation || !canManagePins(conversation, currentUserId)) {
        return callback(
          ackError("NO_PIN_PERMISSION", "You do not have permission to manage pins in this conversation."),
        );
      }

      const pinResult = await prisma.$transaction(async (tx) => {
        const liveMessage = await tx.message.findFirst({
          where: {
            id: messageId,
            conversationId,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (!liveMessage) {
          throw Object.assign(new Error("Message not found."), {
            code: "MESSAGE_NOT_FOUND",
          });
        }

        const existingPin = await tx.conversationPin.findUnique({
          where: {
            conversationId_messageId: {
              conversationId,
              messageId,
            },
          },
          select: { id: true },
        });

        if (existingPin) {
          throw Object.assign(new Error("Message is already pinned."), {
            code: "MESSAGE_ALREADY_PINNED",
          });
        }

        const existingPinnedCount = await tx.conversationPin.count({
          where: {
            conversationId,
            message: { deletedAt: null },
          },
        });

        if (existingPinnedCount >= 10) {
          throw Object.assign(new Error("Conversation pin limit reached."), {
            code: "PIN_LIMIT_REACHED",
          });
        }

        const createdPin = await tx.conversationPin.create({
          data: {
            conversationId,
            messageId,
            pinnedByUserId: currentUserId,
          },
          select: PINNED_ITEM_SELECT,
        });

        const pinState = await getConversationPinState(tx, conversationId);
        if (pinState.pinnedCount > 10) {
          throw Object.assign(new Error("Conversation pin limit reached."), {
            code: "PIN_LIMIT_REACHED",
          });
        }

        return {
          ...pinState,
          pinnedItem: serializePinnedItem(createdPin),
        };
      });

      socket.join(getConversationRoom(conversationId));
      io.to(getConversationRoom(conversationId)).emit("messagePinned", {
        conversationId,
        pinnedCount: pinResult.pinnedCount,
        latestPinnedMessage: pinResult.latestPinnedMessage,
        pinnedItem: pinResult.pinnedItem,
      });
      callback({ success: true });
    } catch (error) {
      if (error.code === "MESSAGE_NOT_FOUND") {
        return callback(ackError("MESSAGE_NOT_FOUND", error.message));
      }
      if (error.code === "MESSAGE_ALREADY_PINNED") {
        return callback(ackError("MESSAGE_ALREADY_PINNED", error.message));
      }
      if (error.code === "PIN_LIMIT_REACHED") {
        return callback(ackError("PIN_LIMIT_REACHED", error.message));
      }
      if (error.code === "P2002") {
        return callback(ackError("MESSAGE_ALREADY_PINNED", "Message is already pinned."));
      }
      console.error("Error handling pinMessage:", error);
      callback(ackError("INTERNAL_ERROR", "Internal server error."));
    }
  });

  socket.on("unpinMessage", async (payload, callback) => {
    try {
      if (typeof callback !== "function") return;

      const parsed = parsePinMessagePayload(payload);
      if (!parsed.ok) return callback(parsed.error);

      const { conversationId, messageId } = parsed.data;
      const currentUserId = socket.data.user.id;

      const isMember = await verifyMembership(currentUserId, conversationId);
      if (!isMember) {
        return callback(ackError("NOT_A_MEMBER", "You are not a member of this conversation."));
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          type: true,
          creatorId: true,
          pinPermission: true,
        },
      });

      if (!conversation || !canManagePins(conversation, currentUserId)) {
        return callback(
          ackError("NO_PIN_PERMISSION", "You do not have permission to manage pins in this conversation."),
        );
      }

      const existingPin = await prisma.conversationPin.findUnique({
        where: {
          conversationId_messageId: {
            conversationId,
            messageId,
          },
        },
        select: { id: true },
      });

      if (!existingPin) {
        return callback(ackError("PIN_NOT_FOUND", "Pin not found."));
      }

      const pinState = await prisma.$transaction(async (tx) => {
        const deleteResult = await tx.conversationPin.deleteMany({
          where: {
            conversationId,
            messageId,
          },
        });

        if (deleteResult.count !== 1) {
          throw Object.assign(new Error("Pin not found."), {
            code: "PIN_NOT_FOUND",
          });
        }

        return getConversationPinState(tx, conversationId);
      });

      socket.join(getConversationRoom(conversationId));
      io.to(getConversationRoom(conversationId)).emit("messageUnpinned", {
        conversationId,
        messageId,
        pinnedCount: pinState.pinnedCount,
        latestPinnedMessage: pinState.latestPinnedMessage,
      });
      callback({ success: true });
    } catch (error) {
      if (error.code === "PIN_NOT_FOUND") {
        return callback(ackError("PIN_NOT_FOUND", error.message));
      }
      console.error("Error handling unpinMessage:", error);
      callback(ackError("INTERNAL_ERROR", "Internal server error."));
    }
  });
}

export { registerPinMessageHandlers, getConversationPinState };
