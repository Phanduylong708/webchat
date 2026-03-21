import { useMemo, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedAvatarUrl } from "@/utils/image.util";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { CallParticipant, CallStatus } from "@/features/call/types/call.type";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ParticipantTile } from "@/features/call/components/ParticipantTile";
import { useRTC } from "@/features/call/providers/rtc/useRTC";

interface GroupCallLayoutProps {
  participants: CallParticipant[];
  currentUserId: number | null;
  status: CallStatus;
  participantsOpen?: boolean;
  onCloseParticipants?: () => void;
  showSelfVideo: boolean;
  selfStream: MediaStream | null;
  selfAudioMuted: boolean;
  selfVideoMuted: boolean;
}

export function GroupCallLayout({
  participants,
  currentUserId,
  status,
  participantsOpen = false,
  onCloseParticipants,
  showSelfVideo,
  selfStream,
  selfAudioMuted,
  selfVideoMuted,
}: GroupCallLayoutProps): React.JSX.Element {
  // Get RTC context for remote streams
  const { getRemoteStream, getConnectionState, getErrorState } = useRTC();

  // Pagination state (MVP)
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 16; // Desktop default; can be made responsive later

  // Ordering: me first, others keep FIFO by original order
  const ordered = useMemo(() => {
    const orderIndex = new Map(participants.map((p, i) => [p.id, i]));
    return [...participants].sort((a, b) => {
      if (currentUserId != null) {
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
      }
      return (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0);
    });
  }, [participants, currentUserId]);

  // Waiting/Ringing indicator
  const showWaiting = status === "ringing" || ordered.length <= 1;

  return (
    <div className="h-full w-full relative bg-zinc-950 flex flex-col">
      {showWaiting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-sm text-zinc-300">
          {status === "ringing" ? "Ringing…" : "Waiting for others…"}
        </div>
      )}

      <PaginatedGridLayout
        participants={ordered}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        pageSize={PAGE_SIZE}
        currentUserId={currentUserId}
        showSelfVideo={showSelfVideo}
        selfStream={selfStream}
        selfAudioMuted={selfAudioMuted}
        selfVideoMuted={selfVideoMuted}
        getRemoteStream={getRemoteStream}
        getConnectionState={getConnectionState}
        getErrorState={getErrorState}
      />

      {/* Participants side panel */}
      {participantsOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={onCloseParticipants} />
          <div className="absolute right-0 top-0 h-full w-[320px] sm:w-[360px] bg-zinc-900 border-l border-white/10 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Participants</span>
                <span className="text-xs text-zinc-400">{ordered.length}</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-zinc-400 hover:text-white"
                onClick={onCloseParticipants}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {ordered.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={getOptimizedAvatarUrl(p.avatar, 32)} />
                    <AvatarFallback className="bg-zinc-700 text-zinc-300 text-xs">
                      {p.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">
                      {p.id === currentUserId ? "You" : p.username}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PaginatedGridLayoutProps {
  participants: CallParticipant[];
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  currentUserId: number | null;
  showSelfVideo: boolean;
  selfStream: MediaStream | null;
  selfAudioMuted: boolean;
  selfVideoMuted: boolean;
  getRemoteStream: (userId: number) => MediaStream | null;
  getConnectionState: (userId: number) => RTCPeerConnectionState | null;
  getErrorState: (userId: number) => string | null;
}

function PaginatedGridLayout({
  participants,
  currentPage,
  setCurrentPage,
  pageSize,
  currentUserId,
  showSelfVideo,
  selfStream,
  selfAudioMuted,
  selfVideoMuted,
  getRemoteStream,
  getConnectionState,
  getErrorState,
}: PaginatedGridLayoutProps) {
  const totalPages = Math.max(1, Math.ceil(participants.length / pageSize));

  // Reset page if participants shrink
  useEffect(() => {
    if (currentPage > totalPages - 1) {
      setCurrentPage(totalPages - 1);
    }
  }, [currentPage, totalPages, setCurrentPage]);

  const visibleParticipants = participants.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const count = visibleParticipants.length;
  const gridClass = cn(
    "grid w-full h-full gap-3 transition-all duration-300",
    // Fixed slots per breakpoint (MVP):
    // Mobile ~ 2x2, Tablet ~ 3x3, Desktop ~ 4x4
    count <= 1
      ? "grid-cols-1 max-w-4xl mx-auto"
      : count <= 2
        ? "grid-cols-1 sm:grid-cols-2 max-w-6xl mx-auto"
        : count <= 4
          ? "grid-cols-2"
          : count <= 9
            ? "grid-cols-2 sm:grid-cols-3"
            : "grid-cols-3 sm:grid-cols-4",
  );

  return (
    <div className="relative w-full h-full flex flex-col p-4 justify-center">
      {/* GRID CONTAINER */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className={cn("w-full h-auto", gridClass)}>
          {visibleParticipants.map((p: CallParticipant) => {
            const isMe = p.id === currentUserId;
            return (
              <ParticipantTile
                key={p.id}
                participant={p}
                isMe={isMe}
                showSelfVideo={showSelfVideo}
                selfStream={selfStream}
                selfAudioMuted={selfAudioMuted}
                selfVideoMuted={selfVideoMuted}
                remoteStream={!isMe && p.id ? getRemoteStream(p.id) : null}
                connectionState={!isMe && p.id ? getConnectionState(p.id) : null}
                errorState={!isMe && p.id ? getErrorState(p.id) : null}
              />
            );
          })}
        </div>
      </div>

      {/* PAGINATION CONTROLS */}
      {totalPages > 1 && (
        <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 flex justify-between pointer-events-none">
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "pointer-events-auto h-12 w-12 rounded-full shadow-2xl bg-white",
              currentPage === 0 && "opacity-0 pointer-events-none",
            )}
            onClick={() => setCurrentPage((p: number) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "pointer-events-auto h-12 w-12 rounded-full shadow-2xl bg-white",
              currentPage === totalPages - 1 && "opacity-0 pointer-events-none",
            )}
            onClick={() => setCurrentPage((p: number) => Math.min(totalPages - 1, p + 1))}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Page Indicator */}
      {totalPages > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 w-2 rounded-full transition-all",
                i === currentPage ? "bg-white w-4" : "bg-white/20",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
