import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCall } from "@/hooks/context/useCall";
import { useAuth } from "@/features/auth/providers/useAuth";
import useSocket from "@/hooks/context/useSocket";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedAvatarUrl } from "@/utils/image.util";
import { callEndReasonMessages } from "@/types/call.type";
import { CallControls } from "@/components/call/CallControls";
import { Loader2, AlertCircle, Home } from "lucide-react";
import { getConversationsDetails } from "@/api/conversation.api";
import { PrivateCallLayout } from "./Private";
import { GroupCallLayout } from "./Group";
import type { User } from "@/types/chat.type";
import type { ConversationType, CallParticipant, CallStatus } from "@/types/call.type";
import type { WbAck } from "@/types/whiteboard.type";
import { RTCProvider } from "@/contexts/rtcProvider";
import { WhiteboardProvider } from "@/contexts/whiteboardProvider";
import {
  useMediaStore,
  selectUserStream,
  selectScreenStream,
  selectIsVideoMuted,
  selectIsAudioMuted,
  selectVideoSource,
  selectIsManagerReady,
  selectInitError,
  selectIsStartingUserMedia,
} from "@/stores/mediaStore";
import { useRTC } from "@/hooks/context/useRTC";
import { useWhiteboard } from "@/hooks/context/useWhiteboard";
import { useRTCSignaling } from "@/hooks/sockets/useRTCSignaling";
import { useRTCPeerLifecycle } from "@/hooks/rtc/useRTCPeerLifecycle";
import { useScreenShareRTC } from "@/hooks/rtc/useScreenShareRTC";
import { useEmitMediaState } from "@/hooks/sockets/useEmitMediaState";
import { useStagePresenter } from "@/hooks/call/useStagePresenter";
import MediaVideo from "@/components/call/MediaVideo";
import { StageLayout } from "@/components/call/StageLayout";
import { Whiteboard } from "@/components/whiteboard/Whiteboard";

