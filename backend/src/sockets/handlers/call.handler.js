import {
  getConversationRoom,
  getCallRoom,
  verifyMembership,
  getConversationMemberIds,
  getConversationType,
  getOnlineUserIds,
  maybeAck,
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

      // Fetch conversation type once per session to reuse in call:join ACK
      const conversationType = await getConversationType(parsedConversationId);
      if (!conversationType) {
        return maybeAck(callback, {
          success: false,
          error: "Conversation not found",
        });
      }

      const effectiveCallId = callId || randomUUID();
      if (!callSessions.has(effectiveCallId)) {
        // Get all members of conversation
        const memberIds = await getConversationMemberIds(parsedConversationId);
        // Filter to only online members (offline users can't respond to calls)
        const onlineMemberIds = getOnlineUserIds(io, memberIds);
        // Callees = online members except the initiator
        const calleeIds = onlineMemberIds.filter((id) => id !== userId);

        const timeoutHandle = setTimeout(() => {
          handleCallTimeout(io, effectiveCallId);
        }, CALL_TIMEOUT_MS);

        callSessions.set(effectiveCallId, {
          conversationId: parsedConversationId,
          conversationType,
          initiatorId: userId,
          status: "ringing",
          callees: new Set(calleeIds),
          responded: new Set(),
          participants: new Map(),
          timeoutHandle,
        });
      }

      const ringPayload = {
        callId: effectiveCallId,
        conversationId: parsedConversationId,
        caller: socket.data.user,
        timeoutMs: CALL_TIMEOUT_MS,
      };
      socket.to(getConversationRoom(parsedConversationId)).emit("call:initiate", ringPayload);
      return maybeAck(callback, { success: true, callId: effectiveCallId });
    } catch (err) {
      console.error("call:initiate error", err);
      return maybeAck(callback, { success: false, error: "Internal error" });
    }
  });

  socket.on("call:join", async (payload = {}, callback) => {
    try {
      const { callId } = payload;
      if (!callId || !callSessions.has(callId)) {
        return maybeAck(callback, { success: false, error: "Call not found" });
      }

      const session = callSessions.get(callId);
      const userId = socket.data.user?.id;
      if (!userId) {
        return maybeAck(callback, { success: false, error: "Unauthorized" });
      }

      const isMember = await verifyMembership(userId, session.conversationId);
      if (!isMember) {
        return maybeAck(callback, {
          success: false,
          error: "Not a member of this conversation",
        });
      }

      socket.join(getCallRoom(callId));

      // Store user snapshot with socket tracking for multi-tab support
      if (session.participants.has(userId)) {
        // User already in call from another tab - add this socket
        session.participants.get(userId).socketIds.add(socket.id);
      } else {
        // New participant
        session.participants.set(userId, {
          user: {
            id: socket.data.user.id,
            username: socket.data.user.username,
            avatar: socket.data.user.avatar || null,
          },
          socketIds: new Set([socket.id]),
          media: { audioMuted: true, videoMuted: true, videoSource: "camera" },
        });
      }

      // Track response (only for callees, not initiator)
      if (session.callees.has(userId)) {
        session.responded.add(userId);
      }

      // Cancel timeout when first non-initiator joins (call becomes active)
      if (userId !== session.initiatorId && session.status === "ringing" && session.timeoutHandle) {
        clearTimeout(session.timeoutHandle);
        session.timeoutHandle = null;
        session.status = "active";
      }

      const joinerMedia = session.participants.get(userId).media;
      io.to(getCallRoom(callId)).emit("call:join", {
        callId,
        user: {
          ...socket.data.user,
          audioMuted: joinerMedia.audioMuted,
          videoMuted: joinerMedia.videoMuted,
          videoSource: joinerMedia.videoSource,
        },
        status: session.status,
      });

      // Return ACK with call context
      return maybeAck(callback, {
        success: true,
        conversationId: session.conversationId,
        conversationType: session.conversationType,
        isInitiator: userId === session.initiatorId,
        participants: Array.from(session.participants.values()).map((p) => ({
          ...p.user,
          audioMuted: p.media.audioMuted,
          videoMuted: p.media.videoMuted,
          videoSource: p.media.videoSource,
        })),
        status: session.status,
      });
    } catch (err) {
      console.error("call:join error", err);
      return maybeAck(callback, { success: false, error: "Internal error" });
    }
  });

  socket.on("call:leave", (payload = {}) => {
    const { callId } = payload;
    if (!callId) return;
    handleUserLeave(io, socket, callId, "leave");
  });

  // Callee declines incoming call
  socket.on("call:decline", (payload = {}) => {
    const { callId } = payload;
    if (!callId || !callSessions.has(callId)) return;

    const session = callSessions.get(callId);
    const userId = socket.data.user?.id;
    if (!userId) return;

    // Only callees who haven't joined can decline
    if (!session.callees.has(userId) || session.participants.has(userId)) {
      return;
    }

    // Track this callee has responded
    session.responded.add(userId);

    // Check if all callees have now declined and no callee ever joined.
    // The only participant allowed at this point is the initiator.
    if (session.responded.size === session.callees.size && session.participants.size <= 1) {
      // All declined, no one in call - end immediately
      endCallForAll(io, callId, "all_declined");
    }
  });

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

  socket.on("call:media-state", (payload = {}) => {
    const { callId, audioMuted, videoMuted, videoSource } = payload;
    if (!callId || !callSessions.has(callId)) return;

    const userId = socket.data.user?.id;
    if (!userId) return;

    const session = callSessions.get(callId);
    if (!session.participants.has(userId)) return;

    const currentMedia = session.participants.get(userId).media;
    const updatedMedia = {
      audioMuted: audioMuted !== undefined ? audioMuted : currentMedia.audioMuted,
      videoMuted: videoMuted !== undefined ? videoMuted : currentMedia.videoMuted,
      videoSource: videoSource !== undefined ? videoSource : currentMedia.videoSource,
    };
    session.participants.get(userId).media = updatedMedia;

    socket.to(getCallRoom(callId)).emit("call:media-state", {
      callId,
      userId,
      audioMuted: updatedMedia.audioMuted,
      videoMuted: updatedMedia.videoMuted,
      videoSource: updatedMedia.videoSource,
    });
  });

  socket.on("disconnect", () => {
    const userId = socket.data.user?.id;
    if (!userId) return;

    for (const [callId, session] of callSessions) {
      if (session.participants.has(userId)) {
        handleUserLeave(io, socket, callId, "disconnect");
      }
    }
  });
}

