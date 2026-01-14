import type { Socket } from "socket.io-client";
import type { MeshRTCManager } from "@/lib/videocall/webrtcManager";
import type { CallParticipant } from "@/types/call.type";

// ============================================================================
// Map Types
// ============================================================================

// Map<userId, MediaStream|null>
export type RemoteStreamsMap = Map<number, MediaStream | null>;
// Map<userId, RTCPeerConnectionState>
export type ConnectionStatesMap = Map<number, RTCPeerConnectionState>;
// Map<userId, error message|null>
export type ErrorStatesMap = Map<number, string | null>;

// ============================================================================
// RTC Context Types
// ============================================================================

// RTC Context Value - exposes remote streams, connection states, and manager access
export interface RTCContextValue {
  remoteStreams: RemoteStreamsMap; // remote streams per user
  connectionStates: ConnectionStatesMap; // connection state per user
  errorStates: ErrorStatesMap; // error message per user
  remoteStreamsVersion: number; // version counter for useMemo dependencies
  isManagerReady: boolean; // true when MeshRTCManager is initialized
  isLocalStreamSynced: boolean; // true when local stream has been synced to manager
  getManager(): MeshRTCManager | null; // underlying MeshRTCManager (null if not ready)
  getRemoteStream(userId: number): MediaStream | null; // helper to get remote stream
  getConnectionState(userId: number): RTCPeerConnectionState | null; // helper to get state
  getErrorState(userId: number): string | null; // helper to get error
}

// ============================================================================
// Hook Parameter Types
// ============================================================================

// Parameters for useMeshManager hook
export interface UseMeshManagerParams {
  callId: string | null;
  onTrackUpdate: (userId: number, stream: MediaStream | null) => void;
  onConnectionStateChange: (userId: number, state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange: (userId: number, state: RTCIceConnectionState) => void;
  onPeerRemoved: (userId: number) => void;
  onIceCandidate: (peerId: string, candidate: RTCIceCandidate) => void;
  onReady?: (ready: boolean) => void;
}

// Parameters for useRTCPeerLifecycle hook
export interface UseRTCPeerLifecycleParams {
  socket: Socket | null;
  callId: string | null;
  currentUserId: number | null;
  participants: CallParticipant[];
  getManager: () => MeshRTCManager | null;
  isManagerReady: boolean;
  isLocalStreamSynced: boolean;
}

// Parameters for useRTCSignaling hook
export interface UseRTCSignalingParams {
  socket: Socket | null;
  callId: string | null;
  currentUserId: number | null;
  getManager: () => MeshRTCManager | null;
  isManagerReady: boolean;
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