function AutoStartMedia({ enabled }: { enabled: boolean }): React.JSX.Element | null {
  const startUserMedia = useMediaStore((s) => s.startUserMedia);
  const initError = useMediaStore(selectInitError);
  const isManagerReady = useMediaStore(selectIsManagerReady);
  const userStream = useMediaStore(selectUserStream);
  const isStartingUserMedia = useMediaStore(selectIsStartingUserMedia);
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
  const userStream = useMediaStore(selectUserStream);
  const isVideoMuted = useMediaStore(selectIsVideoMuted);
  const { user } = useAuth();

  const showVideo = userStream && !isVideoMuted;

  return (
    <div className="fixed top-4 right-4 z-40 w-32 h-44 sm:w-48 sm:h-64 bg-zinc-900 rounded-xl border border-white/10 shadow-2xl overflow-hidden">
      {showVideo ? (
        <MediaVideo stream={userStream} muted playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-850">
          <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-4 border-zinc-800">
            <AvatarImage src={getOptimizedAvatarUrl(user?.avatar, 80)} />
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
  const initManager = useMediaStore((s) => s.initManager);
  const disposeManager = useMediaStore((s) => s.disposeManager);

  // Tie MediaStreamManager lifecycle to CallPage mount/unmount.
  // Must be explicit since there is no longer a MediaProvider wrapper.
  useEffect(() => {
    initManager();
    return () => disposeManager();
  }, [initManager, disposeManager]);

  // Dispose immediately when call *transitions to* ended — not on initial mount.
  // CallProvider initialises status as "ended" (idle sentinel), so we must
  // track the previous value and only act on a real transition away from a
  // live state. Without this guard the effect fires on mount, disposes the
  // manager before joinCall() runs, and leaves camera/mic permanently broken.
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (status === "ended" && prev !== "ended") {
      disposeManager();
    }
  }, [status, disposeManager]);

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
  const userStream = useMediaStore(selectUserStream);
  const screenStream = useMediaStore(selectScreenStream);
  const isVideoMuted = useMediaStore(selectIsVideoMuted);
  const isAudioMuted = useMediaStore(selectIsAudioMuted);
  const videoSource = useMediaStore(selectVideoSource);
  const stopScreenShare = useMediaStore((s) => s.stopScreenShare);
  const { socket, isConnected } = useSocket();
  const { getManager, isManagerReady, isLocalStreamSynced, getRemoteStream, remoteStreamsVersion } = useRTC();

  // Whiteboard stale ACK bridge (pattern from dev harness)
  const staleAckHandlerRef = useRef<(ack?: WbAck) => void>(() => {});
  const registerStaleAckHandler = useCallback((handler: (ack?: WbAck) => void) => {
    staleAckHandlerRef.current = handler;
  }, []);
  const canSync = Boolean(isConnected && callId);

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

  // Stage presenter logic (presenter detection + tile building)
  const { presenterId, isPresenterLocal, presenterStream, stageTiles, isStageMode } = useStagePresenter({
    participants,
    currentUserId,
    videoSource,
    screenStream,
    userStream,
    isAudioMuted,
    isVideoMuted,
    getRemoteStream,
    remoteStreamsVersion,
  });

  return (
    <WhiteboardProvider
      socket={socket}
      callId={callId}
      canSync={canSync}
      onStaleAck={(ack) => staleAckHandlerRef.current(ack)}
    >
      <AutoStartMedia enabled={true} />
      <CallStage
        callId={callId}
        socket={socket}
        canSync={canSync}
        registerStaleAckHandler={registerStaleAckHandler}
        conversationType={conversationType}
        isStageMode={isStageMode}
        presenterStream={presenterStream}
        presenterId={presenterId}
        isPresenterLocal={isPresenterLocal}
        stageTiles={stageTiles}
        remoteUser={remoteUser}
        participants={participants}
        currentUserId={currentUserId}
        status={status}
        showParticipants={showParticipants}
        setShowParticipants={setShowParticipants}
        showSelfVideo={showSelfVideo}
        userStream={userStream}
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
      />
    </WhiteboardProvider>
  );
}

interface CallStageProps {
  callId: string | null;
  socket: ReturnType<typeof useSocket>["socket"];
  canSync: boolean;
  registerStaleAckHandler: (handler: (ack?: WbAck) => void) => void;
  conversationType: ConversationType | null;
  isStageMode: boolean;
  presenterStream: MediaStream | null;
  presenterId: number | null;
  isPresenterLocal: boolean;
  stageTiles: import("@/components/call/StageLayout").StageLayoutTile[];
  remoteUser: User | null;
  participants: CallParticipant[];
  currentUserId: number | null;
  status: CallStatus;
  showParticipants: boolean;
  setShowParticipants: React.Dispatch<React.SetStateAction<boolean>>;
  showSelfVideo: boolean;
  userStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
}

function CallStage({
  callId,
  socket,
  canSync,
  registerStaleAckHandler,
  conversationType,
  isStageMode,
  presenterStream,
  presenterId,
  isPresenterLocal,
  stageTiles,
  remoteUser,
  participants,
  currentUserId,
  status,
  showParticipants,
  setShowParticipants,
  showSelfVideo,
  userStream,
  isAudioMuted,
  isVideoMuted,
}: CallStageProps): React.JSX.Element {
  const { isActive: isWhiteboardActive, closeWhiteboard } = useWhiteboard();

  // Auto-close whiteboard when screen share starts (screen share wins)
  useEffect(() => {
    if (isStageMode && isWhiteboardActive) {
      closeWhiteboard();
    }
  }, [isStageMode, isWhiteboardActive, closeWhiteboard]);

  return (
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
        ) : isWhiteboardActive ? (
          <StageLayout
            presenterStream={null}
            presenterId={null}
            isPresenterLocal={false}
            tiles={stageTiles}
            stageContent={
              <Whiteboard
                socket={socket}
                callId={callId}
                canSync={canSync}
                registerStaleAckHandler={registerStaleAckHandler}
              />
            }
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

      {/* LAYER 2: PiP (Local Video) - Top Right, hidden in stage mode or whiteboard */}
      {conversationType === "PRIVATE" && !isStageMode && !isWhiteboardActive && <LocalPiP />}

      {/* LAYER 3: Controls - Bottom Center */}
      <CallControls onToggleParticipants={() => setShowParticipants((v) => !v)} />
    </div>
  );
}