function handleUserLeave(io, socket, callId, reason) {
  const session = callSessions.get(callId);
  if (!session) return;

  const userId = socket.data.user?.id;
  if (!userId || !session.participants.has(userId)) return;

  const participant = session.participants.get(userId);

  // Remove this socket from user's socket set (multi-tab support)
  participant.socketIds.delete(socket.id);
  socket.leave(getCallRoom(callId));

  // Only fully remove user if all their sockets have left
  if (participant.socketIds.size === 0) {
    session.participants.delete(userId);

    // Notify others (include conversationId so UI can update the right chat)
    socket.to(getCallRoom(callId)).emit("call:leave", {
      callId,
      conversationId: session.conversationId,
      user: socket.data.user,
      reason,
    });

    if (session.participants.size < 2) {
      endCallForAll(io, callId, "insufficient_participants");
    }
  }
}

function endCallForAll(io, callId, reason) {
  const session = callSessions.get(callId);
  if (!session) return;

  const callRoom = getCallRoom(callId);
  const payload = {
    callId,
    conversationId: session.conversationId,
    reason,
  };

  io.to(callRoom).emit("call:end", payload);
  io.to(getConversationRoom(session.conversationId)).emit("call:end", payload);

  // Force all sockets to leave the call room to prevent stale room membership
  // This is important for CSR (Connection State Recovery) consistency
  io.socketsLeave(callRoom);

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

export { handleCall, CALL_TIMEOUT_MS, callSessions };
