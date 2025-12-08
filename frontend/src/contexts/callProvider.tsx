import { useCallback, useMemo, useState } from "react";
import { CallContext } from "./callContext";
import type {
  CallContextValue,
  CallParticipant,
  CallStatus,
  CallJoinAck,
  ConversationType,
} from "@/types/call.type";
import useSocket from "@/hooks/context/useSocket";
import { useCallSockets } from "@/hooks/sockets/useCallSockets";

function getInitialStatus(): CallStatus {
  return "ended"; // treated as idle; UI logic will reset to specific states
}

/**
 * Provides call state + actions to the entire app.
 */
export function CallProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { socket } = useSocket();
  const [status, setStatus] = useState<CallStatus>(getInitialStatus());
  const [callId, setCallId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversationType, setConversationType] =
    useState<ConversationType | null>(null);
  const [isInitiator, setIsInitiator] = useState<boolean>(false);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [incomingCall, setIncomingCall] =
    useState<CallContextValue["incomingCall"]>(null);
  const [endReason, setEndReason] =
    useState<CallContextValue["endReason"]>(null);

  // Fully reset call-related state back to a neutral value.
  const resetCall = useCallback((): void => {
    // Clear identifiers and participants so a new call starts clean.
    setCallId(null);
    setConversationId(null);
    setConversationType(null);
    setParticipants([]);
    setIncomingCall(null);
    setEndReason(null);
    setIsInitiator(false);
    // Mark as ended; UI can interpret this as \"no active call\".
    setStatus("ended");
  }, []);

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

  // Caller starts a new call from a conversation (chat tab).
  const initiateCall = useCallback(
    async (targetConversationId: number): Promise<void> => {
      if (!socket || !socket.connected) {
        console.error("Socket is not connected; aborting initiateCall.");
        return;
      }
      // Clear any previous terminal state before starting a new call.
      setEndReason(null);
      setIsInitiator(true);
      setStatus("connecting"); // UI can show a lightweight spinner or disabled button.
      socket.emit(
        "call:initiate",
        { conversationId: targetConversationId },
        (ack: { success: boolean; callId?: string; error?: string }) => {
          if (!ack?.success || !ack.callId) {
            console.error("Backend rejected the call initiation:", ack.error);
            resetCall();
            return;
          }
          // Persist call metadata on the chat tab.
          setCallId(ack.callId);
          setConversationId(targetConversationId);
          // Open the dedicated call page in a new tab, as per product decision.
          window.open(`/call/${ack.callId}`, "_blank");
        }
      );
    },
    [
      socket,
      setEndReason,
      setIsInitiator,
      setStatus,
      setCallId,
      setConversationId,
      resetCall,
    ]
  );

  // Callee accepts incoming call from chat tab.
  const acceptCall = useCallback((): void => {
    if (!incomingCall) {
      console.warn("acceptCall called but no incomingCall payload exists.");
      return;
    }
    // Close the dialog and keep metadata so chat tab can still reflect the call state.
    setIncomingCall(null);
    setStatus("connecting");
    setCallId(incomingCall.callId);
    setConversationId(incomingCall.conversationId);
    setIsInitiator(false);
    // Open dedicated call page in new tab immediately.
    window.open(`/call/${incomingCall.callId}`, "_blank");
  }, [
    incomingCall,
    setIncomingCall,
    setStatus,
    setCallId,
    setConversationId,
    setIsInitiator,
  ]);

  // Callee declines an incoming call from the chat tab.
  const declineCall = useCallback((): void => {
    if (!incomingCall) {
      console.warn("declineCall called but no incomingCall payload exists.");
      return;
    }

    const currentCallId = incomingCall.callId;
    // Best-effort emit; even if socket is unavailable we still close the dialog.
    if (!socket || !socket.connected) {
      console.error(
        "Socket is not connected; proceeding to locally decline call."
      );
    } else {
      socket.emit("call:decline", { callId: currentCallId });
    }
    // Locally move this tab back to an idle/ended state.
    // Server may still emit a global call:end with reason=all_declined, which
    // will be handled by useCallSockets and can overwrite endReason/status.
    resetCall();
  }, [incomingCall, socket, resetCall]);

  // Join an existing call by callId (used by CallPage on mount).
  const joinCall = useCallback(
    async (targetCallId: string): Promise<CallJoinAck> => {
      if (!socket || !socket.connected) {
        console.error("Socket is not connected; aborting joinCall.");
        return { success: false, error: "Socket not connected" };
      }

      setEndReason(null);
      setStatus("connecting");

      return new Promise<CallJoinAck>((resolve) => {
        socket.emit(
          "call:join",
          { callId: targetCallId },
          (ack: CallJoinAck) => {
            if (!ack || !ack.success) {
              console.error("Failed to join call:", ack?.error);
              resetCall();
              resolve(ack || { success: false, error: "Unknown error" });
              return;
            }

            // Use backend status as single source of truth
            setCallId(targetCallId);
            setConversationId(ack.conversationId);
            setConversationType(ack.conversationType);
            setIsInitiator(ack.isInitiator);
            setParticipants(ack.participants);
            setStatus(ack.status);
            setIncomingCall(null);
            resolve(ack);
          }
        );
      });
    },
    [socket, resetCall]
  );

  // Participant leaves the current call (used by CallPage hang-up).
  const leaveCall = useCallback((): void => {
    if (!callId) {
      console.warn("leaveCall called but no active callId is set.");
      return;
    }

    if (!socket || !socket.connected) {
      console.error(
        "Socket is not connected; proceeding to locally leave call."
      );
    } else {
      socket.emit("call:leave", { callId });
    }

    // Mark this tab's perspective as ended due to a local leave.
    // Keep callId/conversationId/participants so  CallPage or other UI can still show \"Call ended\" state and/or
    // offer a rejoin affordance while the server-side call may still exist.
    setEndReason("leave");
    setStatus("ended");
    setConversationType(null);
  }, [callId, socket]);

  // Initiator ends the call for everyone (used e.g. cancel while ringing).
  const endCall = useCallback((): void => {
    if (!callId) {
      console.warn("endCall called but no active callId is set.");
      return;
    }

    if (!isInitiator) {
      console.warn(
        "endCall ignored because current user is not the call initiator."
      );
      return;
    }

    if (!socket || !socket.connected) {
      console.error("Socket is not connected; proceeding to locally end call.");
    } else {
      socket.emit("call:end", { callId });
    }

    // From this tab's perspective, the call is ended for everyone.
    // Keep metadata so UI can show a \"Call ended\" screen/toast and then decide when to call resetCall
    setEndReason("ended");
    setStatus("ended");
    setConversationType(null);
  }, [callId, isInitiator, socket]);

  const value = useMemo<CallContextValue>(
    () => ({
      status,
      callId,
      conversationId,
      conversationType,
      isInitiator,
      participants,
      incomingCall,
      endReason,
      initiateCall,
      acceptCall,
      declineCall,
      joinCall,
      leaveCall,
      endCall,
      resetCall,
    }),
    [
      status,
      callId,
      conversationId,
      conversationType,
      isInitiator,
      participants,
      incomingCall,
      endReason,
      initiateCall,
      acceptCall,
      declineCall,
      joinCall,
      leaveCall,
      endCall,
      resetCall,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
