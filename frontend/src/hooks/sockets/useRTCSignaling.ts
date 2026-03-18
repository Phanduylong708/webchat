import { useEffect, useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { MeshRTCManager } from "@/lib/videocall/webrtcManager";
import type {
  CallOfferPayload,
  CallAnswerPayload,
  CallCandidatePayload,
  UseRTCSignalingParams,
} from "@/types/rtc.type";

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
  const logSignaling = useCallback(
    (message: string, details: Record<string, unknown> = {}) => {
      console.debug("[useRTCSignaling]", message, {
        callId,
        currentUserId,
        isManagerReady,
        ...details,
      });
    },
    [callId, currentUserId, isManagerReady]
  );

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
    async (payload: CallOfferPayload, manager: MeshRTCManager, emitSocket: Socket, userId: number) => {
      const peerId = buildPeerId(payload.fromUserId);
      try {
        logSignaling("processOffer:start", {
          peerId,
          fromUserId: payload.fromUserId,
          toUserId: payload.toUserId,
          offerType: payload.offer.type,
        });
        const answer = await manager.handleRemoteOffer(peerId, payload.offer);
        const answerPayload: CallAnswerPayload = {
          callId: payload.callId,
          fromUserId: userId,
          toUserId: payload.fromUserId,
          answer: answer,
        };
        logSignaling("processOffer:emitAnswer", {
          peerId,
          fromUserId: userId,
          toUserId: payload.fromUserId,
          answerType: answer.type,
        });
        emitSocket.emit("call:answer", answerPayload);
      } catch (err) {
        console.error("[useRTCSignaling] Failed to process offer:", err);
      }
    },
    [buildPeerId, logSignaling]
  );

  // Process a single answer
  const processAnswer = useCallback(
    async (payload: CallAnswerPayload, manager: MeshRTCManager) => {
      const peerId = buildPeerId(payload.fromUserId);
      try {
        logSignaling("processAnswer:start", {
          peerId,
          fromUserId: payload.fromUserId,
          toUserId: payload.toUserId,
          answerType: payload.answer.type,
        });
        await manager.handleRemoteAnswer(peerId, payload.answer);
        logSignaling("processAnswer:done", {
          peerId,
          fromUserId: payload.fromUserId,
        });
      } catch (err) {
        console.error("[useRTCSignaling] Failed to process answer:", err);
      }
    },
    [buildPeerId, logSignaling]
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
      logSignaling("flushOfferQueue", { count: offers.length });
      for (const offer of offers) {
        void processOffer(offer, manager, currentSocket, userId);
      }
    }

    // Flush answer queue
    const answers = answerQueueRef.current.splice(0);
    if (answers.length > 0) {
      logSignaling("flushAnswerQueue", { count: answers.length });
      for (const answer of answers) {
        void processAnswer(answer, manager);
      }
    }

    // Flush candidate queue
    const candidates = candidateQueueRef.current.splice(0);
    if (candidates.length > 0) {
      logSignaling("flushCandidateQueue", { count: candidates.length });
      for (const candidate of candidates) {
        void processCandidate(candidate, manager);
      }
    }
  }, [isManagerReady, socket, currentUserId, processOffer, processAnswer, processCandidate, logSignaling]);

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

      logSignaling("handleOffer:received", {
        peerId: buildPeerId(payload.fromUserId),
        fromUserId: payload.fromUserId,
        toUserId: payload.toUserId,
        offerType: payload.offer.type,
      });

      const manager = getManagerRef.current();
      if (!manager) {
        // Queue offer for later processing
        offerQueueRef.current.push(payload);
        logSignaling("handleOffer:queued", {
          peerId: buildPeerId(payload.fromUserId),
          queueLength: offerQueueRef.current.length,
        });
        return;
      }

      await processOffer(payload, manager, currentSocket, userId);
    }

    currentSocket.on("call:offer", handleOffer);
    return () => {
      currentSocket.off("call:offer", handleOffer);
    };
  }, [socket, callId, currentUserId, processOffer, buildPeerId, logSignaling]);

  // Handle incoming answer: apply to peer connection
  useEffect(() => {
    if (!socket || !callId || currentUserId === null) return;

    const userId = currentUserId;

    async function handleAnswer(payload: CallAnswerPayload) {
      // Ignore answers not meant for us
      if (payload.toUserId !== userId) return;
      // Ignore answers for different calls
      if (payload.callId !== callId) return;

      logSignaling("handleAnswer:received", {
        peerId: buildPeerId(payload.fromUserId),
        fromUserId: payload.fromUserId,
        toUserId: payload.toUserId,
        answerType: payload.answer.type,
      });

      const manager = getManagerRef.current();
      if (!manager) {
        // Queue answer for later processing
        answerQueueRef.current.push(payload);
        logSignaling("handleAnswer:queued", {
          peerId: buildPeerId(payload.fromUserId),
          queueLength: answerQueueRef.current.length,
        });
        return;
      }

      await processAnswer(payload, manager);
    }

    socket.on("call:answer", handleAnswer);
    return () => {
      socket.off("call:answer", handleAnswer);
    };
  }, [socket, callId, currentUserId, processAnswer, buildPeerId, logSignaling]);

  // Handle incoming ICE candidate: add to peer connection
  useEffect(() => {
    if (!socket || !callId || currentUserId === null) return;

    const userId = currentUserId;

    async function handleCandidate(payload: CallCandidatePayload) {
      // Ignore candidates not meant for us
      if (payload.toUserId !== userId) return;
      // Ignore candidates for different calls
      if (payload.callId !== callId) return;

      logSignaling("handleCandidate:received", {
        peerId: buildPeerId(payload.fromUserId),
        fromUserId: payload.fromUserId,
        toUserId: payload.toUserId,
      });

      const manager = getManagerRef.current();
      if (!manager) {
        // Queue candidate for later processing
        candidateQueueRef.current.push(payload);
        logSignaling("handleCandidate:queued", {
          peerId: buildPeerId(payload.fromUserId),
          queueLength: candidateQueueRef.current.length,
        });
        return;
      }

      await processCandidate(payload, manager);
    }

    socket.on("call:candidate", handleCandidate);
    return () => {
      socket.off("call:candidate", handleCandidate);
    };
  }, [socket, callId, currentUserId, processCandidate, buildPeerId, logSignaling]);

  // NOTE: onIceCandidate callback is now registered at manager construction time
  // in RTCProvider/useMeshManager to ensure it's set before ICE gathering starts.
  // This hook only handles incoming signaling events (offer, answer, candidate).

  // Clear queues when callId changes (new call or leave call)
  useEffect(() => {
    return () => {
      offerQueueRef.current = [];
      answerQueueRef.current = [];
      candidateQueueRef.current = [];
    };
  }, [callId]);
}
