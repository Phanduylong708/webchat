import * as fabric from "fabric";
import type { 
  ShapeToolType, 
  ShapeCreationState, 
  UseFabricOptions 
} from "@/types/whiteboard.type";
import { 
  DRAG_THRESHOLD, 
  INITIAL_SHAPE_STATE,
  EDITING_BORDER_COLOR,
  SELECTION_BORDER_COLOR
} from "@/hooks/whiteboard/utils/whiteboard.config";
import { 
  createLine, 
  createShapeObject, 
  computeBoundingBox, 
  serializeShape,
  createTextbox,
  serializeTextbox,
  getObjectId,
  getTransformPatch
} from "@/hooks/whiteboard/utils/whiteboard.utils";

/**
 * STRATEGY: SHAPE CREATION
 * Handles drawing Rect, Ellipse, and Line
 */
export const handleShapeMouseDown = (
  fabricCanvas: fabric.Canvas,
  state: ShapeCreationState,
  e: fabric.TPointerEventInfo
) => {
  const pointer = fabricCanvas.getScenePoint(e.e);
  state.isCreating = true;
  state.startX = pointer.x;
  state.startY = pointer.y;
  state.hasDragged = false;
  state.previewObject = null;
  state.objectId = "";
};

export const handleShapeMouseMove = (
  fabricCanvas: fabric.Canvas,
  state: ShapeCreationState,
  activeTool: ShapeToolType,
  activeColor: string,
  e: fabric.TPointerEventInfo
) => {
  if (!state.isCreating) return;

  const pointer = fabricCanvas.getScenePoint(e.e);
  const dx = pointer.x - state.startX;
  const dy = pointer.y - state.startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (!state.hasDragged && distance > DRAG_THRESHOLD) {
    state.hasDragged = true;
    state.objectId = crypto.randomUUID();
  }

  if (state.hasDragged) {
    if (!state.previewObject) {
      if (activeTool === "line") {
        state.previewObject = createLine(state.startX, state.startY, pointer.x, pointer.y, activeColor);
      } else {
        const { minX, minY, width, height } = computeBoundingBox(state.startX, state.startY, pointer.x, pointer.y);
        state.previewObject = createShapeObject(activeTool, minX, minY, width, height, activeColor);
      }
      fabricCanvas.add(state.previewObject);
    } else {
      if (activeTool === "line") {
        const line = state.previewObject as fabric.Line;
        line.set({ x1: state.startX, y1: state.startY, x2: pointer.x, y2: pointer.y });
      } else {
        const { minX, minY, width, height } = computeBoundingBox(state.startX, state.startY, pointer.x, pointer.y);
        if (activeTool === "ellipse") {
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

export const handleShapeMouseUp = (
  fabricCanvas: fabric.Canvas,
  state: ShapeCreationState,
  onAdd?: UseFabricOptions["onAdd"]
) => {
  if (!state.isCreating) return;

  let finalObject: fabric.FabricObject;

  if (state.previewObject) {
    finalObject = state.previewObject;
  } else {
    Object.assign(state, INITIAL_SHAPE_STATE);
    return;
  }

  finalObject.set({ selectable: true, evented: true });
  (finalObject as fabric.FabricObject & { objectId: string }).objectId = state.objectId;
  fabricCanvas.setActiveObject(finalObject);
  fabricCanvas.requestRenderAll();

  if (onAdd) {
    const serialized = serializeShape(finalObject, state.objectId);
    onAdd(serialized);
  }

  Object.assign(state, INITIAL_SHAPE_STATE);
};

/**
 * STRATEGY: TEXTBOX
 * Handles creating and managing text input
 */
export const handleTextMouseDown = (
  fabricCanvas: fabric.Canvas,
  activeColor: string,
  pendingTextboxes: Set<string>,
  setActiveTool: UseFabricOptions["setActiveTool"],
  e: fabric.TPointerEventInfo
) => {
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

  if (setActiveTool) {
    setActiveTool("select");
  }
};

export const handleTextDblClick = (
  fabricCanvas: fabric.Canvas,
  e: fabric.TPointerEventInfo
) => {
  const target = e.target;
  if (!target || target.type !== "textbox") return;

  const textbox = target as fabric.Textbox;
  fabricCanvas.setActiveObject(textbox);
  textbox.enterEditing();
  textbox.selectAll();
};

export const handleTextEditingEntered = (
  fabricCanvas: fabric.Canvas,
  e: { target: fabric.FabricObject }
) => {
  const textbox = e.target as fabric.Textbox;
  textbox.set({ borderColor: EDITING_BORDER_COLOR });
  fabricCanvas.requestRenderAll();
};

export const handleTextEditingExited = (
  fabricCanvas: fabric.Canvas,
  pendingTextboxes: Set<string>,
  onAdd: UseFabricOptions["onAdd"],
  onUpdate: UseFabricOptions["onUpdate"],
  onDelete: UseFabricOptions["onDelete"],
  e: { target: fabric.FabricObject }
) => {
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

/**
 * STRATEGY: ERASER
 */
export const handleEraserClick = (
  fabricCanvas: fabric.Canvas,
  pendingTextboxes: Set<string>,
  onDelete: UseFabricOptions["onDelete"],
  e: fabric.TPointerEventInfo
) => {
  const target = e.target;
  if (!target) return;

  const objectId = getObjectId(target);
  fabricCanvas.remove(target);
  fabricCanvas.requestRenderAll();

  if (objectId && onDelete) {
    if (pendingTextboxes.has(objectId)) {
      pendingTextboxes.delete(objectId);
    } else {
      onDelete(objectId);
    }
  }
};

/**
 * STRATEGY: SELECTION & MODIFICATION
 */
export const handleObjectModified = (
  onUpdate: UseFabricOptions["onUpdate"],
  e: fabric.ModifiedEvent
) => {
  const target = e.target;
  if (!target || !onUpdate) return;

  if (target instanceof fabric.ActiveSelection) {
    target.getObjects().forEach((obj) => {
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

/**
 * STRATEGY: KEYBOARD ACTIONS
 */
export const handleKeyDown = (
  fabricCanvas: fabric.Canvas,
  pendingTextboxes: Set<string>,
  onDelete: UseFabricOptions["onDelete"],
  e: KeyboardEvent
) => {
  if (e.key !== "Delete" && e.key !== "Backspace") return;

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

  const objects = fabricCanvas.getActiveObjects().slice();
  if (!objects.length) return;

  if (objects.some((o) => o instanceof fabric.Textbox && o.isEditing)) {
    return;
  }

  e.preventDefault();

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
