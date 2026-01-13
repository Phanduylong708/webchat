import type { User } from "./chat.type";

export type CallStatus = "ringing" | "connecting" | "active" | "ended";

export type CallEndReason =
  | "ended" // User manually ended
  | "timeout" // No one answered within timeout
  | "all_declined" // All callees declined
  | "insufficient_participants" // Less than 2 participants remaining
  | "leave" // User left the call
  | "disconnect"; // User disconnected

// Call Participant (User with media state)
export interface CallParticipant extends User {
  audioMuted: boolean;
  videoMuted: boolean;
  videoSource?: "camera" | "screen";
}

// Socket Event Payloads (from server)

export type ConversationType = "PRIVATE" | "GROUP";

export interface CallInitiatePayload {
  callId: string;
  conversationId: number;
  caller: CallParticipant;
  timeoutMs: number;
}

/** Payload received when someone joins a call */
export interface CallJoinPayload {
  callId: string;
  user: CallParticipant;
  status: CallStatus;
}

/** Payload received when someone leaves a call */
export interface CallLeavePayload {
  callId: string;
  conversationId: number;
  user: CallParticipant;
  reason: "leave" | "disconnect";
}

/** Payload received when a call ends */
export interface CallEndPayload {
  callId: string;
  conversationId: number;
  reason: CallEndReason;
}

/** Payload received when a participant's media state changes */
export interface CallMediaStatePayload {
  callId: string;
  userId: number;
  audioMuted: boolean;
  videoMuted: boolean;
  videoSource?: "camera" | "screen";
}

/** ACK response from call:join */
export type CallJoinAck =
  | {
      success: true;
      conversationId: number;
      conversationType: ConversationType;
      isInitiator: boolean;
      participants: CallParticipant[];
      status: CallStatus;
    }
  | { success: false; error: string };

export interface IncomingCall {
  callId: string;
  conversationId: number;
  caller: CallParticipant;
}

export interface CallState {
  status: CallStatus;
  callId: string | null;
  conversationId: number | null;
  conversationType: ConversationType | null;
  isInitiator: boolean;
  participants: CallParticipant[];
  incomingCall: IncomingCall | null;
  endReason: CallEndReason | null;
}

export interface CallContextValue extends CallState {
  /** Initiate a call for a conversation (caller) */
  initiateCall: (conversationId: number) => Promise<void>;
  /** Accept incoming call (callee) - opens call page */
  acceptCall: () => void;
  /** Decline incoming call (callee) - emits call:decline */
  declineCall: () => void;
  /** Join a call by callId (used by CallPage on mount) */
  joinCall: (callId: string) => Promise<CallJoinAck>;
  /** Leave the current call */
  leaveCall: () => void;
  /** End the call for everyone */
  endCall: () => void;
  /** Reset call state to idle */
  resetCall: () => void;
}

export const callEndReasonMessages: Record<CallEndReason, string> = {
  ended: "Call ended",
  timeout: "No answer",
  all_declined: "Everyone declined the call",
  insufficient_participants: "Call ended",
  leave: "Call ended",
  disconnect: "Call ended",
};
