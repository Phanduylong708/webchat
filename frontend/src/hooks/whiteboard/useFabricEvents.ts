import { useEffect, useRef } from "react";
import * as fabric from "fabric";
import type { 
  UseFabricOptions, 
  ShapeToolType, 
  ShapeCreationState 
} from "@/types/whiteboard.type";
import { 
  DEFAULT_STROKE_WIDTH, 
  INITIAL_SHAPE_STATE 
} from "@/hooks/whiteboard/utils/whiteboard.config";
import { isShapeTool, serializePath } from "@/hooks/whiteboard/utils/whiteboard.utils";
import * as strategies from "./whiteboard.strategies";

interface UseFabricEventsProps extends UseFabricOptions {
  canvas: fabric.Canvas | null;
  isReady: boolean;
}

export function useFabricEvents({
  canvas,
  isReady,
  activeTool,
  activeColor,
  onAdd,
  onUpdate,
  onDelete,
  setActiveTool,
}: UseFabricEventsProps) {
  const shapeStateRef = useRef<ShapeCreationState>({ ...INITIAL_SHAPE_STATE });
  const pendingTextboxesRef = useRef<Set<string>>(new Set());

  // 1. Tool Configuration Effect (Selection, Brush, etc.)
  useEffect(() => {
    if (!canvas || !isReady) return;

    // Exit text editing when switching away from text tool
    const active = canvas.getActiveObject();
    if (activeTool !== "text" && activeTool !== "select" && active instanceof fabric.Textbox && active.isEditing) {
      active.exitEditing();
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }

    const isPenTool = activeTool === "pen";
    const isShapeToolActive = isShapeTool(activeTool);

    canvas.isDrawingMode = isPenTool;
    canvas.skipTargetFind = isPenTool || isShapeToolActive;

    if (isPenTool) {
      canvas.selection = false;
      const brush = new fabric.PencilBrush(canvas);
      brush.color = activeColor;
      brush.width = DEFAULT_STROKE_WIDTH;
      canvas.freeDrawingBrush = brush;
    } else if (isShapeToolActive) {
      canvas.selection = false;
    } else if (activeTool === "eraser") {
      canvas.selection = false;
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    } else {
      canvas.selection = activeTool === "select";
    }
  }, [canvas, isReady, activeTool, activeColor]);

  // 2. Path Created Effect (Pen Tool)
  useEffect(() => {
    if (!canvas || !isReady) return;

    const handlePathCreated = (e: { path: fabric.Path }) => {
      // Re-use logic from strategies if needed, or keep here if simple
      // Importing directly for now to keep flow clear
      const path = e.path as fabric.Path;
      if (!path) return;
      const objectId = crypto.randomUUID();
      const pathWithId = path as fabric.Path & { objectId: string; contentHint?: string };
      pathWithId.objectId = objectId;
      if ("contentHint" in path) pathWithId.contentHint = "text";
      if (onAdd) {
        onAdd(serializePath(path));
      }
    };

    canvas.on("path:created", handlePathCreated);
    return () => { canvas.off("path:created", handlePathCreated); };
  }, [canvas, isReady, onAdd]);

  // 3. Shape Creation Effect
  useEffect(() => {
    if (!canvas || !isReady || !isShapeTool(activeTool)) return;

    const currentTool = activeTool as ShapeToolType;
    const state = shapeStateRef.current;

    const onMouseDown = (e: fabric.TPointerEventInfo) => strategies.handleShapeMouseDown(canvas, state, e);
    const onMouseMove = (e: fabric.TPointerEventInfo) => strategies.handleShapeMouseMove(canvas, state, currentTool, activeColor, e);
    const onMouseUp = () => strategies.handleShapeMouseUp(canvas, state, onAdd);

    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:move", onMouseMove);
    canvas.on("mouse:up", onMouseUp);

    return () => {
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:up", onMouseUp);
      if (state.previewObject && !state.previewObject.selectable) {
        canvas.remove(state.previewObject);
      }
      Object.assign(state, INITIAL_SHAPE_STATE);
    };
  }, [canvas, isReady, activeTool, activeColor, onAdd]);

  // 4. Textbox Effect
  useEffect(() => {
    if (!canvas || !isReady) return;

    const pending = pendingTextboxesRef.current;
    const onMouseDown = (e: fabric.TPointerEventInfo) => {
      if (activeTool === "text") strategies.handleTextMouseDown(canvas, activeColor, pending, setActiveTool, e);
    };
    const onDblClick = (e: fabric.TPointerEventInfo) => strategies.handleTextDblClick(canvas, e);
    const onEditEnter = (e: { target: fabric.FabricObject }) => strategies.handleTextEditingEntered(canvas, e);
    const onEditExit = (e: { target: fabric.FabricObject }) => strategies.handleTextEditingExited(canvas, pending, onAdd, onUpdate, onDelete, e);

    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:dblclick", onDblClick);
    canvas.on("text:editing:entered", onEditEnter);
    canvas.on("text:editing:exited", onEditExit);

    return () => {
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:dblclick", onDblClick);
      canvas.off("text:editing:entered", onEditEnter);
      canvas.off("text:editing:exited", onEditExit);
    };
  }, [canvas, isReady, activeTool, activeColor, onAdd, onUpdate, onDelete, setActiveTool]);

  // 5. Modification Effect
  useEffect(() => {
    if (!canvas || !isReady) return;
    const onModified = (e: fabric.ModifiedEvent) => strategies.handleObjectModified(onUpdate, e);
    canvas.on("object:modified", onModified);
    return () => { canvas.off("object:modified", onModified); };
  }, [canvas, isReady, onUpdate]);

  // 6. Eraser Effect
  useEffect(() => {
    if (!canvas || !isReady || activeTool !== "eraser") return;
    const onEraser = (e: fabric.TPointerEventInfo) => strategies.handleEraserClick(canvas, pendingTextboxesRef.current, onDelete, e);
    canvas.on("mouse:down", onEraser);
    return () => { canvas.off("mouse:down", onEraser); };
  }, [canvas, isReady, activeTool, onDelete]);

  // 7. Keyboard Effect
  useEffect(() => {
    if (!canvas || !isReady) return;
    const onKeyDown = (e: KeyboardEvent) => strategies.handleKeyDown(canvas, pendingTextboxesRef.current, onDelete, e);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); };
  }, [canvas, isReady, onDelete]);
}
