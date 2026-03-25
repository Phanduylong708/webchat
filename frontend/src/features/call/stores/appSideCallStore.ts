import { create } from "zustand";
import { getSocket } from "@/lib/socket.client";
import type { IncomingCall } from "@/features/call/types/call.type";

// Note 1: This store exists for app-side call UI only: the pages where the user
// can see chat/friends and react to an incoming call. It intentionally does NOT
// try to model the full in-call session because that responsibility belongs to
// the dedicated call tab (`/call/:callId`).

type InitiateCallAck = {
  success: boolean;
  callId?: string;
  error?: string;
};

export interface AppSideCallState {
  // Note 2: `incomingCall` means "someone is currently calling this tab".
  // Keeping the full payload here lets the dialog render caller information
  // without having to look it up from some other source.
  incomingCall: IncomingCall | null;
  // Note 3: This flag is narrower than a generic "loading" boolean.
  // It only covers the window between `call:initiate` being emitted and the ack
  // coming back, which makes the UI intent easier to understand.
  isInitiatingCall: boolean;
  // Note 4: `currentCallId` is app-side coordination state.
  // The button uses it to know "this tab is already occupied by a call" even
  // before the real call session finishes joining in the separate call tab.
  currentCallId: string | null;

  receiveIncomingCall: (incomingCall: IncomingCall) => void;
  clearIncomingCall: () => void;
  clearAppSideCallState: () => void;
  setInitiatingCall: (value: boolean) => void;
  setCurrentCallId: (callId: string | null) => void;
  clearCurrentCallId: () => void;

  initiateCall: (conversationId: number) => Promise<void>;
  acceptIncomingCall: () => void;
  declineIncomingCall: () => void;
}

function openCallTab(callId: string): void {
  // Note 5: Opening the call in a separate tab is part of the current product
  // behavior, so this helper centralizes that browser side effect in one place.
  if (typeof window === "undefined") return;
  window.open(`/call/${callId}`, "_blank");
}

export const useAppSideCallStore = create<AppSideCallState>((set, get) => ({
  incomingCall: null,
  isInitiatingCall: false,
  currentCallId: null,

  // Note 6: Receiving an incoming call is a full state transition, not just a
  // field assignment. We set both `incomingCall` and `currentCallId` together so
  // the CallButton becomes disabled immediately while the dialog is visible.
  receiveIncomingCall: (incomingCall) =>
    set({
      incomingCall,
      currentCallId: incomingCall.callId,
      isInitiatingCall: false,
    }),

  clearIncomingCall: () => set({ incomingCall: null }),

  // Note 7: `clearIncomingCall` is intentionally narrow, but some flows need a
  // full reset of all app-side coordination state. This dedicated action keeps
  // that reset explicit and avoids fragile call sites that must remember to
  // clear three separate fields in the correct order.
  clearAppSideCallState: () =>
    set({
      incomingCall: null,
      currentCallId: null,
      isInitiatingCall: false,
    }),

  setInitiatingCall: (value) => set({ isInitiatingCall: value }),

  setCurrentCallId: (callId) => set({ currentCallId: callId }),

  clearCurrentCallId: () => set({ currentCallId: null }),

  initiateCall: async (conversationId) => {
    // Note 8: This guard protects against two common UI bugs:
    // 1) double-clicking the call button while an ack is still pending
    // 2) starting a second call while this tab is already tied to another call
    const { isInitiatingCall, currentCallId } = get();
    if (isInitiatingCall || currentCallId) {
      console.warn("initiateCall ignored because a call is already in progress.");
      return;
    }

    // Note 9: Zustand stores cannot use React hooks like `useSocket()`, so this
    // store talks to the same singleton socket client used elsewhere in the app.
    // That keeps the action self-contained without adding wrapper hooks just to
    // pass the socket object around.
    const socket = getSocket();
    if (!socket.connected) {
      console.error("Socket is not connected; aborting initiateCall.");
      return;
    }

    set({ isInitiatingCall: true });

    // Note 10: Wrapping the ack callback in a Promise lets callers `await`
    // `initiateCall()` like a normal async function, even though Socket.IO uses
    // callback-style acknowledgements instead of returning a promise itself.
    await new Promise<void>((resolve) => {
      socket.emit(
        "call:initiate",
        { conversationId },
        (ack: InitiateCallAck) => {
          // Note 11: The app-side tab only needs the generated `callId`.
          // The richer call session data is fetched later by the dedicated call
          // tab when it joins the session.
          if (!ack?.success || !ack.callId) {
            console.error("Backend rejected the call initiation:", ack?.error);
            set({ isInitiatingCall: false, currentCallId: null });
            resolve();
            return;
          }

          set({
            isInitiatingCall: false,
            currentCallId: ack.callId,
          });
          openCallTab(ack.callId);
          resolve();
        },
      );
    });
  },

  acceptIncomingCall: () => {
    // Note 12: Accepting does not directly join the media session here.
    // This tab only closes the dialog and opens the call page; the actual join
    // happens later inside the call-session flow on `/call/:callId`.
    const incomingCall = get().incomingCall;
    if (!incomingCall) {
      console.warn("acceptIncomingCall called without incomingCall.");
      return;
    }

    set({
      incomingCall: null,
      isInitiatingCall: false,
      currentCallId: incomingCall.callId,
    });
    openCallTab(incomingCall.callId);
  },

  declineIncomingCall: () => {
    // Note 13: Decline is only valid for a real incoming call.
    // We do NOT fall back to `currentCallId`, because that could belong to an
    // outgoing call and would send the wrong socket event for the wrong reason.
    const incomingCall = get().incomingCall;
    if (!incomingCall) {
      console.warn("declineIncomingCall called without incomingCall.");
      return;
    }

    const socket = getSocket();
    if (!socket.connected) {
      console.error("Socket is not connected; proceeding to locally decline call.");
    } else {
      socket.emit("call:decline", { callId: incomingCall.callId });
    }

    // Note 14: We clear local app-side state immediately even if the socket is
    // unavailable. That mirrors the current UX decision: close the dialog now,
    // then let later server events reconcile anything else.
    set({
      incomingCall: null,
      currentCallId: null,
      isInitiatingCall: false,
    });
  },
}));

// Note 15: Selectors keep component subscriptions narrow.
// For example, a button that only needs `currentCallId` should not re-render
// just because `incomingCall` changed.
export const selectIncomingCall = (state: AppSideCallState) => state.incomingCall;
export const selectIsInitiatingCall = (state: AppSideCallState) => state.isInitiatingCall;
export const selectCurrentCallId = (state: AppSideCallState) => state.currentCallId;

export const selectReceiveIncomingCall = (state: AppSideCallState) => state.receiveIncomingCall;
export const selectClearIncomingCall = (state: AppSideCallState) => state.clearIncomingCall;
export const selectClearAppSideCallState = (state: AppSideCallState) => state.clearAppSideCallState;
export const selectSetInitiatingCall = (state: AppSideCallState) => state.setInitiatingCall;
export const selectSetCurrentCallId = (state: AppSideCallState) => state.setCurrentCallId;
export const selectClearCurrentCallId = (state: AppSideCallState) => state.clearCurrentCallId;
export const selectInitiateCall = (state: AppSideCallState) => state.initiateCall;
export const selectAcceptIncomingCall = (state: AppSideCallState) => state.acceptIncomingCall;
export const selectDeclineIncomingCall = (state: AppSideCallState) => state.declineIncomingCall;
