import * as fabric from "fabric";
import type { PartialSerializedObject, ShapeToolType } from "@/types/whiteboard.type";
import { DEFAULT_STROKE_WIDTH } from "./whiteboard.config";

export function serializePath(path: fabric.Path): PartialSerializedObject {
  return {
    id: (path as fabric.Path & { objectId?: string }).objectId || crypto.randomUUID(),
    type: "path",
    version: 1,
    left: path.left ?? 0,
    top: path.top ?? 0,
    angle: path.angle ?? 0,
    width: path.width,
    height: path.height,
    scaleX: path.scaleX ?? 1,
    scaleY: path.scaleY ?? 1,
    fill: (path.fill as string) ?? "",
    stroke: (path.stroke as string) ?? "#000000",
    strokeWidth: path.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    opacity: path.opacity ?? 1,
    path: path.path as (string | number)[][],
  };
}

export function serializeShape(obj: fabric.FabricObject, objectId: string): PartialSerializedObject {
  const type = obj.type as "rect" | "ellipse" | "line";

  let width = obj.width;
  let height = obj.height;

  if (type === "ellipse") {
    const ellipse = obj as fabric.Ellipse;
    width = (ellipse.rx ?? 0) * 2;
    height = (ellipse.ry ?? 0) * 2;
  }

  return {
    id: objectId,
    type,
    version: 1,
    left: obj.left ?? 0,
    top: obj.top ?? 0,
    angle: obj.angle ?? 0,
    width,
    height,
    scaleX: obj.scaleX ?? 1,
    scaleY: obj.scaleY ?? 1,
    fill: (obj.fill as string) ?? "",
    stroke: (obj.stroke as string) ?? "#000000",
    strokeWidth: obj.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    opacity: obj.opacity ?? 1,
  };
}

export function createShapeObject(
  tool: ShapeToolType,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
): fabric.FabricObject {
  const commonProps = {
    fill: tool === "line" ? "" : "color",
    stroke: color,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    selectable: false,
    evented: false,
    originX: "left" as const,
    originY: "top" as const,
  };

  switch (tool) {
    case "rect":
      return new fabric.Rect({
        ...commonProps,
        left: x,
        top: y,
        width,
        height,
      });
    case "ellipse":
      return new fabric.Ellipse({
        ...commonProps,
        left: x,
        top: y,
        rx: width / 2,
        ry: height / 2,
      });
    case "line":
      return new fabric.Line([x, y, x + width, y + height], commonProps);
  }
}

export function createLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string
): fabric.Line {
  return new fabric.Line([x1, y1, x2, y2], {
    fill: "",
    stroke: color,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    selectable: false,
    evented: false,
  });
}

export function isShapeTool(tool: string): tool is ShapeToolType {
  return tool === "rect" || tool === "ellipse" || tool === "line";
}

export function computeBoundingBox(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): { minX: number; minY: number; width: number; height: number } {
  return {
    minX: Math.min(startX, endX),
    minY: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}
