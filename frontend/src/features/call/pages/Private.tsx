import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedAvatarUrl } from "@/utils/image.util";
import { MicOff } from "lucide-react";
import type { User as UserType } from "@/types/chat.type";
import type { CallStatus, CallParticipant } from "@/features/call/types/call.type";
import { useRTC } from "@/features/call/providers/rtc/useRTC";
import MediaVideo from "@/features/call/components/media/MediaVideo";

interface PrivateCallLayoutProps {
  remoteUser: UserType | null;
  participants: CallParticipant[];
  currentUserId: number | null;
  status: CallStatus;
}

export function PrivateCallLayout({
  remoteUser,
  participants,
  currentUserId,
  status,
}: PrivateCallLayoutProps): React.JSX.Element {
  const { getRemoteStream, getErrorState } = useRTC();

  // Determine the remote participant from the live participants list
  // Guard against currentUserId being null
  const remoteParticipant = currentUserId !== null ? participants.find((p) => p.id !== currentUserId) : null;

  // Get remote stream if we have a remote participant
  const remoteStream = remoteParticipant ? getRemoteStream(remoteParticipant.id) : null;
  const remoteError = remoteParticipant ? getErrorState(remoteParticipant.id) : null;

  // Use live participant data if available, otherwise fallback to fetched metadata
  const displayUser = remoteParticipant ?? remoteUser;
  const displayName = displayUser?.username ?? "Unknown User";

  // Use signaled state for camera/mic (not track inspection)
  const isRemoteCamOn = remoteParticipant?.videoMuted === false;
  const isRemoteMicMuted = remoteParticipant?.audioMuted === true;

  // Show waiting/ringing UI if the call is not yet active or if only one person is present
  const showWaitingUI = status === "ringing" || participants.length <= 1;

  return (
    <div className="flex h-full w-full items-center justify-center p-4 relative">
      <div className="relative w-full max-w-6xl aspect-video max-h-[calc(100vh-8rem)] bg-zinc-900 rounded-3xl border border-white/5 shadow-2xl overflow-hidden flex items-center justify-center">
        {/* Always mount MediaVideo for remote stream to keep audio playing */}
        {remoteStream && (
          <MediaVideo
            stream={remoteStream}
            playsInline
            className={isRemoteCamOn && !showWaitingUI ? "w-full h-full object-cover" : "invisible absolute"}
            muted={false}
          />
        )}

        {/* Avatar overlay when waiting or camera off */}
        {(showWaitingUI || !isRemoteCamOn) && (
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <Avatar className="h-32 w-32 sm:h-40 sm:w-40 border-8 border-zinc-800/50 shadow-inner">
                <AvatarImage src={getOptimizedAvatarUrl(displayUser?.avatar, 160)} />
                <AvatarFallback className="text-5xl bg-zinc-800 text-zinc-500">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {/* Mute indicators */}
              <div className="absolute bottom-0 right-0 flex gap-1">
                {isRemoteMicMuted && status === "active" && !showWaitingUI && (
                  <div className="p-2 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400">
                    <MicOff className="h-5 w-5" />
                  </div>
                )}
              </div>
              {remoteError && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-red-900/80 text-xs text-red-200">
                  {remoteError}
                </div>
              )}
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{displayName}</h2>
              <p className="text-zinc-500 font-medium">
                {status === "ringing" ? "Ringing..." : !showWaitingUI ? "Camera is off" : "Connecting..."}
              </p>
            </div>
          </div>
        )}

        {/* Name overlay when video is showing */}
        {isRemoteCamOn && !showWaitingUI && (
          <div className="absolute bottom-6 left-6 z-20 flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-sm font-medium text-white/90">
              {displayName}
            </div>
            {isRemoteMicMuted && (
              <div className="p-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-zinc-400">
                <MicOff className="h-4 w-4" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
