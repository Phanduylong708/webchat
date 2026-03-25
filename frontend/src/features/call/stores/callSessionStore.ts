import { create } from "zustand";
import { getSocket } from "@/lib/socket.client";
import type {
  CallEndReason,
  CallJoinAck,
  CallJoinPayload,
  CallLeavePayload,
  CallMediaStatePayload,
  CallParticipant,
  CallStatus,
  ConversationType,
} from "@/features/call/types/call.type";

// Note 1: This store models the call tab only.
// It owns the state that matters after `/call/:callId` opens, so it does not
// try to track incoming-call dialog state or button-locking for the app shell.

export type CallSessionStatus = "idle" | "connecting" | "active" | "ended";

export interface CallSessionState {
  // Note 2: `idle` and `ended` are intentionally separate.
  // `idle` means "no session is active yet", while `ended` means "a real call
  // existed and has now finished", which lets the call page show an ended UI
  // without reusing one state value for two different meanings.
  status: CallSessionStatus;
  callId: string | null;
  conversationId: number | null;
  conversationType: ConversationType | null;
  isInitiator: boolean;
  participants: CallParticipant[];
  endReason: CallEndReason | null;

  beginJoinCall: (callId: string) => void;
  resolveJoinCallAck: (callId: string, ack: CallJoinAck) => void;
  receiveParticipantJoined: (payload: CallJoinPayload) => void;
  receiveParticipantLeft: (payload: CallLeavePayload) => void;
  receiveParticipantMediaState: (payload: CallMediaStatePayload) => void;
  markCallEnded: (reason: CallEndReason) => void;
  leaveCurrentCall: () => void;
  endCurrentCall: () => void;
  clearCallSession: () => void;
}

// Note 3: Keeping the reset shape in one constant avoids accidental partial
// resets where one old field survives into the next call.
const initialCallSessionState = {
  status: "idle" as CallSessionStatus,
  callId: null,
  conversationId: null,
  conversationType: null,
  isInitiator: false,
  participants: [],
  endReason: null,
};

// Note 4: The backend still speaks in its older status language, where a call
// may be `ringing`. The call-page store collapses `ringing` into `connecting`
// because the call tab only needs to know "not active yet" versus "active".
function toSessionStatus(status: CallStatus): CallSessionStatus {
  if (status === "active") return "active";
  if (status === "ended") return "ended";
  return "connecting";
}

// Note 5: Socket events may describe the same participant more than once.
// For example, a later join event can carry fresher media flags for a user who
// is already present, so this helper updates in place instead of duplicating.
function upsertParticipant(
  participants: CallParticipant[],
  incomingParticipant: CallParticipant,
): CallParticipant[] {
  const existingIndex = participants.findIndex((participant) => participant.id === incomingParticipant.id);
  if (existingIndex === -1) return [...participants, incomingParticipant];

  return participants.map((participant) =>
    participant.id === incomingParticipant.id ? { ...participant, ...incomingParticipant } : participant,
  );
}

export const useCallSessionStore = create<CallSessionState>((set, get) => ({
  ...initialCallSessionState,

  // Note 6: Joining starts with the smallest reliable fact: "we know which call
  // we are trying to join, and we are now waiting for the join ack".
  beginJoinCall: (callId) =>
    set({
      status: "connecting",
      callId,
      endReason: null,
    }),

  // Note 7: The join ack is the first payload that contains the full session
  // snapshot, so this action is the main bridge from server truth into store
  // state for the initial render of the call tab.
  resolveJoinCallAck: (callId, ack) => {
    if (!ack.success) {
      set({ ...initialCallSessionState });
      return;
    }

    set({
      status: toSessionStatus(ack.status),
      callId,
      conversationId: ack.conversationId,
      conversationType: ack.conversationType,
      isInitiator: ack.isInitiator,
      participants: ack.participants,
      endReason: null,
    });
  },

  // Note 8: Later socket events become small, focused patches.
  // Each action updates one concern only, which makes event-to-state flow much
  // easier to trace than a single giant reducer-style callback.
  receiveParticipantJoined: (payload) =>
    set((state) => ({
      status: toSessionStatus(payload.status),
      participants: upsertParticipant(state.participants, payload.user),
    })),

  receiveParticipantLeft: (payload) =>
    set((state) => ({
      participants: state.participants.filter((participant) => participant.id !== payload.user.id),
    })),

  receiveParticipantMediaState: (payload) =>
    set((state) => ({
      participants: state.participants.map((participant) =>
        participant.id === payload.userId
          ? {
              ...participant,
              audioMuted: payload.audioMuted,
              videoMuted: payload.videoMuted,
              videoSource: payload.videoSource,
            }
          : participant,
      ),
    })),

  markCallEnded: (reason) =>
    set({
      status: "ended",
      endReason: reason,
    }),

  leaveCurrentCall: () => {
    const { callId } = get();
    if (!callId) return;

    // Note 9: Leaving is best-effort from the tab's point of view.
    // If the socket is already gone, the local page should still move to the
    // ended state instead of getting stuck behind transport details.
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("call:leave", { callId });
    }

    set({
      status: "ended",
      endReason: "leave",
    });
  },

  endCurrentCall: () => {
    const { callId, isInitiator } = get();
    if (!callId || !isInitiator) return;

    // Note 10: Only the initiator is allowed to end the whole call for everyone.
    // Non-initiators use `leaveCurrentCall`, which models a different user intent.
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("call:end", { callId });
    }

    set({
      status: "ended",
      endReason: "ended",
    });
  },

  clearCallSession: () => set({ ...initialCallSessionState }),
}));

// Note 11: These selectors let consumers subscribe to exactly the field or
// action they need, which keeps components simpler and avoids unrelated re-renders.
export const selectCallSessionStatus = (state: CallSessionState) => state.status;
export const selectCallSessionCallId = (state: CallSessionState) => state.callId;
export const selectCallSessionConversationId = (state: CallSessionState) => state.conversationId;
export const selectCallSessionConversationType = (state: CallSessionState) => state.conversationType;
export const selectCallSessionIsInitiator = (state: CallSessionState) => state.isInitiator;
export const selectCallSessionParticipants = (state: CallSessionState) => state.participants;
export const selectCallSessionEndReason = (state: CallSessionState) => state.endReason;

export const selectBeginJoinCall = (state: CallSessionState) => state.beginJoinCall;
export const selectResolveJoinCallAck = (state: CallSessionState) => state.resolveJoinCallAck;
export const selectReceiveParticipantJoined = (state: CallSessionState) => state.receiveParticipantJoined;
export const selectReceiveParticipantLeft = (state: CallSessionState) => state.receiveParticipantLeft;
export const selectReceiveParticipantMediaState = (state: CallSessionState) =>
  state.receiveParticipantMediaState;
export const selectMarkCallEnded = (state: CallSessionState) => state.markCallEnded;
export const selectLeaveCurrentCall = (state: CallSessionState) => state.leaveCurrentCall;
export const selectEndCurrentCall = (state: CallSessionState) => state.endCurrentCall;
export const selectClearCallSession = (state: CallSessionState) => state.clearCallSession;
