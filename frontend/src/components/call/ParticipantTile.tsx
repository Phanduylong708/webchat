import { memo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { CallParticipant } from "@/types/call.type";
import { cn } from "@/lib/utils";
import MediaVideo from "@/components/call/MediaVideo";

interface ParticipantTileProps {
  participant: CallParticipant;
  isMe: boolean;
  compact?: boolean;
  // Props for self video (only used when isMe === true)
  showSelfVideo?: boolean;
  selfStream?: MediaStream | null;
  // Props for remote video (only used when isMe === false)
  remoteStream?: MediaStream | null;
  connectionState?: RTCPeerConnectionState | null;
  errorState?: string | null;
}

function ParticipantTileComponent({
  participant,
  isMe,
  compact = false,
  showSelfVideo = false,
  selfStream = null,
  remoteStream = null,
  errorState = null,
}: ParticipantTileProps): React.JSX.Element {
  // Determine what to show:
  // - Self: show video if showSelfVideo is true
  // - Remote: show video if remoteStream exists
  const shouldShowSelfVideo = isMe && showSelfVideo;
  const shouldShowRemoteVideo = !isMe && remoteStream !== null;
  const shouldShowVideo = shouldShowSelfVideo || shouldShowRemoteVideo;

  // Determine the stream to display
  const displayStream = isMe ? selfStream : remoteStream;

  // Show error indicator for remote participants with connection issues
  const hasError = !isMe && errorState !== null;

  return (
    <div
      className={cn(
        "relative w-full h-full bg-zinc-900 rounded-xl border overflow-hidden shadow-md group transition-all duration-300",
        compact ? "min-h-[120px]" : "min-h-40",
        hasError ? "border-red-500/50" : "border-white/5"
      )}
    >
      {shouldShowVideo && displayStream ? (
        <MediaVideo
          stream={displayStream}
          muted={isMe}
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-850">
          <Avatar className={cn("border-4 border-zinc-800 shadow-sm", compact ? "h-12 w-12" : "h-20 w-20")}>
            <AvatarImage src={participant.avatar ?? undefined} />
            <AvatarFallback className="bg-zinc-700 text-zinc-400">
              {participant.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {hasError && (
            <span className="mt-2 text-xs text-red-400">{errorState}</span>
          )}
        </div>
      )}

      <div
        className={cn(
          "absolute flex items-center justify-between",
          compact ? "bottom-2 left-2 right-2" : "bottom-3 left-3 right-3"
        )}
      >
        <div className="px-2 py-1 rounded bg-black/60 backdrop-blur-md border border-white/5 flex items-center gap-2 max-w-[85%]">
          <span className="text-xs font-medium text-white truncate">
            {isMe ? "You" : participant.username}
          </span>
        </div>
      </div>
    </div>
  );
}

export const ParticipantTile = memo(ParticipantTileComponent);
