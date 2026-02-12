import { useRef, useState, useEffect, useCallback } from "react";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/hooks/whiteboard/utils/whiteboard.config";
import type { RemoteCursorPresence } from "@/hooks/whiteboard/useCursorPresence";
import type { CursorPosition } from "@/types/whiteboard.type";
import { WhiteboardCursors } from "@/components/whiteboard/WhiteboardCursors";
import { cn } from "@/lib/utils";

interface WhiteboardCanvasProps {
  canvasCallbackRef: React.RefCallback<HTMLCanvasElement>;
  isReady: boolean;
  remoteCursors: RemoteCursorPresence[];
  emitCursor: (position: CursorPosition | null) => void;
  className?: string;
}

interface DragSeed {
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
}

function isEditableTarget(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea") return true;
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  return false;
}

export function WhiteboardCanvas({ canvasCallbackRef, isReady, remoteCursors, emitCursor, className }: WhiteboardCanvasProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const isSpacePressedRef = useRef(false);
  const isPanningRef = useRef(false);
  const isPointerInRegionRef = useRef(false);
  const dragSeedRef = useRef<DragSeed>({ startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const pointerCaptureIdRef = useRef<number | null>(null);
  const lastEmittedNullRef = useRef(true);
  const emitCursorRef = useRef(emitCursor);

  useEffect(() => {
    isSpacePressedRef.current = isSpacePressed;
  }, [isSpacePressed]);

  useEffect(() => {
    isPanningRef.current = isPanning;
  }, [isPanning]);

  useEffect(() => {
    emitCursorRef.current = emitCursor;
  }, [emitCursor]);

  // B3.1: Cursor feedback for pan mode
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let cursorValue: string | null = null;
    if (isPanning) {
      cursorValue = "grabbing";
    } else if (isSpacePressed) {
      cursorValue = "grab";
    }

    if (cursorValue) {
      container.style.cursor = cursorValue;
      const canvases = container.querySelectorAll("canvas");
      canvases.forEach((canvas) => {
        (canvas as HTMLElement).style.cursor = cursorValue;
      });
    }

    return () => {
      container.style.cursor = "";
      const canvases = container.querySelectorAll("canvas");
      canvases.forEach((canvas) => {
        (canvas as HTMLElement).style.cursor = "";
      });
    };
  }, [isSpacePressed, isPanning]);

  const resetPanState = useCallback(() => {
    setIsSpacePressed(false);
    setIsPanning(false);
    isSpacePressedRef.current = false;
    isPanningRef.current = false;
  }, []);

  const endPan = useCallback(() => {
    setIsPanning(false);
    isPanningRef.current = false;
    if (pointerCaptureIdRef.current !== null && scrollContainerRef.current) {
      try {
        scrollContainerRef.current.releasePointerCapture(pointerCaptureIdRef.current);
      } catch {
        // Pointer capture may already be released
      }
      pointerCaptureIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      if (isEditableTarget(document.activeElement)) return;
      if (!isPointerInRegionRef.current) return;

      event.preventDefault();
      if (!isSpacePressedRef.current) {
        setIsSpacePressed(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      endPan();
      resetPanState();
    }

    function handleWindowBlur() {
      endPan();
      resetPanState();
      emitCursorRef.current(null);
      lastEmittedNullRef.current = true;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [resetPanState, endPan]);

  const computeCanvasPosition = useCallback((event: React.PointerEvent<HTMLDivElement>): CursorPosition | null => {
    const container = scrollContainerRef.current;
    if (!container) return null;
    const canvasEl = container.querySelector("canvas");
    if (!canvasEl) return null;
    const rect = canvasEl.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    return { x, y };
  }, []);

  const emitCursorPosition = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const position = computeCanvasPosition(event);
    if (position) {
      lastEmittedNullRef.current = false;
      emitCursorRef.current(position);
    } else {
      if (!lastEmittedNullRef.current) {
        emitCursorRef.current(null);
        lastEmittedNullRef.current = true;
      }
    }
  }, [computeCanvasPosition]);

  const clearCursorEmit = useCallback(() => {
    if (!lastEmittedNullRef.current) {
      emitCursorRef.current(null);
      lastEmittedNullRef.current = true;
    }
  }, []);

  const handlePointerEnter = useCallback(() => {
    isPointerInRegionRef.current = true;
  }, []);

  const handlePointerLeave = useCallback(() => {
    isPointerInRegionRef.current = false;
    clearCursorEmit();
  }, [clearCursorEmit]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.pointerType !== "mouse") return;
    if (!isSpacePressedRef.current) return;
    if (isEditableTarget(event.target as Element)) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    event.preventDefault();
    event.stopPropagation();
    setIsPanning(true);
    isPanningRef.current = true;

    dragSeedRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };

    container.setPointerCapture(event.pointerId);
    pointerCaptureIdRef.current = event.pointerId;
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    emitCursorPosition(event);

    if (!isPanningRef.current) return;

    event.preventDefault();

    const container = scrollContainerRef.current;
    if (!container) return;

    const { startX, startY, scrollLeft, scrollTop } = dragSeedRef.current;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    container.scrollLeft = scrollLeft - dx;
    container.scrollTop = scrollTop - dy;
  }, [emitCursorPosition]);

  const handlePointerUp = useCallback(() => {
    if (isPanningRef.current) {
      endPan();
    }
  }, [endPan]);

  const handlePointerCancel = useCallback(() => {
    if (isPanningRef.current) {
      endPan();
    }
    clearCursorEmit();
  }, [endPan, clearCursorEmit]);

  const handleLostPointerCapture = useCallback(() => {
    pointerCaptureIdRef.current = null;
    if (isPanningRef.current) {
      setIsPanning(false);
      isPanningRef.current = false;
    }
    clearCursorEmit();
  }, [clearCursorEmit]);

  return (
    <div
      ref={scrollContainerRef}
      className={cn("relative h-full w-full overflow-auto min-h-0 min-w-0 bg-white", className)}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDownCapture={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
    >
      <div className="w-max min-w-full">
        <div className="relative w-fit">
          <canvas ref={canvasCallbackRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block" />

          <WhiteboardCursors cursors={remoteCursors} />

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
