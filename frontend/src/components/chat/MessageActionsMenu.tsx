import { useCallback, useRef, useState } from "react";
import { MoreHorizontal, PencilLine } from "lucide-react";

import type { DisplayMessage } from "@/types/chat.type";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  message: DisplayMessage;
  enabled: boolean;
  onEdit?: (message: DisplayMessage) => void;
  children: React.ReactNode;
};

const LONG_PRESS_MS = 450;

export default function MessageActionsMenu({ message, enabled, onEdit, children }: Props) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const longPressArmedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    longPressArmedRef.current = false;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      if (e.pointerType !== "touch") return;

      longPressArmedRef.current = true;
      timerRef.current = window.setTimeout(() => {
        if (!longPressArmedRef.current) return;
        setOpen(true);
      }, LONG_PRESS_MS);
    },
    [enabled]
  );

  const handlePointerCancel = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handleEdit = useCallback(() => {
    onEdit?.(message);
    setOpen(false);
  }, [message, onEdit]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          className="relative group/message"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerCancel}
          onPointerCancel={handlePointerCancel}
          onPointerMove={handlePointerCancel}
          onContextMenu={(e) => {
            if (open) e.preventDefault();
          }}
        >
          <div
            className="absolute -left-9 top-1 opacity-0 group-hover/message:opacity-100 group-focus-within/message:opacity-100 transition-opacity"
            style={{
              transitionDuration: "var(--dur-fast)",
              transitionTimingFunction: "var(--ease-out-smooth)",
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Message actions"
                className="inline-flex size-7 items-center justify-center rounded-md border border-border/80 bg-popover/70 text-muted-foreground shadow-sm backdrop-blur-sm outline-none hover:bg-popover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </PopoverTrigger>
          </div>

          {children}
        </div>
      </PopoverAnchor>

      <PopoverContent
        side="top"
        align="end"
        sideOffset={10}
        className="w-auto rounded-lg p-1 shadow-md"
      >
        <button
          type="button"
          onClick={handleEdit}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PencilLine className="size-4 text-muted-foreground" />
          <span>Edit</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
