import { useEffect, useRef, useState, useCallback } from "react";
import * as fabric from "fabric";
import type { UseFabricOptions, UseFabricReturn } from "@/types/whiteboard.type";
import {
  CANVAS_OPTIONS,
  SELECTION_COLOR,
  SELECTION_BORDER_COLOR,
  SELECTION_LINE_WIDTH,
  OBJECT_CONTROL_CONFIG,
} from "@/hooks/whiteboard/utils/whiteboard.config";
import { useFabricEvents } from "./useFabricEvents";

export function useFabric(options: UseFabricOptions): UseFabricReturn {
  const { activeTool, activeColor, onAdd, onUpdate, onDelete, setActiveTool } = options;
  
  const canvas = useRef<fabric.Canvas | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);

  /**
   * 1. Canvas Ref Callback
   * Used to capture the HTML element from the DOM
   */
  const canvasCallbackRef = useCallback((element: HTMLCanvasElement | null) => {
    setCanvasElement(element);
  }, []);

  /**
   * 2. Initialization & Cleanup
   * Handles the creation and destruction of the Fabric.js canvas instance
   */
  useEffect(() => {
    if (!canvasElement) {
      if (canvas.current) {
        canvas.current.dispose();
        canvas.current = null;
        setIsReady(false);
      }
      return;
    }

    if (canvas.current) return;

    const fabricCanvas = new fabric.Canvas(canvasElement, CANVAS_OPTIONS);

    // Apply global canvas styles
    fabricCanvas.selectionColor = SELECTION_COLOR;
    fabricCanvas.selectionBorderColor = SELECTION_BORDER_COLOR;
    fabricCanvas.selectionLineWidth = SELECTION_LINE_WIDTH;
    fabric.FabricObject.prototype.set(OBJECT_CONTROL_CONFIG);

    canvas.current = fabricCanvas;
    setIsReady(true);

    return () => {
      if (canvas.current) {
        canvas.current.dispose();
        canvas.current = null;
        setIsReady(false);
      }
    };
  }, [canvasElement]);

  /**
   * 3. Orchestrate user interactions via useFabricEvents
   */
  useFabricEvents({
    canvas: canvas.current,
    isReady,
    activeTool,
    activeColor,
    onAdd,
    onUpdate,
    onDelete,
    setActiveTool,
  });

  return {
    canvas,
    isReady,
    canvasCallbackRef,
  };
}
