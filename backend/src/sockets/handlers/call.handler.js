import { getConversationRoom, getCallRoom } from "../helpers/helpers.js";

// In-memory call sessions (reset on server restart). Flesh out in later steps.
const callSessions = new Map();
const CALL_TIMEOUT_MS = 30_000;

function handleCall(io, socket) {
  socket.on("call:initiate", (payload) => {
    // TODO: validate auth + membership, create/record callId, set timeout
    // TODO: emit call:initiate (ring) to conversation room with call metadata
  });

  socket.on("call:join", (payload) => {
    // TODO: validate callId exists and user is allowed, then join call room
    // TODO: mark participant accepted, possibly clear timeout
  });

  socket.on("call:offer", (payload) => {
    // TODO: bridge offer via call room
    // socket.to(getCallRoom(callId)).emit("call:offer", payload);
  });

  socket.on("call:answer", (payload) => {
    // TODO: bridge answer via call room
    // socket.to(getCallRoom(callId)).emit("call:answer", payload);
  });

  socket.on("call:candidate", (payload) => {
    // TODO: bridge ICE candidate via call room
    // socket.to(getCallRoom(callId)).emit("call:candidate", payload);
  });

  socket.on("call:end", (payload) => {
    // TODO: emit end with reason to call room (and/or conversation) and cleanup
  });
}

export { handleCall, getCallRoom, CALL_TIMEOUT_MS, callSessions };
