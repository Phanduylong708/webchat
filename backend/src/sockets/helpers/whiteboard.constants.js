export const MAX_OBJECTS = 2000;
export const MAX_TEXT_LENGTH = 2000;
export const MAX_PATH_SEGMENTS = 5000;
export const MAX_OBJECT_JSON_BYTES = 64 * 1024;

export const INACTIVITY_TTL_MS = 30 * 60 * 1000;

export const USER_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export const ALLOWED_UPDATE_KEYS = new Set([
  "left",
  "top",
  "angle",
  "width",
  "height",
  "scaleX",
  "scaleY",
  "fill",
  "stroke",
  "strokeWidth",
  "opacity",
  "text",
]);
