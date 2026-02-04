import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/hooks/whiteboard/utils/whiteboard.config";
import { cn } from "@/lib/utils";

interface WhiteboardCanvasProps {
  canvasCallbackRef: React.RefCallback<HTMLCanvasElement>;
  isReady: boolean;
  className?: string;
}

export function WhiteboardCanvas({ canvasCallbackRef, isReady, className }: WhiteboardCanvasProps) {
  return (
    <div className={cn("relative h-full w-full overflow-auto min-h-0", className)}>
      <div className="flex items-start justify-center p-4">
        <div className="relative inline-block border border-zinc-300 shadow-lg bg-white">
          <canvas
            ref={canvasCallbackRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block"
          />

          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-100/80">
              <div className="flex items-center gap-2 text-zinc-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
                <span>Loading canvas...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
