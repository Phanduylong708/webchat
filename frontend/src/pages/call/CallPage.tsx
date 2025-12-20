import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCall } from "@/hooks/context/useCall";
import { useAuth } from "@/hooks/context/useAuth";
import useSocket from "@/hooks/context/useSocket";
import { Button } from "@/components/ui/button";
import { callEndReasonMessages } from "@/types/call.type";
import { CallControls } from "@/components/call/CallControls";
import { Loader2, AlertCircle, Home } from "lucide-react";
import { getConversationsDetails } from "@/api/conversation.api";
import { PrivateCallLayout } from "./Private";
import { GroupCallLayout } from "./Group";
import type { User } from "@/types/chat.type";
import { MediaProvider } from "@/contexts/mediaProvider";
import { useMedia } from "@/hooks/context/useMedia";
import MediaVideo from "@/components/call/MediaVideo";

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
  const { userStream } = useMedia();

  return (
    <div className="fixed top-4 right-4 z-40 w-32 h-44 sm:w-48 sm:h-64 bg-zinc-900 rounded-xl border border-white/10 shadow-2xl overflow-hidden">
      <MediaVideo stream={userStream ?? null} muted playsInline className="w-full h-full object-cover" />
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

  // 4. ACTIVE CALL (The "Sandwich" Layout)

  return (
    <MediaProvider>
      <AutoStartMedia enabled={!isLoading && !error} />
      {/* Force bg-zinc-950 to ensure it's always dark/black regardless of theme */}
      <div className="relative h-screen w-full bg-zinc-950 overflow-hidden text-white">
        {/* LAYER 1: Main Content */}
        <div className="absolute inset-0 z-0">
          {conversationType === "PRIVATE" ? (
            <PrivateCallLayout
              remoteUser={remoteUser}
              participants={participants}
              currentUserId={user?.id ?? null}
              status={status}
            />
          ) : (
            <GroupCallLayout
              participants={participants}
              currentUserId={user?.id ?? null}
              status={status}
              participantsOpen={showParticipants}
              onCloseParticipants={() => setShowParticipants(false)}
            />
          )}
        </div>

        {/* LAYER 2: PiP (Local Video) - Top Right */}
        {conversationType === "PRIVATE" && <LocalPiP />}

        {/* LAYER 3: Controls - Bottom Center */}
        <CallControls onToggleParticipants={() => setShowParticipants((v) => !v)} />
      </div>
    </MediaProvider>
  );
}
