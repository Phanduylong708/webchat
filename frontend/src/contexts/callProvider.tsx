import { useMemo, useState, type JSX } from "react";
import { CallContext } from "./callContext";
import type {
  CallContextValue,
  CallParticipant,
  CallStatus,
} from "@/types/call.type";
import useSocket from "@/hooks/context/useSocket";
import { useCallSockets } from "@/hooks/sockets/useCallSockets";

const INITIAL_PARTICIPANTS: CallParticipant[] = [];

function getInitialStatus(): CallStatus {
  return "ended"; // treated as idle; UI logic will reset to specific states
}

/**
 * Provides call state + actions to the entire app.
 * Outgoing socket events will be implemented in the next step.
 */
export function CallProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const { socket } = useSocket();

  const [status, setStatus] = useState<CallStatus>(getInitialStatus());
  const [callId, setCallId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isInitiator, setIsInitiator] = useState<boolean>(false);
  const [participants, setParticipants] =
    useState<CallParticipant[]>(INITIAL_PARTICIPANTS);
  const [incomingCall, setIncomingCall] =
    useState<CallContextValue["incomingCall"]>(null);
  const [endReason, setEndReason] =
    useState<CallContextValue["endReason"]>(null);

  // Wire server → client events
  useCallSockets({
    socket,
    setStatus,
    setCallId,
    setConversationId,
    setIsInitiator,
    setParticipants,
    setIncomingCall,
    setEndReason,
  });

  const value = useMemo<CallContextValue>(
    () => ({
      status,
      callId,
      conversationId,
      isInitiator,
      participants,
      incomingCall,
      endReason,
      initiateCall: async () => {
        // TODO Step 3 actions: emit call:initiate and open call tab
      },
      acceptCall: () => {
        // TODO Step 3 actions: open call tab for callee
      },
      declineCall: () => {
        // TODO Step 3 actions: emit call:decline
      },
      joinCall: async () => {
        // TODO Step 3 actions: emit call:join and handle ACK
        return false;
      },
      leaveCall: () => {
        // TODO Step 3 actions
      },
      endCall: () => {
        // TODO Step 3 actions
      },
      resetCall: () => {
        // TODO Step 3 actions: reset state
      },
    }),
    [
      status,
      callId,
      conversationId,
      isInitiator,
      participants,
      incomingCall,
      endReason,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
