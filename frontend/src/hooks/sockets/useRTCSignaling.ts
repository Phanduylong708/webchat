import { useEffect, useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { MeshRTCManager } from "@/lib/videocall/webrtcManager";
import type {
  CallOfferPayload,
  CallAnswerPayload,
  CallCandidatePayload,
} from "@/types/rtc.type";

interface UseRTCSignalingParams {
  socket: Socket | null;
  callId: string | null;
  currentUserId: number | null;
  getManager: () => MeshRTCManager | null;
  isManagerReady: boolean;
}

/**
 * Handles WebRTC signaling over socket.io.
 * - Listens for call:offer, call:answer, call:candidate events
 * - Emits call:answer, call:candidate when needed
 * - Registers onIceCandidate callback on manager
 * - Queues signaling events if manager not ready, flushes when ready
 *
 * NOTE: Does NOT handle onNegotiationNeeded (v1 - peer mới manual createOffer)
 */
export function useRTCSignaling({
  socket,
  callId,
  currentUserId,
  getManager,
  isManagerReady,
}: UseRTCSignalingParams): void {
  // Use ref for getManager to avoid dependency churn
  const getManagerRef = useRef(getManager);
  getManagerRef.current = getManager;

  // Queues for signaling events that arrive before manager is ready
  const offerQueueRef = useRef<CallOfferPayload[]>([]);
  const answerQueueRef = useRef<CallAnswerPayload[]>([]);
  const candidateQueueRef = useRef<CallCandidatePayload[]>([]);

  // Build peerId from callId and userId
  const buildPeerId = useCallback(
    (userId: number): string => {
      return `${callId}_${userId}`;
    },
    [callId]
  );

  // Process a single offer (used by both live handler and queue flush)
  const processOffer = useCallback(
    async (
      payload: CallOfferPayload,
      manager: MeshRTCManager,
      emitSocket: Socket,
      userId: number
    ) => {
      const peerId = buildPeerId(payload.fromUserId);
      console.log("[useRTCSignaling] Processing offer from:", peerId);

      try {
        const answer = await manager.handleRemoteOffer(peerId, payload.offer);
        const answerPayload: CallAnswerPayload = {
          callId: payload.callId,
          fromUserId: userId,
          toUserId: payload.fromUserId,
          answer: answer,
        };
        emitSocket.emit("call:answer", answerPayload);
        console.log("[useRTCSignaling] Sent answer to:", peerId);
      } catch (err) {
        console.error("[useRTCSignaling] Failed to process offer:", err);
      }
    },
    [buildPeerId]
  );

  // Process a single answer
  const processAnswer = useCallback(
    async (payload: CallAnswerPayload, manager: MeshRTCManager) => {
      const peerId = buildPeerId(payload.fromUserId);
      console.log("[useRTCSignaling] Processing answer from:", peerId);

      try {
        await manager.handleRemoteAnswer(peerId, payload.answer);
        console.log("[useRTCSignaling] Applied answer from:", peerId);
      } catch (err) {
        console.error("[useRTCSignaling] Failed to process answer:", err);
      }
    },
    [buildPeerId]
  );

  // Process a single candidate
  const processCandidate = useCallback(
    async (payload: CallCandidatePayload, manager: MeshRTCManager) => {
      const peerId = buildPeerId(payload.fromUserId);

      try {
        await manager.addIceCandidate(peerId, payload.candidate);
      } catch (err) {
        console.error("[useRTCSignaling] Failed to add ICE candidate:", err);
      }
    },
    [buildPeerId]
  );

  // Flush queued events when manager becomes ready
  useEffect(() => {
    if (!isManagerReady || !socket || currentUserId === null) return;

    const manager = getManagerRef.current();
    if (!manager) return;

    const currentSocket = socket;
    const userId = currentUserId;

    // Flush offer queue
    const offers = offerQueueRef.current.splice(0);
    if (offers.length > 0) {
      console.log("[useRTCSignaling] Flushing", offers.length, "queued offers");
      for (const offer of offers) {
        void processOffer(offer, manager, currentSocket, userId);
      }
    }

    // Flush answer queue
    const answers = answerQueueRef.current.splice(0);
    if (answers.length > 0) {
      console.log("[useRTCSignaling] Flushing", answers.length, "queued answers");
      for (const answer of answers) {
        void processAnswer(answer, manager);
      }
    }

    // Flush candidate queue
    const candidates = candidateQueueRef.current.splice(0);
    if (candidates.length > 0) {
      console.log("[useRTCSignaling] Flushing", candidates.length, "queued candidates");
      for (const candidate of candidates) {
        void processCandidate(candidate, manager);
      }
    }
  }, [isManagerReady, socket, currentUserId, processOffer, processAnswer, processCandidate]);

  // Handle incoming offer: create answer and emit
  useEffect(() => {
    if (!socket || !callId || currentUserId === null) return;

    const currentSocket = socket;
    const userId = currentUserId;

    async function handleOffer(payload: CallOfferPayload) {
      // Ignore offers not meant for us
      if (payload.toUserId !== userId) return;
      // Ignore offers for different calls
      if (payload.callId !== callId) return;

      const manager = getManagerRef.current();
      if (!manager) {
        // Queue offer for later processing
        console.log("[useRTCSignaling] Queueing offer (manager not ready):", payload.fromUserId);
        offerQueueRef.current.push(payload);
        return;
      }

      await processOffer(payload, manager, currentSocket, userId);
    }

    currentSocket.on("call:offer", handleOffer);
    return () => {
      currentSocket.off("call:offer", handleOffer);
    };
  }, [socket, callId, currentUserId, processOffer]);

  // Handle incoming answer: apply to peer connection
  useEffect(() => {
    if (!socket || !callId || currentUserId === null) return;

    const userId = currentUserId;

    async function handleAnswer(payload: CallAnswerPayload) {
      // Ignore answers not meant for us
      if (payload.toUserId !== userId) return;
      // Ignore answers for different calls
      if (payload.callId !== callId) return;

      const manager = getManagerRef.current();
      if (!manager) {
        // Queue answer for later processing
        console.log("[useRTCSignaling] Queueing answer (manager not ready):", payload.fromUserId);
        answerQueueRef.current.push(payload);
        return;
      }

      await processAnswer(payload, manager);
    }

    socket.on("call:answer", handleAnswer);
    return () => {
      socket.off("call:answer", handleAnswer);
    };
  }, [socket, callId, currentUserId, processAnswer]);

  // Handle incoming ICE candidate: add to peer connection
  useEffect(() => {
    if (!socket || !callId || currentUserId === null) return;

    const userId = currentUserId;

    async function handleCandidate(payload: CallCandidatePayload) {
      // Ignore candidates not meant for us
      if (payload.toUserId !== userId) return;
      // Ignore candidates for different calls
      if (payload.callId !== callId) return;

      const manager = getManagerRef.current();
      if (!manager) {
        // Queue candidate for later processing
        candidateQueueRef.current.push(payload);
        return;
      }

      await processCandidate(payload, manager);
    }

    socket.on("call:candidate", handleCandidate);
    return () => {
      socket.off("call:candidate", handleCandidate);
    };
  }, [socket, callId, currentUserId, processCandidate]);

  // Register onIceCandidate callback on manager to emit candidates
  // Re-run when isManagerReady changes (manager becomes available)
  useEffect(() => {
    if (!socket || !callId || currentUserId === null || !isManagerReady) return;

    const manager = getManagerRef.current();
    if (!manager) return;

    const currentSocket = socket;
    const userId = currentUserId;

    function emitIceCandidate(peerId: string, candidate: RTCIceCandidate) {
      // Parse userId from peerId (format: "callId_userId")
      const parts = peerId.split("_");
      const toUserId = parseInt(parts[1], 10);

      const payload: CallCandidatePayload = {
        callId: callId!,
        fromUserId: userId,
        toUserId,
        candidate: candidate.toJSON(),
      };
      currentSocket.emit("call:candidate", payload);
    }

    // Register callback - MeshRTCManager allows setting callbacks after construction
    manager.setOnIceCandidate(emitIceCandidate);

    return () => {
      // Clear the callback on cleanup
      manager.setOnIceCandidate(undefined);
    };
  }, [socket, callId, currentUserId, isManagerReady]);

  // Clear queues when callId changes (new call or leave call)
  useEffect(() => {
    return () => {
      offerQueueRef.current = [];
      answerQueueRef.current = [];
      candidateQueueRef.current = [];
    };
  }, [callId]);
}
