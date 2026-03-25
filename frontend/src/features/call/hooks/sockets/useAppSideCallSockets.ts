import { useEffect } from "react";
import useSocket from "@/app/providers/useSocket";
import {
  selectClearAppSideCallState,
  selectReceiveIncomingCall,
  useAppSideCallStore,
} from "@/features/call/stores/appSideCallStore";
import type { CallEndPayload, CallInitiatePayload } from "@/features/call/types/call.type";

// Note 1: This hook listens only for app-side call events.
// It is meant for pages like chat/friends, where the user can see an incoming
// call dialog or have the call button disabled, but is not inside the call tab.
export function useAppSideCallSockets(): void {
  const { socket } = useSocket();
  const receiveIncomingCall = useAppSideCallStore(selectReceiveIncomingCall);
  const clearAppSideCallState = useAppSideCallStore(selectClearAppSideCallState);

  useEffect(() => {
    if (!socket) return;

    function handleIncoming(payload: CallInitiatePayload) {
      receiveIncomingCall({
        callId: payload.callId,
        conversationId: payload.conversationId,
        caller: payload.caller,
      });
    }

    // Note 2: `call:end` is emitted broadly to the conversation room, so this
    // guard prevents an unrelated end event from clearing this tab's current call.
    function handleEnded(payload: CallEndPayload) {
      const currentCallId = useAppSideCallStore.getState().currentCallId;
      if (currentCallId && payload.callId !== currentCallId) return;
      clearAppSideCallState();
    }

    socket.on("call:initiate", handleIncoming);
    socket.on("call:end", handleEnded);
    return () => {
      socket.off("call:initiate", handleIncoming);
      socket.off("call:end", handleEnded);
    };
  }, [socket, receiveIncomingCall, clearAppSideCallState]);
}
