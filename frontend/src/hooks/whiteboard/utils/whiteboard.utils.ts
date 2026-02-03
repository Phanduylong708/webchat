import * as fabric from "fabric";
import type { PartialSerializedObject, ShapeToolType, ObjectPatch, SerializedObject } from "@/types/whiteboard.type";
import { DEFAULT_STROKE_WIDTH, DEFAULT_FONT_SIZE, DEFAULT_FONT_FAMILY, DEFAULT_TEXT_WIDTH } from "./whiteboard.config";

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
    fill: tool === "line" ? "" : "transparent",
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
    originX: "left",
    originY: "top",
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

export function createTextbox(x: number, y: number, color: string): fabric.Textbox {
  return new fabric.Textbox("", {
    left: x,
    top: y,
    width: DEFAULT_TEXT_WIDTH,
    fontSize: DEFAULT_FONT_SIZE,
    fontFamily: DEFAULT_FONT_FAMILY,
    fill: color,
    editable: true,
    selectable: true,
    evented: true,
    originX: "left",
    originY: "top",
  });
}

export function serializeTextbox(textbox: fabric.Textbox, objectId: string): PartialSerializedObject {
  return {
    id: objectId,
    type: "textbox",
    version: 1,
    left: textbox.left ?? 0,
    top: textbox.top ?? 0,
    angle: textbox.angle ?? 0,
    width: textbox.width,
    height: textbox.height,
    scaleX: textbox.scaleX ?? 1,
    scaleY: textbox.scaleY ?? 1,
    fill: (textbox.fill as string) ?? "#000000",
    stroke: (textbox.stroke as string) ?? "",
    strokeWidth: textbox.strokeWidth ?? 0,
    opacity: textbox.opacity ?? 1,
    text: textbox.text ?? "",
  };
}

export function getObjectId(obj: fabric.FabricObject): string | undefined {
  return (obj as fabric.FabricObject & { objectId?: string }).objectId;
}

export function getTransformPatch(obj: fabric.FabricObject): ObjectPatch {
  const group = (obj as fabric.FabricObject & { group?: fabric.Group }).group;

  let left: number;
  let top: number;
  let angle: number;
  let scaleX: number;
  let scaleY: number;

  if (group) {
    const center = obj.getCenterPoint();
    const totalAngle = obj.getTotalAngle();
    const totalScale = obj.getObjectScaling();

    const width = obj.width ?? 0;
    const height = obj.height ?? 0;
    const halfW = (width * totalScale.x) / 2;
    const halfH = (height * totalScale.y) / 2;

    // Calculate top-left position by rotating offset from center
    // translateToOriginPoint uses local angle, but we need total angle
    const angleRad = (totalAngle * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    left = center.x + (-halfW * cos + halfH * sin);
    top = center.y + (-halfW * sin - halfH * cos);
    angle = totalAngle;
    scaleX = totalScale.x;
    scaleY = totalScale.y;
  } else {
    left = obj.left ?? 0;
    top = obj.top ?? 0;
    angle = obj.angle ?? 0;
    scaleX = obj.scaleX ?? 1;
    scaleY = obj.scaleY ?? 1;
  }

  return {
    left,
    top,
    angle,
    scaleX,
    scaleY,
    width: obj.width,
    height: obj.height,
  };
}

export function deserializeToFabric(obj: SerializedObject): fabric.FabricObject {
  const commonProps = {
    left: obj.left ?? 0,
    top: obj.top ?? 0,
    angle: obj.angle ?? 0,
    scaleX: obj.scaleX ?? 1,
    scaleY: obj.scaleY ?? 1,
    fill: obj.fill ?? "",
    stroke: obj.stroke ?? "#000000",
    strokeWidth: obj.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    opacity: obj.opacity ?? 1,
    selectable: true,
    evented: true,
    originX: "left" as const,
    originY: "top" as const,
  };

  let fabricObj: fabric.FabricObject;

  switch (obj.type) {
    case "rect":
      fabricObj = new fabric.Rect({
        ...commonProps,
        width: obj.width ?? 0,
        height: obj.height ?? 0,
      });
      break;
    case "ellipse":
      fabricObj = new fabric.Ellipse({
        ...commonProps,
        rx: (obj.width ?? 0) / 2,
        ry: (obj.height ?? 0) / 2,
      });
      break;
    case "line":
      fabricObj = new fabric.Line(
        [0, 0, obj.width ?? 0, obj.height ?? 0],
        commonProps
      );
      break;
    case "path":
      fabricObj = new fabric.Path(obj.path, {
        ...commonProps,
        width: obj.width,
        height: obj.height,
      });
      break;
    case "textbox":
      fabricObj = new fabric.Textbox(obj.text ?? "", {
        ...commonProps,
        width: obj.width ?? DEFAULT_TEXT_WIDTH,
        fontSize: DEFAULT_FONT_SIZE,
        fontFamily: DEFAULT_FONT_FAMILY,
      });
      break;
    default:
      throw new Error(`Unknown object type: ${obj.type}`);
  }

  (fabricObj as fabric.FabricObject & { objectId: string }).objectId = obj.id;
  return fabricObj;
}
