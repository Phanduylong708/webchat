import { useMemo, useCallback } from "react";
import type { CallParticipant } from "@/features/call/types/call.type";
import type { StageLayoutTile } from "@/features/call/components/StageLayout";
import type { VideoSource } from "@/features/call/types/media.type";

interface UseStagePresenterParams {
  participants: CallParticipant[];
  currentUserId: number | null;
  videoSource: VideoSource;
  screenStream: MediaStream | null;
  userStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  getRemoteStream: (userId: number) => MediaStream | null;
  remoteStreamsVersion: number;
}

interface UseStagePresenterResult {
  presenterId: number | null;
  isPresenterLocal: boolean;
  presenterStream: MediaStream | null;
  stageTiles: StageLayoutTile[];
  isStageMode: boolean;
}

// Encapsulates presenter detection and stage layout tile building
export function useStagePresenter({
  participants,
  currentUserId,
  videoSource,
  screenStream,
  userStream,
  isAudioMuted,
  isVideoMuted,
  getRemoteStream,
  remoteStreamsVersion,
}: UseStagePresenterParams): UseStagePresenterResult {
  // Find presenter (first participant with videoSource === 'screen')
  // Prioritize local videoSource since socket.to() excludes sender
  const presenterId = useMemo(() => {
    if (videoSource === "screen") return currentUserId;
    return participants.find((p) => p.videoSource === "screen")?.id ?? null;
  }, [participants, videoSource, currentUserId]);

  const isPresenterLocal = presenterId === currentUserId;

  // Compute presenter stream: local screenStream if I'm presenting, remote stream otherwise
  const presenterStream = useMemo(() => {
    if (presenterId === null) return null;
    if (isPresenterLocal) return screenStream;
    return getRemoteStream(presenterId);
  }, [presenterId, isPresenterLocal, screenStream, getRemoteStream, remoteStreamsVersion]);

  // Build tiles for StageLayout
  const buildStageTiles = useCallback((): StageLayoutTile[] => {
    return participants.map((p): StageLayoutTile => {
      const isMe = p.id === currentUserId;
      const isPresenting = p.id === presenterId;

      // For self: use userStream (camera)
      // For remote presenter: null (can't get camera, only screen via replaceTrack)
      // For other remotes: use getRemoteStream (their camera)
      let cameraStream: MediaStream | null = null;
      if (isMe) {
        cameraStream = userStream;
      } else if (!isPresenting) {
        cameraStream = getRemoteStream(p.id);
      }
      // Remote presenter: cameraStream stays null (avatar only)

      return {
        participantId: p.id,
        displayName: p.username,
        avatarUrl: p.avatar,
        cameraStream,
        isPresenting,
        isLocal: isMe,
        isMuted: isMe ? isAudioMuted : p.audioMuted,
        isVideoOff: isMe ? isVideoMuted : p.videoMuted,
      };
    });
  }, [participants, currentUserId, presenterId, userStream, getRemoteStream, isAudioMuted, isVideoMuted, remoteStreamsVersion]);

  const stageTiles = useMemo(() => buildStageTiles(), [buildStageTiles]);

  const isStageMode = presenterId !== null;

  return {
    presenterId,
    isPresenterLocal,
    presenterStream,
    stageTiles,
    isStageMode,
  };
}
