import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCall } from "@/hooks/context/useCall";
import { useAuth } from "@/hooks/context/useAuth";
import useSocket from "@/hooks/context/useSocket";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { callEndReasonMessages } from "@/types/call.type";
import { CallControls } from "@/components/call/CallControls";
import { Loader2, AlertCircle, Home } from "lucide-react";
import { getConversationsDetails } from "@/api/conversation.api";
import { PrivateCallLayout } from "./Private";
import { GroupCallLayout } from "./Group";
import type { User } from "@/types/chat.type";
import type { ConversationType, CallParticipant, CallStatus } from "@/types/call.type";
import { MediaProvider } from "@/contexts/mediaProvider";
import { RTCProvider } from "@/contexts/rtcProvider";
import { useMedia } from "@/hooks/context/useMedia";
import { useRTC } from "@/hooks/context/useRTC";
import { useRTCSignaling } from "@/hooks/sockets/useRTCSignaling";
import { useRTCPeerLifecycle } from "@/hooks/rtc/useRTCPeerLifecycle";
import { useScreenShareRTC } from "@/hooks/rtc/useScreenShareRTC";
import { useEmitMediaState } from "@/hooks/sockets/useEmitMediaState";
import MediaVideo from "@/components/call/MediaVideo";
import { StageLayout } from "@/components/call/StageLayout";
import type { StageLayoutTile } from "@/components/call/StageLayout";

function AutoStartMedia({ enabled }: { enabled: boolean }): React.JSX.Element | null {
  const { startUserMedia, initError, userStream, isStartingUserMedia, isManagerReady } = useMedia();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !!initError) return;
    if (!isManagerReady) return;
    if (startedRef.current) return;
    if (userStream) return;
    if (isStartingUserMedia) return;

    startedRef.current = true;
    void startUserMedia(); // defaults to { audio: true, video: true }
  }, [enabled, initError, isManagerReady, userStream, isStartingUserMedia, startUserMedia]);

  return null;
}

