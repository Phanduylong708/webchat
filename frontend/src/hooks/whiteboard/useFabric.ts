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
  EDITING_BORDER_COLOR,
  INITIAL_SHAPE_STATE,
} from "@/hooks/whiteboard/utils/whiteboard.config";
import {
  serializePath,
  serializeShape,
  serializeTextbox,
  createShapeObject,
  createLine,
  createTextbox,
  isShapeTool,
  computeBoundingBox,
  getObjectId,
  getTransformPatch,
} from "@/hooks/whiteboard/utils/whiteboard.utils";

export function useFabric({ activeTool, activeColor, onAdd, onUpdate, onDelete, setActiveTool }: UseFabricOptions): UseFabricReturn {
  const canvas = useRef<fabric.Canvas | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const shapeStateRef = useRef<ShapeCreationState>({ ...INITIAL_SHAPE_STATE });
  const pendingTextboxesRef = useRef<Set<string>>(new Set());

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

    // Exit text editing when switching away from text tool
    const active = fabricCanvas.getActiveObject();
    if (activeTool !== "text" && activeTool !== "select" && active instanceof fabric.Textbox && active.isEditing) {
      active.exitEditing();
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
    }

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
    } else if (activeTool === "eraser") {
      fabricCanvas.selection = false;
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
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

      Object.assign(shapeStateRef.current, INITIAL_SHAPE_STATE);
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
      Object.assign(shapeStateRef.current, INITIAL_SHAPE_STATE);
    };
  }, [activeTool, activeColor, onAdd, isReady]);

  useEffect(() => {
    const fabricCanvas = canvas.current;
    if (!fabricCanvas) return;

    const pendingTextboxes = pendingTextboxesRef.current;

    const handleTextMouseDown = (e: fabric.TPointerEventInfo) => {
      if (activeTool !== "text") return;

      if (e.target) return;

      const pointer = fabricCanvas.getScenePoint(e.e);
      const textbox = createTextbox(pointer.x, pointer.y, activeColor);
      const objectId = crypto.randomUUID();

      (textbox as fabric.Textbox & { objectId: string }).objectId = objectId;
      pendingTextboxes.add(objectId);

      fabricCanvas.add(textbox);
      fabricCanvas.setActiveObject(textbox);
      textbox.enterEditing();
      textbox.selectAll();
      fabricCanvas.requestRenderAll();

      // Switch back to select tool immediately after creation to prevent accidental double-creation
      if (setActiveTool) {
        setActiveTool("select");
      }
    };

    const handleTextDblClick = (e: fabric.TPointerEventInfo) => {
      const target = e.target;
      if (!target || target.type !== "textbox") return;

      const textbox = target as fabric.Textbox;
      fabricCanvas.setActiveObject(textbox);
      textbox.enterEditing();
      textbox.selectAll();
    };

    const handleEditingEntered = (e: { target: fabric.FabricObject }) => {
      const textbox = e.target as fabric.Textbox;
      textbox.set({ borderColor: EDITING_BORDER_COLOR });
      fabricCanvas.requestRenderAll();
    };

    const handleEditingExited = (e: { target: fabric.FabricObject }) => {
      const textbox = e.target as fabric.Textbox;
      const objectId = (textbox as fabric.Textbox & { objectId?: string }).objectId;

      textbox.set({ borderColor: SELECTION_BORDER_COLOR });

      if (!textbox.text || textbox.text.trim() === "") {
        fabricCanvas.remove(textbox);
        if (objectId) {
          if (pendingTextboxes.has(objectId)) {
            pendingTextboxes.delete(objectId);
          } else if (onDelete) {
            onDelete(objectId);
          }
        }
        fabricCanvas.requestRenderAll();
        return;
      }

      if (objectId) {
        if (pendingTextboxes.has(objectId)) {
          pendingTextboxes.delete(objectId);
          if (onAdd) {
            const serialized = serializeTextbox(textbox, objectId);
            onAdd(serialized);
          }
        } else if (onUpdate) {
          onUpdate(objectId, {
            text: textbox.text,
            width: textbox.width,
            height: textbox.height,
          });
        }
      }

      fabricCanvas.requestRenderAll();
    };

    fabricCanvas.on("mouse:down", handleTextMouseDown);
    fabricCanvas.on("mouse:dblclick", handleTextDblClick);
    fabricCanvas.on("text:editing:entered", handleEditingEntered);
    fabricCanvas.on("text:editing:exited", handleEditingExited);

    return () => {
      fabricCanvas.off("mouse:down", handleTextMouseDown);
      fabricCanvas.off("mouse:dblclick", handleTextDblClick);
      fabricCanvas.off("text:editing:entered", handleEditingEntered);
      fabricCanvas.off("text:editing:exited", handleEditingExited);
    };
  }, [activeTool, activeColor, onAdd, onUpdate, onDelete, isReady]);

  // Step 7: Selection mode - object:modified handler
  useEffect(() => {
    const fabricCanvas = canvas.current;
    if (!fabricCanvas) return;

    const handleObjectModified = (e: fabric.ModifiedEvent) => {
      const target = e.target;
      if (!target || !onUpdate) return;

      // Handle multi-select (ActiveSelection)
      if (target.type === "activeSelection") {
        const selection = target as fabric.ActiveSelection;
        selection.getObjects().forEach((obj) => {
          const objectId = getObjectId(obj);
          if (objectId) {
            const patch = getTransformPatch(obj);
            onUpdate(objectId, patch);
          }
        });
        return;
      }

      const objectId = getObjectId(target);
      if (!objectId) return;

      const patch = getTransformPatch(target);
      onUpdate(objectId, patch);
    };

    fabricCanvas.on("object:modified", handleObjectModified);

    return () => {
      fabricCanvas.off("object:modified", handleObjectModified);
    };
  }, [onUpdate, isReady]);

  // Step 7: Eraser mode - click to delete object
  useEffect(() => {
    const fabricCanvas = canvas.current;
    if (!fabricCanvas || activeTool !== "eraser") return;

    const handleEraserClick = (e: fabric.TPointerEventInfo) => {
      const target = e.target;
      if (!target) return;

      const objectId = getObjectId(target);
      fabricCanvas.remove(target);
      fabricCanvas.requestRenderAll();

      if (objectId && onDelete) {
        const pendingTextboxes = pendingTextboxesRef.current;
        if (pendingTextboxes.has(objectId)) {
          pendingTextboxes.delete(objectId);
        } else {
          onDelete(objectId);
        }
      }
    };

    fabricCanvas.on("mouse:down", handleEraserClick);

    return () => {
      fabricCanvas.off("mouse:down", handleEraserClick);
    };
  }, [activeTool, onDelete, isReady]);

  // Step 7: Delete/Backspace key handler
  useEffect(() => {
    const fabricCanvas = canvas.current;
    if (!fabricCanvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;

      // Skip if focus is on input/textarea/contenteditable
      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const activeObject = fabricCanvas.getActiveObject();
      if (!activeObject) return;

      // Get all selected objects (works for single and multi-select)
      const objects = fabricCanvas.getActiveObjects().slice();
      if (!objects.length) return;

      // Skip if any textbox is being edited
      if (objects.some((o) => o instanceof fabric.Textbox && o.isEditing)) {
        return;
      }

      // Prevent browser back navigation / default behavior
      e.preventDefault();

      const pendingTextboxes = pendingTextboxesRef.current;

      const deleteObject = (obj: fabric.FabricObject) => {
        const objectId = getObjectId(obj);
        fabricCanvas.remove(obj);

        if (objectId && onDelete) {
          if (pendingTextboxes.has(objectId)) {
            pendingTextboxes.delete(objectId);
          } else {
            onDelete(objectId);
          }
        }
      };

      fabricCanvas.discardActiveObject();
      objects.forEach(deleteObject);
      fabricCanvas.requestRenderAll();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onDelete, isReady]);

  return {
    canvas,
    isReady,
    canvasCallbackRef,
  };
}
