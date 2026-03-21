import { useCallback, useEffect } from "react";
import type { Socket } from "socket.io-client";
import type { WbAck, PartialSerializedObject, ObjectPatch, SerializedObject } from "@/features/whiteboard/types/whiteboard.type";
import { useWhiteboard } from "@/features/whiteboard/providers/useWhiteboard";
import { useFabric } from "@/features/whiteboard/hooks/useFabric";
import { useCanvasSync } from "@/features/whiteboard/hooks/useCanvasSync";
import { useWhiteboardOrchestration } from "@/features/whiteboard/hooks/useWhiteboardOrchestration";
import { useCursorPresence } from "@/features/whiteboard/hooks/useCursorPresence";
import { WhiteboardCanvas } from "@/features/whiteboard/components/WhiteboardCanvas";
import { WhiteboardToolbar } from "@/features/whiteboard/components/WhiteboardToolbar";
import { WhiteboardControls } from "@/features/whiteboard/components/WhiteboardControls";
import { cn } from "@/lib/utils";

interface WhiteboardProps {
  socket: Socket | null;
  callId: string | null;
  canSync: boolean;
  registerStaleAckHandler?: (handler: (ack?: WbAck) => void) => void;
  className?: string;
}

function WhiteboardInner({ socket, callId, canSync, registerStaleAckHandler, className }: WhiteboardProps) {
  const {
    isActive,
    objects,
    activeTool,
    activeColor,
    setActiveTool,
    setActiveColor,
    applySnapshot,
    applyRemoteAdd,
    applyRemoteUpdate,
    applyRemoteDelete,
    setMyColor,
    emitAdd,
    emitUpdate,
    emitDelete,
    closeWhiteboard,
  } = useWhiteboard();

  const handleAdd = useCallback(
    (object: PartialSerializedObject) => {
      emitAdd(object as SerializedObject);
    },
    [emitAdd],
  );

  const handleUpdate = useCallback(
    (objectId: string, patch: ObjectPatch) => {
      emitUpdate(objectId, patch);
    },
    [emitUpdate],
  );

  const handleDelete = useCallback(
    (objectId: string) => {
      emitDelete(objectId);
    },
    [emitDelete],
  );

  const { canvas, canvasCallbackRef, isReady } = useFabric({
    activeTool,
    activeColor,
    onAdd: handleAdd,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
    setActiveTool,
  });

  useCanvasSync(canvas.current, objects, isReady);

  const { remoteCursors, handleRemoteCursor, emitCursor } = useCursorPresence({
    socket,
    callId,
    isActive,
    canSync,
    ttlMs: 3000,
    removeGraceMs: 1500,
    throttleMs: 75,
  });

  const { handleStaleAck } = useWhiteboardOrchestration({
    socket,
    callId,
    isActive,
    canSync,
    isReadyToApply: isReady,
    applySnapshot,
    setMyColor,
    applyRemoteAdd,
    applyRemoteUpdate,
    applyRemoteDelete,
    onCursorUpdate: handleRemoteCursor,
    onSyncError: (error) => {
      console.warn("whiteboard sync error:", error);
    },
  });

  useEffect(() => {
    if (registerStaleAckHandler) {
      registerStaleAckHandler(handleStaleAck);
    }
    return () => {
      registerStaleAckHandler?.(() => {});
    };
  }, [registerStaleAckHandler, handleStaleAck]);

  return (
    <div className={cn("relative h-full w-full bg-zinc-950 text-white min-h-0 min-w-0", className)}>
      <WhiteboardCanvas canvasCallbackRef={canvasCallbackRef} isReady={isReady} remoteCursors={remoteCursors} emitCursor={emitCursor} />
      <div className="absolute top-4 left-4 z-20 pointer-events-none">
        <WhiteboardToolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          activeColor={activeColor}
          setActiveColor={setActiveColor}
          className="max-h-[calc(100vh-10rem)] overflow-y-auto pointer-events-auto bg-[#3F444B]/90 backdrop-blur-xl border border-white/10 shadow-2xl"
        />
      </div>
      <WhiteboardControls onClose={closeWhiteboard} />
      <span className="hidden sm:block absolute bottom-3 left-3 z-10 text-xs text-zinc-500/80 select-none pointer-events-none">
        Hold Space to pan
      </span>
    </div>
  );
}

export function Whiteboard(props: WhiteboardProps) {
  const { isActive } = useWhiteboard();

  if (!isActive) return null;

  return <WhiteboardInner {...props} className={cn("h-full w-full", props.className)} />;
}
