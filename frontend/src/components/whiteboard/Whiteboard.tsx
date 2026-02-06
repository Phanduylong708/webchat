import { useCallback, useEffect } from "react";
import type { Socket } from "socket.io-client";
import type { WbAck, PartialSerializedObject, ObjectPatch, SerializedObject } from "@/types/whiteboard.type";
import { useWhiteboard } from "@/hooks/context/useWhiteboard";
import { useFabric } from "@/hooks/whiteboard/useFabric";
import { useCanvasSync } from "@/hooks/whiteboard/useCanvasSync";
import { useWhiteboardOrchestration } from "@/hooks/whiteboard/useWhiteboardOrchestration";
import { WhiteboardCanvas } from "@/components/whiteboard/WhiteboardCanvas";
import { WhiteboardToolbar } from "@/components/whiteboard/WhiteboardToolbar";
import { WhiteboardControls } from "@/components/whiteboard/WhiteboardControls";
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
      <WhiteboardCanvas canvasCallbackRef={canvasCallbackRef} isReady={isReady} />
      <WhiteboardToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        activeColor={activeColor}
        setActiveColor={setActiveColor}
        className="absolute top-4 left-4 z-10 bg-zinc-950/70 backdrop-blur-xl border border-white/10 shadow-2xl"
      />
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
