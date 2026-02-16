import { memo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedAvatarUrl } from "@/utils/image.util";
import { MicOff, Monitor } from "lucide-react";

import MediaVideo from "@/components/call/MediaVideo";

export interface StageLayoutTile {
  participantId: number;
  displayName: string;
  avatarUrl?: string | null;
  cameraStream: MediaStream | null;
  isPresenting?: boolean;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
}

export interface StageLayoutProps {
  presenterStream: MediaStream | null;
  presenterId: number | null;
  isPresenterLocal: boolean;
  tiles: StageLayoutTile[];
  stageContent?: React.ReactNode;
}

function StageLayoutComponent({
  presenterStream,
  presenterId,
  isPresenterLocal,
  tiles,
  stageContent,
}: StageLayoutProps): React.JSX.Element {
  const presenterTile = tiles.find((t) => t.participantId === presenterId);
  const presenterName = presenterTile?.displayName ?? "Presenter";

  return (
    <div className="h-full w-full flex flex-col lg:flex-row bg-zinc-950">
      {/* Stage - main presenter view */}
      <main className="relative flex-1 min-h-0 min-w-0 bg-black flex items-center justify-center">
        {stageContent ? (
          <div className="h-full w-full min-h-0 min-w-0">{stageContent}</div>
        ) : presenterStream ? (
          <MediaVideo
            stream={presenterStream}
            muted={isPresenterLocal}
            playsInline
            className="h-full w-full object-contain bg-black"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-zinc-400">
            <Monitor className="h-16 w-16" />
            <span className="text-sm">Waiting for screen share...</span>
          </div>
        )}

        {/* Presenter name overlay */}
        {presenterStream && (
          <div className="absolute bottom-4 left-4 pointer-events-none">
            <div className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2">
              <Monitor className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-sm font-medium text-white truncate max-w-[200px]">{presenterName}</span>
            </div>
          </div>
        )}
      </main>

      {/* Strip - participant tiles */}
      <aside className="h-[140px] sm:h-40 lg:h-auto lg:w-[280px] xl:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/5 bg-zinc-950/80">
        <div className="h-full p-2 lg:p-3">
          <div className="h-full flex gap-2 lg:gap-3 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto lg:flex-col custom-scrollbar">
            {tiles.map((tile) => (
              <StripTile key={tile.participantId} tile={tile} />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

interface StripTileProps {
  tile: StageLayoutTile;
}

function StripTile({ tile }: StripTileProps): React.JSX.Element {
  const showVideo = tile.cameraStream !== null && !tile.isVideoOff;

  return (
    <div className="relative w-[120px] sm:w-[140px] lg:w-full aspect-video shrink-0 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden">
      {/* Video or avatar */}
      {showVideo && tile.cameraStream ? (
        <MediaVideo
          stream={tile.cameraStream}
          muted={tile.isLocal}
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-850">
          <Avatar className="h-10 w-10 lg:h-12 lg:w-12 border-2 border-zinc-800">
            <AvatarImage src={getOptimizedAvatarUrl(tile.avatarUrl, 48)} />
            <AvatarFallback className="bg-zinc-700 text-zinc-400 text-sm">
              {tile.displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Presenting badge */}
      {tile.isPresenting && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-blue-600/90 text-white text-[10px] font-medium flex items-center gap-1">
          <Monitor className="h-2.5 w-2.5" />
          Presenting
        </div>
      )}

      {/* Name and mute indicator */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5">
        <div className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm border border-white/5 flex items-center gap-1.5 max-w-full">
          <span className="text-[10px] font-medium text-white truncate">
            {tile.isLocal ? "You" : tile.displayName}
          </span>
          {tile.isMuted && <MicOff className="h-2.5 w-2.5 text-zinc-400 shrink-0" />}
        </div>
      </div>
    </div>
  );
}

export const StageLayout = memo(StageLayoutComponent);
