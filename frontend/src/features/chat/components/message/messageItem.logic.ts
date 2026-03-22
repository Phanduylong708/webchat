import type { DisplayMessage } from "@/types/chat.type";

type FindReplyTargetRowParams = {
  scrollContainerId: string;
  replyToMessageId: number;
};

type ApplyReplyHighlightParams = {
  targetRow: HTMLElement;
  highlightSelector: string;
  classes: string[];
  timeoutMs: number;
  timeoutAttr: string;
};

export function getReplyPreviewText(message: DisplayMessage): string {
  const replyTo = message.replyTo;
  if (!replyTo) return "Message unavailable";

  if (replyTo.messageType === "TEXT") {
    const text = replyTo.content?.trim();
    return text ? text : "Message";
  }
  if (replyTo.messageType === "IMAGE") {
    const caption = replyTo.content?.trim();
    return caption ? `Image - ${caption}` : "Image";
  }
  return "Message";
}

export function findReplyTargetRow({
  scrollContainerId,
  replyToMessageId,
}: FindReplyTargetRowParams): HTMLElement | null {
  const scrollContainer = document.getElementById(scrollContainerId);
  if (!scrollContainer) return null;
  return scrollContainer.querySelector<HTMLElement>(`[data-message-id="${replyToMessageId}"]`);
}

export function applyReplyHighlight({
  targetRow,
  highlightSelector,
  classes,
  timeoutMs,
  timeoutAttr,
}: ApplyReplyHighlightParams): void {
  const highlightTarget = targetRow.querySelector<HTMLElement>(highlightSelector);
  if (!highlightTarget) return;

  const existingTimeoutId = highlightTarget.getAttribute(timeoutAttr);
  if (existingTimeoutId) {
    window.clearTimeout(Number(existingTimeoutId));
  }

  highlightTarget.classList.remove(...classes);
  void highlightTarget.offsetWidth;
  highlightTarget.classList.add(...classes);

  const timeoutId = window.setTimeout(() => {
    highlightTarget.classList.remove(...classes);
    highlightTarget.removeAttribute(timeoutAttr);
  }, timeoutMs);
  highlightTarget.setAttribute(timeoutAttr, String(timeoutId));
}
