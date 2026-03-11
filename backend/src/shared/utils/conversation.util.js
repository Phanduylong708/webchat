import { prisma } from "../prisma.js";

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

/**
 * Derive a preview-text key from a last message.
 * Returns content if present; otherwise a mime-family key ("image"/"video"/"file").
 */
function derivePreviewText(message) {
  if (message.content && message.content.trim().length > 0) {
    return message.content;
  }
  const firstAttachment = message.attachments?.[0];
  if (firstAttachment?.mimeType) {
    if (firstAttachment.mimeType.startsWith("image/")) return "image";
    if (firstAttachment.mimeType.startsWith("video/")) return "video";
    return "file";
  }
  switch (message.messageType) {
    case "IMAGE":
      return "image";
    case "VIDEO":
      return "video";
    case "FILE":
      return "file";
    default:
      return "";
  }
}

function serializeLatestPinnedMessage(latestPin) {
  if (!latestPin) {
    return null;
  }

  return {
    id: latestPin.message.id,
    previewText: derivePreviewText(latestPin.message),
    messageType: latestPin.message.messageType,
    pinnedAt: latestPin.pinnedAt.toISOString(),
  };
}

function buildPinSummary(pinnedCount, latestPin) {
  if (!pinnedCount) {
    return null;
  }

  return {
    pinnedCount,
    latestPinnedMessage: serializeLatestPinnedMessage(latestPin),
  };
}

/**
 * Queries the current pin state for a conversation within a transaction context.
 * Safe to call with either a Prisma transaction client or the global prisma client.
 */
async function getConversationPinState(tx = prisma, conversationId) {
  const [pinnedCount, latestPin] = await Promise.all([
    tx.conversationPin.count({
      where: { conversationId, message: { deletedAt: null } },
    }),
    tx.conversationPin.findFirst({
      where: { conversationId, message: { deletedAt: null } },
      orderBy: [{ pinnedAt: "desc" }, { id: "desc" }],
      select: PIN_SUMMARY_SELECT,
    }),
  ]);

  return {
    pinnedCount,
    latestPinnedMessage: serializeLatestPinnedMessage(latestPin),
  };
}

export { derivePreviewText, serializeLatestPinnedMessage, buildPinSummary, getConversationPinState };
