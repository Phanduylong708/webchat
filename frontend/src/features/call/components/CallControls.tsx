import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useMediaStore,
  selectIsAudioMuted,
  selectIsVideoMuted,
  selectIsStartingUserMedia,
  selectIsStartingScreenShare,
  selectScreenStream,
  selectToggleAudio,
  selectToggleVideo,
  selectStartScreenShare,
  selectStopScreenShare,
} from "@/features/call/stores/mediaStore";
import {
  selectCallSessionConversationType,
  selectCallSessionParticipants,
  selectCallSessionStatus,
  selectLeaveCurrentCall,
  useCallSessionStore,
} from "@/features/call/stores/callSessionStore";
import { useWhiteboard } from "@/features/whiteboard/providers/useWhiteboard";
import { Mic, MicOff, Video, VideoOff, Users, Monitor, PhoneOff, Presentation } from "lucide-react";

interface CallControlsProps {
  onToggleParticipants?: () => void;
}

export function CallControls({ onToggleParticipants }: CallControlsProps = {}): React.JSX.Element {
  const conversationType = useCallSessionStore(selectCallSessionConversationType);
  const status = useCallSessionStore(selectCallSessionStatus);
  const participants = useCallSessionStore(selectCallSessionParticipants);
  const leaveCurrentCall = useCallSessionStore(selectLeaveCurrentCall);
  const isAudioMuted = useMediaStore(selectIsAudioMuted);
  const isVideoMuted = useMediaStore(selectIsVideoMuted);
  const isStartingUserMedia = useMediaStore(selectIsStartingUserMedia);
  const isStartingScreenShare = useMediaStore(selectIsStartingScreenShare);
  const screenStream = useMediaStore(selectScreenStream);
  const toggleAudio = useMediaStore(selectToggleAudio);
  const toggleVideo = useMediaStore(selectToggleVideo);
  const startScreenShare = useMediaStore(selectStartScreenShare);
  const stopScreenShare = useMediaStore(selectStopScreenShare);
  const { isActive: isWhiteboardActive, openWhiteboard, closeWhiteboard } = useWhiteboard();

  if (status === "ended") return <></>;

  const micOn = !isAudioMuted;
  const camOn = !isVideoMuted;
  const isSharing = !!screenStream;
  const isAnyScreenShare = isSharing || participants.some((p) => p.videoSource === "screen");

  const handleScreenShare = () => {
    if (isSharing) {
      stopScreenShare();
    } else {
      void startScreenShare();
    }
  };

  const getMediaButtonClass = (isOn: boolean) =>
    cn(
      "rounded-full transition-all duration-200",
      isOn
        ? "text-white hover:bg-white/20 bg-transparent" // Normal state
        : "bg-white text-black hover:bg-zinc-200", // Off state
    );

  return (
    <>
      {/* Floating control bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-3 bg-zinc-950/90 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 shadow-2xl">
          {/* 1. Media Group */}
          <Button
            size="icon"
            variant="ghost"
            disabled={isStartingUserMedia}
            onClick={() => void toggleAudio()}
            className={cn(getMediaButtonClass(micOn), isStartingUserMedia && "opacity-50 cursor-not-allowed")}
          >
            {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            disabled={isStartingUserMedia}
            onClick={() => void toggleVideo()}
            className={cn(getMediaButtonClass(camOn), isStartingUserMedia && "opacity-50 cursor-not-allowed")}
          >
            {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
          </Button>

          {/* 2. Group Utilities */}
          {conversationType === "GROUP" && (
            <>
              {/* Divider to separate */}
              <div className="h-6 w-px bg-white/20 mx-1" />

              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/20 rounded-full"
                onClick={() => onToggleParticipants?.()}
              >
                <Users className="size-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={isStartingScreenShare}
                onClick={handleScreenShare}
                className={cn(
                  "rounded-full hidden sm:inline-flex transition-all duration-200",
                  isSharing ? "bg-blue-600 text-white hover:bg-blue-700" : "text-white hover:bg-white/20",
                  isStartingScreenShare && "opacity-50 cursor-not-allowed",
                )}
              >
                <Monitor className="size-5" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                disabled={isAnyScreenShare}
                onClick={() => (isWhiteboardActive ? closeWhiteboard() : openWhiteboard())}
                aria-label="Whiteboard"
                title="Whiteboard"
                className={cn(
                  "rounded-full hidden sm:inline-flex transition-all duration-200",
                  isWhiteboardActive
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "text-white hover:bg-white/20",
                  isAnyScreenShare && "opacity-50 cursor-not-allowed",
                )}
              >
                <Presentation className="size-5" />
              </Button>
            </>
          )}

          {/* Spacer if in P2P mode to separate Hangup button */}
          {conversationType === "PRIVATE" && <div className="w-2" />}

          {/* 3. Hangup - Most prominent */}
          <Button
            size="icon"
            onClick={leaveCurrentCall}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg shadow-red-500/20 ml-2"
          >
            <PhoneOff className="size-5 fill-current" />
          </Button>
        </div>
      </div>
    </>
  );
}
