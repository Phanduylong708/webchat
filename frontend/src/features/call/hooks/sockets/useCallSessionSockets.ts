import { useEffect } from "react";
import useSocket from "@/app/providers/useSocket";
import {
  selectCallSessionCallId,
  selectMarkCallEnded,
  selectReceiveParticipantJoined,
  selectReceiveParticipantLeft,
  selectReceiveParticipantMediaState,
  useCallSessionStore,
} from "@/features/call/stores/callSessionStore";
import type {
  CallEndPayload,
  CallJoinPayload,
  CallLeavePayload,
  CallMediaStatePayload,
} from "@/features/call/types/call.type";

// Note 1: This hook listens only for events that matter after the call tab has
// already opened and chosen a specific `callId` to follow.
export function useCallSessionSockets(): void {
  const { socket } = useSocket();
  const callId = useCallSessionStore(selectCallSessionCallId);
  const receiveParticipantJoined = useCallSessionStore(selectReceiveParticipantJoined);
  const receiveParticipantLeft = useCallSessionStore(selectReceiveParticipantLeft);
  const receiveParticipantMediaState = useCallSessionStore(selectReceiveParticipantMediaState);
  const markCallEnded = useCallSessionStore(selectMarkCallEnded);

  useEffect(() => {
    if (!socket || !callId) return;

    function handleJoined(payload: CallJoinPayload) {
      if (payload.callId !== callId) return;
      receiveParticipantJoined(payload);
    }

    function handleLeft(payload: CallLeavePayload) {
      if (payload.callId !== callId) return;
      receiveParticipantLeft(payload);
    }

    // Note 2: Media updates are frequent and narrow, so we patch only the one
    // participant that changed instead of rebuilding any other session fields.
    function handleMediaState(payload: CallMediaStatePayload) {
      if (payload.callId !== callId) return;
      receiveParticipantMediaState(payload);
    }

    function handleEnded(payload: CallEndPayload) {
      if (payload.callId !== callId) return;
      markCallEnded(payload.reason);
    }

    socket.on("call:join", handleJoined);
    socket.on("call:leave", handleLeft);
    socket.on("call:media-state", handleMediaState);
    socket.on("call:end", handleEnded);
    return () => {
      socket.off("call:join", handleJoined);
      socket.off("call:leave", handleLeft);
      socket.off("call:media-state", handleMediaState);
      socket.off("call:end", handleEnded);
    };
  }, [
    socket,
    callId,
    receiveParticipantJoined,
    receiveParticipantLeft,
    receiveParticipantMediaState,
    markCallEnded,
  ]);
}
