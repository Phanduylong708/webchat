import type { AttachmentItem, PinnedMessageItem } from "@/types/chat.type";
import { queryClient } from "@/lib/queryClient";
import { conversationPinsQueryKey } from "@/hooks/queries/pins";

export function sortPinnedItemsDesc(items: PinnedMessageItem[]): PinnedMessageItem[] {
  return [...items].sort((left, right) => {
    const byPinnedAt = right.pinnedAt.localeCompare(left.pinnedAt);
    if (byPinnedAt !== 0) return byPinnedAt;
    return right.messageId - left.messageId;
  });
}

export function mapPinnedAttachments(
  attachments: AttachmentItem[] | undefined,
): PinnedMessageItem["message"]["attachments"] {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  return attachments.map((attachment) => ({
    id: attachment.id,
    url: attachment.url,
    mimeType: attachment.mimeType,
    originalFileName: attachment.originalFileName,
  }));
}

export function patchPinnedItemsCache(
  conversationId: number,
  updater: (items: PinnedMessageItem[]) => PinnedMessageItem[],
): void {
  const key = conversationPinsQueryKey(conversationId);
  const existing = queryClient.getQueryData<PinnedMessageItem[]>(key);
  if (existing === undefined) {
    return;
  }

  queryClient.setQueryData<PinnedMessageItem[] | undefined>(key, (items) => {
    if (!items) return items;
    return updater(items);
  });
}

export function toPinnedPreviewLabel(previewText: string | null | undefined): string {
  if (!previewText) {
    return "Pinned message";
  }

  if (previewText === "image") return "Image";
  if (previewText === "video") return "Video";
  if (previewText === "file") return "File";
  return previewText;
}
