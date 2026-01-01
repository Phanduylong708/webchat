import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { Socket } from "socket.io-client";
import type {
  CallStatus,
  CallParticipant,
  IncomingCall,
  CallEndReason,
  CallInitiatePayload,
  CallJoinPayload,
  CallLeavePayload,
  CallEndPayload,
  CallMediaStatePayload,
} from "@/types/call.type";

interface UseCallSocketsParams {
  socket: Socket | null;
  setStatus: Dispatch<SetStateAction<CallStatus>>;
  setCallId: Dispatch<SetStateAction<string | null>>;
  setConversationId: Dispatch<SetStateAction<number | null>>;
  setIsInitiator: Dispatch<SetStateAction<boolean>>;
  setParticipants: Dispatch<SetStateAction<CallParticipant[]>>;
  setIncomingCall: Dispatch<SetStateAction<IncomingCall | null>>;
  setEndReason: Dispatch<SetStateAction<CallEndReason | null>>;
}

/**
 * Centralizes all socket listeners related to call signaling and state updates.
 * Mirrors the pattern used by useConversationSockets to keep Provider lean.
 *
 * This hook only handles incoming events (server → client).
 * Outgoing actions (emit call:initiate/join/leave/end/decline) live in the CallProvider.
 */
export function useCallSockets({
  socket,
  setStatus,
  setCallId,
  setConversationId,
  setIsInitiator,
  setParticipants,
  setIncomingCall,
  setEndReason,
}: UseCallSocketsParams): void {
  // Incoming call on chat tab (callee experience)
  useEffect(() => {
    if (!socket) return;

    function handleIncoming(payload: CallInitiatePayload) {
      // Store incoming call payload for dialog
      setIncomingCall({
        callId: payload.callId,
        conversationId: payload.conversationId,
        caller: payload.caller,
      });

      setStatus("ringing");
      setCallId(payload.callId);
      setConversationId(payload.conversationId);
      setIsInitiator(false);
    }

    socket.on("call:initiate", handleIncoming);
    return () => {
      socket.off("call:initiate", handleIncoming);
    };
  }, [
    socket,
    setIncomingCall,
    setStatus,
    setCallId,
    setConversationId,
    setIsInitiator,
  ]);

  // Participant joined active call room
  useEffect(() => {
    if (!socket) return;

    function handleJoin(payload: CallJoinPayload) {
      setStatus(payload.status);
      setParticipants((prev) => {
        const exists = prev.some((p) => p.id === payload.user.id);
        if (exists) {
          // Update existing participant's media state
          return prev.map((p) =>
            p.id === payload.user.id ? { ...p, ...payload.user } : p
          );
        }
        return [...prev, payload.user];
      });
    }

    socket.on("call:join", handleJoin);
    return () => {
      socket.off("call:join", handleJoin);
    };
  }, [socket, setParticipants, setStatus]);

  // Participant left (or disconnected) from active call room
  useEffect(() => {
    if (!socket) return;

    function handleLeave(payload: CallLeavePayload) {
      setParticipants((prev) => prev.filter((p) => p.id !== payload.user.id));
    }

    socket.on("call:leave", handleLeave);
    return () => {
      socket.off("call:leave", handleLeave);
    };
  }, [socket, setParticipants]);

  // Call ended for any reason
  useEffect(() => {
    if (!socket) return;

    function handleEnd(payload: CallEndPayload) {
      setEndReason(payload.reason);
      setStatus("ended");
      setIncomingCall(null);
      // Keep participants so UI can still show who was in the call.
      // Provider is responsible for when to fully reset call state.
    }

    socket.on("call:end", handleEnd);
    return () => {
      socket.off("call:end", handleEnd);
    };
  }, [socket, setEndReason, setStatus, setIncomingCall]);

  // Participant media state changed (remote only - self state comes from MediaContext)
  useEffect(() => {
    if (!socket) return;

    function handleMediaState(payload: CallMediaStatePayload) {
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === payload.userId
            ? { ...p, audioMuted: payload.audioMuted, videoMuted: payload.videoMuted }
            : p
        )
      );
    }

    socket.on("call:media-state", handleMediaState);
    return () => {
      socket.off("call:media-state", handleMediaState);
    };
  }, [socket, setParticipants]);
}
