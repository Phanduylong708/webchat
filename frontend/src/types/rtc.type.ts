import type { MeshRTCManager } from "@/lib/videocall/webrtcManager";

// Map<userId, MediaStream|null>
export type RemoteStreamsMap = Map<number, MediaStream | null>;
// Map<userId, RTCPeerConnectionState>
export type ConnectionStatesMap = Map<number, RTCPeerConnectionState>;
// Map<userId, error message|null>
export type ErrorStatesMap = Map<number, string | null>;

// RTC Context Value - exposes remote streams, connection states, and manager access
export interface RTCContextValue {
  remoteStreams: RemoteStreamsMap; // remote streams per user
  connectionStates: ConnectionStatesMap; // connection state per user
  errorStates: ErrorStatesMap; // error message per user
  isManagerReady: boolean; // true when MeshRTCManager is initialized
  isLocalStreamSynced: boolean; // true when local stream has been synced to manager
  getManager(): MeshRTCManager | null; // underlying MeshRTCManager (null if not ready)
  getRemoteStream(userId: number): MediaStream | null; // helper to get remote stream
  getConnectionState(userId: number): RTCPeerConnectionState | null; // helper to get state
  getErrorState(userId: number): string | null; // helper to get error
}

// Signaling event payloads for WebRTC (match socket events defined in backend)
export interface CallOfferPayload {
  callId: string;
  fromUserId: number;
  toUserId: number;
  offer: RTCSessionDescriptionInit;
}

export interface CallAnswerPayload {
  callId: string;
  fromUserId: number;
  toUserId: number;
  answer: RTCSessionDescriptionInit;
}

export interface CallCandidatePayload {
  callId: string;
  fromUserId: number;
  toUserId: number;
  candidate: RTCIceCandidateInit;
}