function LocalPiP(): React.JSX.Element {
  const { userStream, isVideoMuted } = useMedia();
  const { user } = useAuth();

  const showVideo = userStream && !isVideoMuted;

  return (
    <div className="fixed top-4 right-4 z-40 w-32 h-44 sm:w-48 sm:h-64 bg-zinc-900 rounded-xl border border-white/10 shadow-2xl overflow-hidden">
      {showVideo ? (
        <MediaVideo stream={userStream} muted playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-850">
          <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-4 border-zinc-800">
            <AvatarImage src={user?.avatar ?? undefined} />
            <AvatarFallback className="bg-zinc-700 text-zinc-400 text-xl">
              {user?.username?.charAt(0).toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
}

export default function CallPage(): React.JSX.Element {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { joinCall, status, endReason, conversationType, participants } = useCall();
  const { isConnected } = useSocket();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [remoteUser, setRemoteUser] = useState<User | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);

  useEffect(() => {
    if (!callId) {
      setError("Call ID is missing");
      setIsLoading(false);
      return;
    }

    if (!isConnected) return;

    async function handleJoin() {
      if (!callId) return;
      const ack = await joinCall(callId);
      if (!ack.success) {
        setError(ack.error || "Failed to join call");
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      console.log("Joined call successfully");
      // Fetch remote user metadata for private calls (best-effort)
      if (ack.conversationType === "PRIVATE") {
        try {
          const detail = await getConversationsDetails(ack.conversationId);
          const others = detail.members.filter((m) => m.id !== user?.id);
          setRemoteUser(others[0] ?? null);
        } catch (err) {
          console.error("Failed to fetch conversation details", err);
          setRemoteUser(null);
        }
      }
    }

    handleJoin();
  }, [callId, joinCall, navigate, isConnected, user?.id]);

  // 1. Loading State (Dark theme enforced)
  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950 text-white gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
        <p className="text-zinc-400 font-medium animate-pulse">Joining...</p>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="text-lg font-semibold">{error}</p>
          <p className="text-sm text-zinc-500">Redirecting...</p>
        </div>
      </div>
    );
  }

  // 3. Ended State
  if (status === "ended") {
    const message =
      endReason && endReason in callEndReasonMessages ? callEndReasonMessages[endReason] : "Call ended";

    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-2xl font-bold">Call Ended</h1>
          <p className="text-zinc-400">{message}</p>
          <Button onClick={() => window.close()} variant="secondary">
            <Home className="mr-2 h-4 w-4" /> Return Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <MediaProvider>
      <RTCProvider callId={callId ?? null} currentUserId={user?.id ?? null}>
        <ActiveCallContent
          callId={callId ?? null}
          conversationType={conversationType}
          participants={participants}
          currentUserId={user?.id ?? null}
          status={status}
          remoteUser={remoteUser}
          showParticipants={showParticipants}
          setShowParticipants={setShowParticipants}
        />
      </RTCProvider>
    </MediaProvider>
  );
}

interface ActiveCallContentProps {
  callId: string | null;
  conversationType: ConversationType | null;
  participants: CallParticipant[];
  currentUserId: number | null;
  status: CallStatus;
  remoteUser: User | null;
  showParticipants: boolean;
  setShowParticipants: React.Dispatch<React.SetStateAction<boolean>>;
}

function ActiveCallContent({
  callId,
  conversationType,
  participants,
  currentUserId,
  status,
  remoteUser,
  showParticipants,
  setShowParticipants,
}: ActiveCallContentProps): React.JSX.Element {
  const { userStream, screenStream, isVideoMuted, isAudioMuted, videoSource, stopScreenShare } = useMedia();
  const { socket } = useSocket();
  const { getManager, isManagerReady, isLocalStreamSynced, getRemoteStream } = useRTC();

  // Emit local media state to server (after join, and on changes)
  useEmitMediaState({
    socket,
    isAudioMuted,
    isVideoMuted,
    videoSource,
  });

  // Initialize WebRTC signaling (offer/answer/ICE candidates)
  useRTCSignaling({
    socket,
    callId,
    currentUserId,
    getManager,
    isManagerReady,
  });

  // Manage peer connection lifecycle (create/remove peers based on participants)
  useRTCPeerLifecycle({
    socket,
    callId,
    currentUserId,
    participants,
    getManager,
    isManagerReady,
    isLocalStreamSynced,
  });

  // Manage screen share track swapping (screen video + mixed audio)
  useScreenShareRTC({
    getManager,
    isManagerReady,
    userStream,
    screenStream,
    stopScreenShare,
  });

  // Compute self video state for Group layout (only for "You" tile)
  const showSelfVideo = useMemo(() => !!userStream && !isVideoMuted, [userStream, isVideoMuted]);

  // Find presenter (first participant with videoSource === 'screen')
  const presenterId = useMemo(() => {
    return participants.find((p) => p.videoSource === "screen")?.id ?? null;
  }, [participants]);

  const isPresenterLocal = presenterId === currentUserId;

  // Compute presenter stream: local screenStream if I'm presenting, remote stream otherwise
  const presenterStream = useMemo(() => {
    if (presenterId === null) return null;
    if (isPresenterLocal) return screenStream;
    return getRemoteStream(presenterId);
  }, [presenterId, isPresenterLocal, screenStream, getRemoteStream]);

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
  }, [participants, currentUserId, presenterId, userStream, getRemoteStream, isAudioMuted, isVideoMuted]);

  const stageTiles = useMemo(() => buildStageTiles(), [buildStageTiles]);

  // Determine if we're in stage mode
  const isStageMode = presenterId !== null;

  return (
    <>
      <AutoStartMedia enabled={true} />
      {/* Force bg-zinc-950 to ensure it's always dark/black regardless of theme */}
      <div className="relative h-screen w-full bg-zinc-950 overflow-hidden text-white">
        {/* LAYER 1: Main Content */}
        <div className="absolute inset-0 z-0">
          {isStageMode ? (
            <StageLayout
              presenterStream={presenterStream}
              presenterId={presenterId}
              isPresenterLocal={isPresenterLocal}
              tiles={stageTiles}
            />
          ) : conversationType === "PRIVATE" ? (
            <PrivateCallLayout
              remoteUser={remoteUser}
              participants={participants}
              currentUserId={currentUserId}
              status={status}
            />
          ) : (
            <GroupCallLayout
              participants={participants}
              currentUserId={currentUserId}
              status={status}
              participantsOpen={showParticipants}
              onCloseParticipants={() => setShowParticipants(false)}
              showSelfVideo={showSelfVideo}
              selfStream={userStream}
              selfAudioMuted={isAudioMuted}
              selfVideoMuted={isVideoMuted}
            />
          )}
        </div>

        {/* LAYER 2: PiP (Local Video) - Top Right, hidden in stage mode */}
        {conversationType === "PRIVATE" && !isStageMode && <LocalPiP />}

        {/* LAYER 3: Controls - Bottom Center */}
        <CallControls onToggleParticipants={() => setShowParticipants((v) => !v)} />
      </div>
    </>
  );
}
