import type { ReplyToPreview, SendMessageInput } from "@/types/chat.type";

export type ReplyTargetLike = { replyTo: ReplyToPreview } | null | undefined;

export function getReplyToFromTarget(replyTarget: ReplyTargetLike): ReplyToPreview | null {
  return replyTarget?.replyTo ?? null;
}

export function buildReplySendFields(
  replyTo: ReplyToPreview | null,
): Pick<SendMessageInput, "replyToMessageId" | "_replyTo"> {
  return {
    replyToMessageId: replyTo?.id,
    _replyTo: replyTo ?? undefined,
  };
}

export function toUserMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}
