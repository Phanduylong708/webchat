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

export { derivePreviewText, serializeLatestPinnedMessage, buildPinSummary };
