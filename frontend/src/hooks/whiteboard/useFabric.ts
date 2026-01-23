import { useEffect, useRef, useState, useCallback } from "react";
import * as fabric from "fabric";
import type { UseFabricOptions, UseFabricReturn, ShapeToolType, ShapeCreationState } from "@/types/whiteboard.type";
import {
  CANVAS_OPTIONS,
  SELECTION_COLOR,
  SELECTION_BORDER_COLOR,
  SELECTION_LINE_WIDTH,
  OBJECT_CONTROL_CONFIG,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_SHAPE_SIZE,
  DRAG_THRESHOLD,
} from "@/hooks/whiteboard/utils/whiteboard.config";
import {
  serializePath,
  serializeShape,
  createShapeObject,
  createLine,
  isShapeTool,
  computeBoundingBox,
} from "@/hooks/whiteboard/utils/whiteboard.utils";

const initialShapeState: ShapeCreationState = {
  isCreating: false,
  startX: 0,
  startY: 0,
  hasDragged: false,
  previewObject: null,
  objectId: "",
};

export function useFabric({ activeTool, activeColor, onAdd }: UseFabricOptions): UseFabricReturn {
  const canvas = useRef<fabric.Canvas | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const shapeStateRef = useRef<ShapeCreationState>({ ...initialShapeState });

  const canvasCallbackRef = useCallback((element: HTMLCanvasElement | null) => {
    setCanvasElement(element);
  }, []);

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

  useEffect(() => {
    const fabricCanvas = canvas.current;
    if (!fabricCanvas) return;

    const isPenTool = activeTool === "pen";
    const isShapeToolActive = isShapeTool(activeTool);

    fabricCanvas.isDrawingMode = isPenTool;

    if (isPenTool) {
      fabricCanvas.selection = false;
      const brush = new fabric.PencilBrush(fabricCanvas);
      brush.color = activeColor;
      brush.width = DEFAULT_STROKE_WIDTH;
      fabricCanvas.freeDrawingBrush = brush;
    } else if (isShapeToolActive) {
      fabricCanvas.selection = false;
    } else {
      fabricCanvas.selection = activeTool === "select";
    }
  }, [activeTool, activeColor, isReady]);

  useEffect(() => {
    const fabricCanvas = canvas.current;
    if (!fabricCanvas) return;

    const handlePathCreated = (e: { path: fabric.FabricObject }) => {
      const path = e.path as fabric.Path;
      if (!path) return;

      const objectId = crypto.randomUUID();
      (path as fabric.Path & { objectId: string }).objectId = objectId;

      if ("contentHint" in path) {
        (path as fabric.Path & { contentHint: string }).contentHint = "text";
      }

      if (onAdd) {
        const serialized = serializePath(path);
        onAdd(serialized);
      }
    };

    fabricCanvas.on("path:created", handlePathCreated);

    return () => {
      fabricCanvas.off("path:created", handlePathCreated);
    };
  }, [onAdd, isReady]);

  useEffect(() => {
    const fabricCanvas = canvas.current;
    if (!fabricCanvas || !isShapeTool(activeTool)) return;

    const currentTool = activeTool as ShapeToolType;
    const state = shapeStateRef.current;

    const handleMouseDown = (e: fabric.TPointerEventInfo) => {
      const pointer = fabricCanvas.getScenePoint(e.e);

      state.isCreating = true;
      state.startX = pointer.x;
      state.startY = pointer.y;
      state.hasDragged = false;
      state.objectId = crypto.randomUUID();
      state.previewObject = null;
    };

    const handleMouseMove = (e: fabric.TPointerEventInfo) => {
      if (!state.isCreating) return;

      const pointer = fabricCanvas.getScenePoint(e.e);
      const dx = pointer.x - state.startX;
      const dy = pointer.y - state.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (!state.hasDragged && distance > DRAG_THRESHOLD) {
        state.hasDragged = true;
      }

      if (state.hasDragged) {
        if (!state.previewObject) {
          if (currentTool === "line") {
            state.previewObject = createLine(state.startX, state.startY, pointer.x, pointer.y, activeColor);
          } else {
            const { minX, minY, width, height } = computeBoundingBox(state.startX, state.startY, pointer.x, pointer.y);
            state.previewObject = createShapeObject(currentTool, minX, minY, width, height, activeColor);
          }
          fabricCanvas.add(state.previewObject);
        } else {
          if (currentTool === "line") {
            const line = state.previewObject as fabric.Line;
            line.set({ x1: state.startX, y1: state.startY, x2: pointer.x, y2: pointer.y });
          } else {
            const { minX, minY, width, height } = computeBoundingBox(state.startX, state.startY, pointer.x, pointer.y);
            if (currentTool === "ellipse") {
              const ellipse = state.previewObject as fabric.Ellipse;
              ellipse.set({ left: minX, top: minY, rx: width / 2, ry: height / 2 });
            } else {
              state.previewObject.set({ left: minX, top: minY, width, height });
            }
          }
          fabricCanvas.requestRenderAll();
        }
      }
    };

    const handleMouseUp = () => {
      if (!state.isCreating) return;

      let finalObject: fabric.FabricObject;

      if (state.hasDragged && state.previewObject) {
        finalObject = state.previewObject;
      } else {
        if (currentTool === "line") {
          finalObject = createLine(state.startX, state.startY, state.startX + DEFAULT_SHAPE_SIZE, state.startY, activeColor);
        } else {
          const centerX = state.startX - DEFAULT_SHAPE_SIZE / 2;
          const centerY = state.startY - DEFAULT_SHAPE_SIZE / 2;
          finalObject = createShapeObject(currentTool, centerX, centerY, DEFAULT_SHAPE_SIZE, DEFAULT_SHAPE_SIZE, activeColor);
        }
        fabricCanvas.add(finalObject);
      }

      finalObject.set({ selectable: true, evented: true });
      (finalObject as fabric.FabricObject & { objectId: string }).objectId = state.objectId;
      fabricCanvas.setActiveObject(finalObject);
      fabricCanvas.requestRenderAll();

      if (onAdd) {
        const serialized = serializeShape(finalObject, state.objectId);
        onAdd(serialized);
      }

      shapeStateRef.current = { ...initialShapeState };
    };

    fabricCanvas.on("mouse:down", handleMouseDown);
    fabricCanvas.on("mouse:move", handleMouseMove);
    fabricCanvas.on("mouse:up", handleMouseUp);

    return () => {
      fabricCanvas.off("mouse:down", handleMouseDown);
      fabricCanvas.off("mouse:move", handleMouseMove);
      fabricCanvas.off("mouse:up", handleMouseUp);

      if (state.previewObject && !state.previewObject.selectable) {
        fabricCanvas.remove(state.previewObject);
      }
      shapeStateRef.current = { ...initialShapeState };
    };
  }, [activeTool, activeColor, onAdd, isReady]);

  return {
    canvas,
    isReady,
    canvasCallbackRef,
  };
}
