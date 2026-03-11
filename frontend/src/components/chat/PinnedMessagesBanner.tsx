import { ChevronRight, Pin } from "lucide-react";
import type { PinSummary } from "@/types/chat.type";
import { toPinnedPreviewLabel } from "@/utils/pin.util";

type PinnedMessagesBannerProps = {
  pinSummary: PinSummary | null | undefined;
  onClick: () => void;
};

export default function PinnedMessagesBanner({
  pinSummary,
  onClick,
}: PinnedMessagesBannerProps): React.JSX.Element | null {
  if (!pinSummary || pinSummary.pinnedCount <= 0) {
    return null;
  }

  const label =
    pinSummary.pinnedCount === 1 ? "1 pinned message" : `${pinSummary.pinnedCount} pinned messages`;
  const previewText = toPinnedPreviewLabel(pinSummary.latestPinnedMessage?.previewText);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-center gap-3 overflow-hidden bg-muted/40 px-4 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Open pinned messages"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />

      <span aria-hidden className="relative flex w-10 shrink-0 items-center justify-center">
        <Pin className="size-[18px] rotate-[-14deg] text-primary" strokeWidth={2.3} />
      </span>

      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold capitalize leading-tight text-foreground">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-sm leading-tight text-muted-foreground">
          {previewText}
        </span>
      </span>

      <ChevronRight className="relative size-[18px] shrink-0 text-muted-foreground/90" aria-hidden />
    </button>
  );
}
