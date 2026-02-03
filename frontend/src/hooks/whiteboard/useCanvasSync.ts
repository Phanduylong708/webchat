import { useEffect, useRef } from "react";
import * as fabric from "fabric";
import type { ObjectID, SerializedObject } from "@/types/whiteboard.type";
import { deserializeToFabric, getObjectId } from "./utils/whiteboard.utils";

function applyUpdatesToFabricObject(
  existing: fabric.FabricObject,
  serialized: SerializedObject
): void {
  // Ensure consistent origin
  existing.set({
    originX: "left",
    originY: "top",
  });

  // Use setPositionByOrigin for accurate positioning
  existing.setPositionByOrigin(
    new fabric.Point(serialized.left ?? 0, serialized.top ?? 0),
    "left",
    "top"
  );

  // Apply other common props
  existing.set({
    angle: serialized.angle,
    scaleX: serialized.scaleX,
    scaleY: serialized.scaleY,
    fill: serialized.fill,
    stroke: serialized.stroke,
    strokeWidth: serialized.strokeWidth,
    opacity: serialized.opacity,
  });

  // Type-specific updates
  switch (serialized.type) {
    case "rect":
      existing.set({
        width: serialized.width ?? 0,
        height: serialized.height ?? 0,
      });
      break;
    case "ellipse":
      (existing as fabric.Ellipse).set({
        rx: (serialized.width ?? 0) / 2,
        ry: (serialized.height ?? 0) / 2,
      });
      break;
    case "line": {
      const line = existing as fabric.Line;
      line.set({
        x1: 0,
        y1: 0,
        x2: serialized.width ?? 0,
        y2: serialized.height ?? 0,
      });
      break;
    }
    case "textbox":
      (existing as fabric.Textbox).set({
        text: serialized.text ?? "",
        width: serialized.width,
      });
      break;
    case "path":
      // Path geometry is immutable after creation; skip
      break;
  }

  existing.setCoords();
}

export function useCanvasSync(
  canvas: fabric.Canvas | null,
  objects: Record<ObjectID, SerializedObject>,
  isReady: boolean
): void {
  const appliedVersionsRef = useRef<Record<ObjectID, number>>({});

  useEffect(() => {
    if (!canvas || !isReady) return;

    const currentIds = new Set(Object.keys(objects));
    const canvasObjects = canvas.getObjects();

    // Build map of canvas objects by ID for O(1) lookup
    const canvasObjectsMap = new Map<string, fabric.FabricObject>();
    for (const obj of canvasObjects) {
      const id = getObjectId(obj);
      if (id) canvasObjectsMap.set(id, obj);
    }

    // Add new objects / update existing
    for (const [id, serialized] of Object.entries(objects)) {
      const appliedVersion = appliedVersionsRef.current[id] ?? 0;
      const existing = canvasObjectsMap.get(id);

      if (!existing) {
        // New object - add to canvas
        const fabricObj = deserializeToFabric(serialized);
        canvas.add(fabricObj);
        appliedVersionsRef.current[id] = serialized.version;
      } else if (serialized.version > appliedVersion) {
        // Skip updating objects currently in a group/selection (they have relative coords)
        const isInGroup = !!(existing as fabric.FabricObject & { group?: unknown }).group;
        if (isInGroup) {
          // Still update version tracking so we don't re-apply later
          appliedVersionsRef.current[id] = serialized.version;
        } else {
          // Existing object with newer version - update
          applyUpdatesToFabricObject(existing, serialized);
          appliedVersionsRef.current[id] = serialized.version;
        }
      }
    }

    // Remove deleted objects
    for (const obj of canvasObjects) {
      const id = getObjectId(obj);
      if (id && !currentIds.has(id)) {
        canvas.remove(obj);
        delete appliedVersionsRef.current[id];
      }
    }

    canvas.requestRenderAll();
  }, [canvas, objects, isReady]);
}
