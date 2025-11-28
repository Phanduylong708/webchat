import {
  getConversationRoom,
  getCallRoom,
  verifyMembership,
} from "../helpers/helpers.js";
import { randomUUID } from "crypto";

const callSessions = new Map();
const CALL_TIMEOUT_MS = 30_000;

function handleCall(io, socket) {
  socket.on("call:initiate", async (payload = {}, callback) => {
    try {
      const { conversationId, callId } = payload;
      const parsedConversationId = parseInt(conversationId, 10);
      if (Number.isNaN(parsedConversationId)) {
        return maybeAck(callback, {
          success: false,
          error: "conversationId is required",
        });
      }

      const userId = socket.data.user?.id;
      if (!userId) {
        return maybeAck(callback, { success: false, error: "Unauthorized" });
      }

      const isMember = await verifyMembership(userId, parsedConversationId);
      if (!isMember) {
        return maybeAck(callback, {
          success: false,
          error: "Not a member of this conversation",
        });
      }

      const effectiveCallId = callId || randomUUID();
      if (!callSessions.has(effectiveCallId)) {
        const timeoutHandle = setTimeout(() => {
          handleCallTimeout(io, effectiveCallId);
        }, CALL_TIMEOUT_MS);
        callSessions.set(effectiveCallId, {
          conversationId: parsedConversationId,
          initiatorId: userId,
          status: "ringing",
          participantsAccepted: new Set(),
          timeoutHandle,
        });
      }

      const ringPayload = {
        callId: effectiveCallId,
        conversationId: parsedConversationId,
        caller: socket.data.user,
        timeoutMs: CALL_TIMEOUT_MS,
      };
      io.to(getConversationRoom(parsedConversationId)).emit(
        "call:initiate",
        ringPayload
      );
      return maybeAck(callback, { success: true, callId: effectiveCallId });
    } catch (err) {
      console.error("call:initiate error", err);
      return maybeAck(callback, { success: false, error: "Internal error" });
    }
  });

  socket.on("call:join", async (payload = {}) => {
    try {
      const { callId } = payload;
      if (!callId || !callSessions.has(callId)) return;

      const session = callSessions.get(callId);
      const userId = socket.data.user?.id;
      if (!userId) return;

      const isMember = await verifyMembership(userId, session.conversationId);
      if (!isMember) return;

      socket.join(getCallRoom(callId));
      session.participantsAccepted.add(userId);

      if (
        userId !== session.initiatorId &&
        session.status === "ringing" &&
        session.timeoutHandle
      ) {
        clearTimeout(session.timeoutHandle);
        session.timeoutHandle = null;
        session.status = "active";
      }

      io.to(getCallRoom(callId)).emit("call:join", {
        callId,
        user: socket.data.user,
      });
    } catch (err) {
      console.error("call:join error", err);
    }
  });

  socket.on("call:leave", (payload = {}) => {
    const { callId } = payload;
    if (!callId) return;
    handleUserLeave(io, socket, callId, "leave");
  });

  // Kết thúc toàn bộ cuộc gọi (force end)
  socket.on("call:end", (payload = {}) => {
    const { callId } = payload;
    if (!callId || !callSessions.has(callId)) return;
    endCallForAll(io, callId, "ended");
  });

  socket.on("call:offer", (payload = {}) => {
    const { callId } = payload;
    if (!callId || !callSessions.has(callId)) return;
    socket.to(getCallRoom(callId)).emit("call:offer", payload);
  });

  socket.on("call:answer", (payload = {}) => {
    const { callId } = payload;
    if (!callId || !callSessions.has(callId)) return;
    socket.to(getCallRoom(callId)).emit("call:answer", payload);
  });

  socket.on("call:candidate", (payload = {}) => {
    const { callId } = payload;
    if (!callId || !callSessions.has(callId)) return;
    socket.to(getCallRoom(callId)).emit("call:candidate", payload);
  });

  // Handle disconnect - user rời tất cả calls đang tham gia
  socket.on("disconnect", () => {
    const userId = socket.data.user?.id;
    if (!userId) return;

    for (const [callId, session] of callSessions) {
      if (session.participantsAccepted.has(userId)) {
        handleUserLeave(io, socket, callId, "disconnect");
      }
    }
  });
}

// User rời cuộc gọi
function handleUserLeave(io, socket, callId, reason) {
  const session = callSessions.get(callId);
  if (!session) return;

  const userId = socket.data.user?.id;
  if (!userId || !session.participantsAccepted.has(userId)) return;

  // Remove user
  session.participantsAccepted.delete(userId);
  socket.leave(getCallRoom(callId));

  // Notify others
  io.to(getCallRoom(callId)).emit("call:leave", {
    callId,
    user: socket.data.user,
    reason,
  });

  if (session.participantsAccepted.size < 2) {
    endCallForAll(io, callId, "insufficient_participants");
  }
}

function endCallForAll(io, callId, reason) {
  const session = callSessions.get(callId);
  if (!session) return;

  const payload = {
    callId,
    conversationId: session.conversationId,
    reason,
  };

  io.to(getCallRoom(callId)).emit("call:end", payload);
  io.to(getConversationRoom(session.conversationId)).emit("call:end", payload);
  cleanupCall(callId);
}

function handleCallTimeout(io, callId) {
  endCallForAll(io, callId, "timeout");
}

function cleanupCall(callId) {
  const session = callSessions.get(callId);
  if (session?.timeoutHandle) {
    clearTimeout(session.timeoutHandle);
  }
  callSessions.delete(callId);
}

function maybeAck(callback, payload) {
  if (typeof callback === "function") {
    callback(payload);
  }
}

export { handleCall, CALL_TIMEOUT_MS, callSessions };
