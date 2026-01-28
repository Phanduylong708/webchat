import {
  getCallRoom,
  maybeAck,
  isFiniteNumber,
  toSafeInt,
  isValidObjectId,
  isValidCallId,
} from "../helpers/helpers.js";
import {
  MAX_OBJECTS,
  MAX_TEXT_LENGTH,
  MAX_PATH_SEGMENTS,
  MAX_OBJECT_JSON_BYTES,
  INACTIVITY_TTL_MS,
  USER_COLORS,
  ALLOWED_UPDATE_KEYS,
} from "../helpers/whiteboard.constants.js";
import { callSessions } from "./call.handler.js";

const whiteboardStates = new Map();

function assertCallParticipant(callId, userId) {
  const session = callSessions.get(callId);
  if (!session) {
    return { ok: false, error: "Call not found" };
  }
  if (!session.participants?.has(userId)) {
    return { ok: false, error: "Not in call" };
  }
  return { ok: true, session };
}

function scheduleInactivityTtl(callId, state) {
  if (state.inactivityTimeout) {
    clearTimeout(state.inactivityTimeout);
  }
  state.inactivityTimeout = setTimeout(() => {
    destroyState(callId);
  }, INACTIVITY_TTL_MS);
}

function touchState(callId, state) {
  state.lastActivityAt = Date.now();
  scheduleInactivityTtl(callId, state);
}

function destroyState(callId) {
  const state = whiteboardStates.get(callId);
  if (!state) return;
  if (state.inactivityTimeout) {
    clearTimeout(state.inactivityTimeout);
  }
  whiteboardStates.delete(callId);
}

function getOrCreateState(callId) {
  const existing = whiteboardStates.get(callId);
  if (existing) {
    touchState(callId, existing);
    return existing;
  }

  const state = {
    callId,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    objects: new Map(),
    tombstones: new Map(),
    userColors: new Map(),
    inactivityTimeout: null,
  };

  whiteboardStates.set(callId, state);
  scheduleInactivityTtl(callId, state);
  return state;
}

function pickUserColor(state, userId) {
  const existing = state.userColors.get(userId);
  if (existing) return existing;

  const used = new Set(state.userColors.values());
  const available = USER_COLORS.find((c) => !used.has(c));
  const color = available || USER_COLORS[userId % USER_COLORS.length];
  state.userColors.set(userId, color);
  return color;
}

function validateSerializedObjectSize(object) {
  try {
    const bytes = JSON.stringify(object).length;
    return bytes <= MAX_OBJECT_JSON_BYTES;
  } catch {
    return false;
  }
}

function normalizeAddObject(object, userId) {
  if (!object || typeof object !== "object") return { ok: false, error: "Invalid object" };

  const { id, type } = object;
  if (!isValidObjectId(id)) return { ok: false, error: "Invalid object id" };
  if (typeof type !== "string") return { ok: false, error: "Invalid object type" };

  const version = toSafeInt(object.version) ?? 1;
  if (version < 1) return { ok: false, error: "Invalid version" };

  const base = {
    id,
    type,
    version,
    createdBy: userId,
    left: isFiniteNumber(object.left) ? object.left : 0,
    top: isFiniteNumber(object.top) ? object.top : 0,
    angle: isFiniteNumber(object.angle) ? object.angle : 0,
    width: isFiniteNumber(object.width) ? object.width : undefined,
    height: isFiniteNumber(object.height) ? object.height : undefined,
    scaleX: isFiniteNumber(object.scaleX) ? object.scaleX : 1,
    scaleY: isFiniteNumber(object.scaleY) ? object.scaleY : 1,
    fill: typeof object.fill === "string" ? object.fill : "",
    stroke: typeof object.stroke === "string" ? object.stroke : "#000000",
    strokeWidth: isFiniteNumber(object.strokeWidth) ? object.strokeWidth : 2,
    opacity: isFiniteNumber(object.opacity) ? object.opacity : 1,
  };

  if (typeof object.text === "string") {
    if (object.text.length > MAX_TEXT_LENGTH) {
      return { ok: false, error: "Text too long" };
    }
    base.text = object.text;
  }

  if (type === "path") {
    if (!Array.isArray(object.path)) return { ok: false, error: "Invalid path" };
    if (object.path.length > MAX_PATH_SEGMENTS) return { ok: false, error: "Path too large" };
    base.path = object.path;
  }

  if (!validateSerializedObjectSize(base)) {
    return { ok: false, error: "Object too large" };
  }

  return { ok: true, object: base };
}

