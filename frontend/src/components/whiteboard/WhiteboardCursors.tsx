import type { RemoteCursorPresence } from "@/hooks/whiteboard/useCursorPresence";
import { cn } from "@/lib/utils";

interface WhiteboardCursorsProps {
  cursors: RemoteCursorPresence[];
  className?: string;
}

function CursorArrow({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="20"
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color }}
    >
      <path
        d="M1 1L7.5 18L9.5 10.5L16 9L1 1Z"
        fill="currentColor"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WhiteboardCursors({ cursors, className }: WhiteboardCursorsProps) {
  return (
    <div className={cn("absolute inset-0 pointer-events-none z-10 overflow-hidden", className)}>
      {cursors.map((cursor) => {
        if (!Number.isFinite(cursor.position.x) || !Number.isFinite(cursor.position.y)) return null;
        const isStale = cursor.staleSince !== null;

        return (
          <div
            key={cursor.userId}
            className={cn(
              "absolute transition-opacity duration-300",
              isStale ? "opacity-0" : "opacity-100",
            )}
            style={{
              left: cursor.position.x,
              top: cursor.position.y,
              transform: "translate(-1px, -1px)",
            }}
          >
            <CursorArrow color={cursor.color} />
          </div>
        );
      })}
    </div>
  );
}
