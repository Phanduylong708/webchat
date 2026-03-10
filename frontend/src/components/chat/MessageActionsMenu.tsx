import { useCallback, useEffect, useRef, useState } from "react";
import { CornerUpLeft, MoreHorizontal, PencilLine, Pin, PinOff, Trash2 } from "lucide-react";

import type { DisplayMessage } from "@/types/chat.type";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  message: DisplayMessage;
  enabled: boolean;
  onReply?: (message: DisplayMessage) => void;
  onEdit?: (message: DisplayMessage) => void;
  onDelete?: (message: DisplayMessage) => void;
  onPin?: (message: DisplayMessage) => void;
  onUnpin?: (message: DisplayMessage) => void;
  side?: "left" | "right";
  children: React.ReactNode;
};

const LONG_PRESS_MS = 450;

export default function MessageActionsMenu({
  message,
  enabled,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  side = "left",
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const longPressArmedRef = useRef(false);

  const hasActions =
    typeof onReply === "function" ||
    typeof onEdit === "function" ||
    typeof onDelete === "function" ||
    typeof onPin === "function" ||
    typeof onUnpin === "function";

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    longPressArmedRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || !hasActions) return;
      if (e.pointerType !== "touch") return;

      clearTimer();

      longPressArmedRef.current = true;
      timerRef.current = window.setTimeout(() => {
        if (!longPressArmedRef.current) return;
        clearTimer();
        setOpen(true);
      }, LONG_PRESS_MS);
    },
    [enabled, hasActions, clearTimer],
  );

  const handlePointerCancel = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handleEdit = useCallback(() => {
    onEdit?.(message);
    setOpen(false);
  }, [message, onEdit]);
  const handleReply = useCallback(() => {
    onReply?.(message);
    setOpen(false);
  }, [message, onReply]);
  const handleDelete = useCallback(() => {
    onDelete?.(message);
    setOpen(false);
  }, [message, onDelete]);
  const handlePin = useCallback(() => {
    onPin?.(message);
    setOpen(false);
  }, [message, onPin]);
  const handleUnpin = useCallback(() => {
    onUnpin?.(message);
    setOpen(false);
  }, [message, onUnpin]);

  if (!enabled || !hasActions) {
    return <>{children}</>;
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        clearTimer();
        setOpen(nextOpen);
      }}
    >
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
            className={`absolute top-1 opacity-0 group-hover/message:opacity-100 group-focus-within/message:opacity-100 transition-opacity ${
              side === "right" ? "-right-9" : "-left-9"
            }`}
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
        align={side === "right" ? "start" : "end"}
        sideOffset={10}
        className="w-auto rounded-lg p-1 shadow-md"
      >
        {onReply && (
          <button
            type="button"
            onClick={handleReply}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CornerUpLeft className="size-4 text-muted-foreground" />
            <span>Reply</span>
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={handleEdit}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PencilLine className="size-4 text-muted-foreground" />
            <span>Edit</span>
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="size-4 text-destructive" />
            <span>Delete</span>
          </button>
        )}
        {onUnpin ? (
          <button
            type="button"
            onClick={handleUnpin}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PinOff className="size-4 text-muted-foreground" />
            <span>Unpin</span>
          </button>
        ) : null}
        {!onUnpin && onPin ? (
          <button
            type="button"
            onClick={handlePin}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pin className="size-4 text-muted-foreground" />
            <span>Pin</span>
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