function normalizePatch(patch) {
  if (!patch || typeof patch !== "object") return { ok: false, error: "Invalid patch" };

  const next = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!ALLOWED_UPDATE_KEYS.has(key)) continue;

    if (key === "text") {
      if (typeof value !== "string") continue;
      if (value.length > MAX_TEXT_LENGTH) {
        return { ok: false, error: "Text too long" };
      }
      next.text = value;
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      next[key] = value;
    }
    if ((key === "fill" || key === "stroke") && typeof value === "string") {
      next[key] = value;
    }
  }

  return { ok: true, patch: next };
}

function getIncomingVersion(explicitVersion, patchVersion, currentVersion) {
  const v1 = toSafeInt(explicitVersion);
  const v2 = toSafeInt(patchVersion);
  const incoming = v1 ?? v2;
  if (incoming !== null) return incoming;
  return currentVersion + 1;
}

function handleWhiteboard(io, socket) {
  socket.on("wb:join", (payload = {}, callback) => {
    try {
      const { callId } = payload;
      if (!isValidCallId(callId)) {
        return maybeAck(callback, { success: false, error: "callId is required" });
      }

      const userId = socket.data.user?.id;
      if (!userId) {
        return maybeAck(callback, { success: false, error: "Unauthorized" });
      }

      const guard = assertCallParticipant(callId, userId);
      if (!guard.ok) {
        return maybeAck(callback, { success: false, error: guard.error });
      }

      const callIds = socket.data.whiteboardCallIds ?? new Set();
      callIds.add(callId);
      socket.data.whiteboardCallIds = callIds;

      const state = getOrCreateState(callId);
      const myColor = pickUserColor(state, userId);

      const snapshot = {
        callId,
        objects: Array.from(state.objects.values()),
        userColors: Object.fromEntries(state.userColors.entries()),
        myColor,
      };

      socket.emit("wb:snapshot", snapshot);
      return maybeAck(callback, { success: true });
    } catch (err) {
      console.error("wb:join error", err);
      return maybeAck(callback, { success: false, error: "Internal error" });
    }
  });

  socket.on("wb:add", (payload = {}, callback) => {
    try {
      const { callId, object } = payload;
      if (!isValidCallId(callId)) {
        return maybeAck(callback, { success: false, error: "callId is required" });
      }

      const userId = socket.data.user?.id;
      if (!userId) {
        return maybeAck(callback, { success: false, error: "Unauthorized" });
      }

      const guard = assertCallParticipant(callId, userId);
      if (!guard.ok) {
        return maybeAck(callback, { success: false, error: guard.error });
      }

      const state = getOrCreateState(callId);
      if (state.objects.size >= MAX_OBJECTS) {
        return maybeAck(callback, { success: false, error: "Whiteboard object limit reached" });
      }

      const normalized = normalizeAddObject(object, userId);
      if (!normalized.ok) {
        return maybeAck(callback, { success: false, error: normalized.error });
      }

      const nextObject = normalized.object;
      const existing = state.objects.get(nextObject.id);
      const tombstone = state.tombstones.get(nextObject.id);
      if (tombstone && nextObject.version <= tombstone.version) {
        return maybeAck(callback, {
          success: true,
          objectId: nextObject.id,
          version: tombstone.version,
          applied: false,
          reason: "stale",
        });
      }

      if (existing && nextObject.version <= existing.version) {
        return maybeAck(callback, {
          success: true,
          objectId: nextObject.id,
          version: existing.version,
          applied: false,
          reason: "stale",
        });
      }

      state.objects.set(nextObject.id, nextObject);
      state.tombstones.delete(nextObject.id);
      touchState(callId, state);

      socket.to(getCallRoom(callId)).emit("wb:add", { callId, object: nextObject });
      return maybeAck(callback, {
        success: true,
        objectId: nextObject.id,
        version: nextObject.version,
        applied: true,
      });
    } catch (err) {
      console.error("wb:add error", err);
      return maybeAck(callback, { success: false, error: "Internal error" });
    }
  });

  socket.on("wb:update", (payload = {}, callback) => {
    try {
      const { callId, objectId, patch, version } = payload;
      if (!isValidCallId(callId)) {
        return maybeAck(callback, { success: false, error: "callId is required" });
      }
      if (!isValidObjectId(objectId)) {
        return maybeAck(callback, { success: false, error: "objectId is required" });
      }

      const userId = socket.data.user?.id;
      if (!userId) {
        return maybeAck(callback, { success: false, error: "Unauthorized" });
      }

      const guard = assertCallParticipant(callId, userId);
      if (!guard.ok) {
        return maybeAck(callback, { success: false, error: guard.error });
      }

      const state = getOrCreateState(callId);
      const current = state.objects.get(objectId);
      if (!current) {
        const tombstone = state.tombstones.get(objectId);
        const currentVersion = tombstone?.version ?? 0;
        return maybeAck(callback, {
          success: true,
          objectId,
          version: currentVersion,
          applied: false,
          reason: "not_found",
        });
      }

      const incomingVersion = getIncomingVersion(version, patch?.version, current.version);
      if (incomingVersion <= current.version) {
        return maybeAck(callback, {
          success: true,
          objectId,
          version: current.version,
          applied: false,
          reason: "stale",
        });
      }

      const normalized = normalizePatch(patch);
      if (!normalized.ok) {
        return maybeAck(callback, { success: false, error: normalized.error });
      }

      const next = { ...current, ...normalized.patch, version: incomingVersion };
      if (!validateSerializedObjectSize(next)) {
        return maybeAck(callback, { success: false, error: "Object too large" });
      }

      state.objects.set(objectId, next);
      touchState(callId, state);

      socket.to(getCallRoom(callId)).emit("wb:update", {
        callId,
        objectId,
        patch: { ...normalized.patch, version: incomingVersion },
      });
      return maybeAck(callback, { success: true, objectId, version: incomingVersion, applied: true });
    } catch (err) {
      console.error("wb:update error", err);
      return maybeAck(callback, { success: false, error: "Internal error" });
    }
  });

  socket.on("wb:delete", (payload = {}, callback) => {
    try {
      const { callId, objectId, version } = payload;
      if (!isValidCallId(callId)) {
        return maybeAck(callback, { success: false, error: "callId is required" });
      }
      if (!isValidObjectId(objectId)) {
        return maybeAck(callback, { success: false, error: "objectId is required" });
      }

      const userId = socket.data.user?.id;
      if (!userId) {
        return maybeAck(callback, { success: false, error: "Unauthorized" });
      }

      const guard = assertCallParticipant(callId, userId);
      if (!guard.ok) {
        return maybeAck(callback, { success: false, error: guard.error });
      }

      const state = getOrCreateState(callId);
      const current = state.objects.get(objectId);
      const tombstone = state.tombstones.get(objectId);
      const currentVersion = current?.version ?? tombstone?.version ?? 0;

      if (!current) {
        return maybeAck(callback, {
          success: true,
          objectId,
          version: currentVersion,
          applied: false,
          reason: "not_found",
        });
      }

      const incomingVersion = getIncomingVersion(version, null, currentVersion);
      if (incomingVersion <= currentVersion) {
        return maybeAck(callback, {
          success: true,
          objectId,
          version: currentVersion,
          applied: false,
          reason: "stale",
        });
      }

      state.objects.delete(objectId);
      state.tombstones.set(objectId, { version: incomingVersion, deletedAt: Date.now() });
      touchState(callId, state);

      socket.to(getCallRoom(callId)).emit("wb:delete", { callId, objectId, version: incomingVersion });
      return maybeAck(callback, { success: true, objectId, version: incomingVersion, applied: true });
    } catch (err) {
      console.error("wb:delete error", err);
      return maybeAck(callback, { success: false, error: "Internal error" });
    }
  });

  socket.on("wb:cursor", (payload = {}) => {
    try {
      const { callId, position } = payload;
      if (!isValidCallId(callId)) return;

      const userId = socket.data.user?.id;
      if (!userId) return;

      const guard = assertCallParticipant(callId, userId);
      if (!guard.ok) return;

      const state = getOrCreateState(callId);
      const color = pickUserColor(state, userId);

      if (position !== null && position !== undefined) {
        if (typeof position !== "object") return;
        if (!isFiniteNumber(position.x) || !isFiniteNumber(position.y)) return;
      }

      socket.to(getCallRoom(callId)).emit("wb:cursor", {
        callId,
        userId,
        color,
        position,
      });
    } catch (err) {
      console.warn("wb:cursor error", err);
    }
  });

  socket.on("disconnect", () => {
    try {
      const userId = socket.data.user?.id;
      if (!userId) return;

      const callIds = socket.data.whiteboardCallIds;
      if (!callIds || callIds.size === 0) return;

      for (const callId of callIds) {
        const state = whiteboardStates.get(callId);
        const session = callSessions.get(callId);
        if (!state || !session?.participants?.has(userId)) continue;

        const participant = session.participants.get(userId);
        if (participant?.socketIds && participant.socketIds.size > 0) {
          continue;
        }

        const color = state.userColors.get(userId) || USER_COLORS[userId % USER_COLORS.length];
        socket.to(getCallRoom(callId)).emit("wb:cursor", { callId, userId, color, position: null });
      }
    } catch (err) {
      console.warn("wb disconnect cleanup error", err);
    }
  });
}

export { handleWhiteboard, whiteboardStates };
