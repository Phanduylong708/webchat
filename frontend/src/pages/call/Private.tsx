import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VideoOff, User } from "lucide-react";
import type { User as UserType } from "@/types/chat.type";
import type { CallStatus, CallParticipant } from "@/types/call.type";

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
  // Placeholder for remote camera state - will be replaced with real state from media layer
  const isRemoteCamOn = true; // Mocking this for now

  // Determine the remote participant from the live participants list
  const remoteParticipant = participants.find((p) => p.id !== currentUserId);

  // Use live participant data if available, otherwise fallback to fetched metadata
  const displayUser = remoteParticipant ?? remoteUser;
  const displayName = displayUser?.username ?? "Unknown User";

  // Show waiting/ringing UI if the call is not yet active or if only one person is present
  const showWaitingUI = status === "ringing" || participants.length <= 1;

  return (
    <div className="flex h-full w-full items-center justify-center p-4 relative">
      <div className="relative w-full max-w-6xl aspect-video max-h-[calc(100vh-8rem)] bg-zinc-900 rounded-3xl border border-white/5 shadow-2xl overflow-hidden flex items-center justify-center">
        {/* CASE 1: Waiting for user or remote camera is off */}
        {showWaitingUI || !isRemoteCamOn ? (
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <Avatar className="h-32 w-32 sm:h-40 sm:w-40 border-8 border-zinc-800/50 shadow-inner">
                <AvatarImage src={displayUser?.avatar ?? undefined} />
                <AvatarFallback className="text-5xl bg-zinc-800 text-zinc-500">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!isRemoteCamOn && status === "active" && (
                <div className="absolute bottom-0 right-0 p-2 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400">
                  <VideoOff className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {displayName}
              </h2>
              <p className="text-zinc-500 font-medium">
                {status === "ringing" ? "Ringing..." : "Camera is off"}
              </p>
            </div>
          </div>
        ) : (
          // CASE 2: Active call with remote camera on
          <div className="w-full h-full flex items-center justify-center bg-black">
            <div className="bg-zinc-800 flex items-center justify-center relative w-full h-full">
              <User className="h-20 w-20 text-zinc-600 opacity-50" />
              <span className="absolute text-xs text-zinc-500 font-mono mt-12">
                REMOTE VIDEO STREAM
              </span>
            </div>
            <div className="absolute bottom-6 left-6 z-20 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-sm font-medium text-white/90">
              {displayName}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
