import { useEffect, useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { MeshRTCManager } from "@/lib/videocall/webrtcManager";
import type { CallOfferPayload, UseRTCPeerLifecycleParams } from "@/types/rtc.type";

/**
 * Manages WebRTC peer connection lifecycle based on participants changes.
 * - On initial join: creates offers to all existing participants
 * - When new participant joins: ensurePeer (they will send offer)
 * - When participant leaves: removePeer and cleanup
 *
 * NOTE: Reacts to participants array changes, not socket events directly.
 * NOTE: Gates on isLocalStreamSynced to ensure tracks are attached before creating offers.
 */
export function useRTCPeerLifecycle({
  socket,
  callId,
  currentUserId,
  participants,
  getManager,
  isManagerReady,
  isLocalStreamSynced,
}: UseRTCPeerLifecycleParams): void {
  // Track if we've done initial offer creation (first time joining)
  const hasInitializedRef = useRef(false);
  // Track previous participants to detect adds/removes
  const prevParticipantIdsRef = useRef<Set<number>>(new Set());

  // Use ref for getManager to avoid dependency churn
  const getManagerRef = useRef(getManager);
  getManagerRef.current = getManager;

  // Build peerId from callId and userId
  const buildPeerId = useCallback(
    (userId: number): string => {
      return `${callId}_${userId}`;
    },
    [callId]
  );

  // Reset initialization flag when callId changes (new call)
  useEffect(() => {
    hasInitializedRef.current = false;
    prevParticipantIdsRef.current = new Set();
  }, [callId]);

  // Main effect: react to participants changes
  useEffect(() => {
    // Gating: all required conditions must be met
    if (!socket || !callId || currentUserId === null) return;
    // Wait for manager AND local stream to be synced (tracks attached)
    if (!isManagerReady || !isLocalStreamSynced) return;

    const manager = getManagerRef.current();
    if (!manager) return;

    // Build current participant IDs (excluding self)
    const currentIds = new Set(
      participants.map((p) => p.id).filter((id): id is number => id !== currentUserId && id !== undefined)
    );
    const prevIds = prevParticipantIdsRef.current;

    // Scenario A: First initialization - I'm the new joiner, offer to ALL existing
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      for (const userId of currentIds) {
        const peerId = buildPeerId(userId);

        // Guard: skip if peer already exists (idempotent)
        if (manager.hasPeer(peerId)) {
          continue;
        }

        // Create peer and send offer
        void createOfferForPeer(manager, socket, callId, currentUserId, userId, peerId);
      }
    } else {
      // Scenario B: New participant joined - ensurePeer only (they will offer us)
      const addedIds = [...currentIds].filter((id) => !prevIds.has(id));
      for (const userId of addedIds) {
        const peerId = buildPeerId(userId);

        // Guard: skip if peer already exists
        if (manager.hasPeer(peerId)) {
          continue;
        }

        // Just ensure peer exists (prepare for incoming offer)
        manager.ensurePeer(peerId);
      }

      // Scenario C: Participant left - remove peer and cleanup
      const removedIds = [...prevIds].filter((id) => !currentIds.has(id));
      for (const userId of removedIds) {
        const peerId = buildPeerId(userId);
        manager.removePeer(peerId);
      }
    }

    // Update previous participants ref
    prevParticipantIdsRef.current = currentIds;
  }, [socket, callId, currentUserId, participants, isManagerReady, isLocalStreamSynced, buildPeerId]);
}

/**
 * Helper: Create offer for a peer and emit via socket
 */
async function createOfferForPeer(
  manager: MeshRTCManager,
  socket: Socket,
  callId: string,
  fromUserId: number,
  toUserId: number,
  peerId: string
): Promise<void> {
  try {
    // ensurePeer creates the RTCPeerConnection if it doesn't exist
    manager.ensurePeer(peerId);

    // Create and set local description
    const offer = await manager.createOffer(peerId);

    // Emit offer to remote peer
    const payload: CallOfferPayload = {
      callId,
      fromUserId,
      toUserId,
      offer,
    };
    socket.emit("call:offer", payload);
  } catch (err) {
    console.error("[useRTCPeerLifecycle] Failed to create offer for peer:", peerId, err);
  }
}
