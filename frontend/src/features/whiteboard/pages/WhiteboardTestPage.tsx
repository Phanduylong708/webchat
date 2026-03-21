import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { WhiteboardProvider } from "@/features/whiteboard/providers/whiteboardProvider";
import useSocket from "@/hooks/context/useSocket";
import { useWhiteboard } from "@/features/whiteboard/providers/useWhiteboard";
import { useFabric } from "@/features/whiteboard/hooks/useFabric";
import { useWhiteboardOrchestration } from "@/features/whiteboard/hooks/useWhiteboardOrchestration";
import { useCanvasSync } from "@/features/whiteboard/hooks/useCanvasSync";
import { Whiteboard } from "@/features/whiteboard/components/Whiteboard";
import type { Socket } from "socket.io-client";
import type { ToolType, PartialSerializedObject, ObjectPatch, SerializedObject, WbAck } from "@/features/whiteboard/types/whiteboard.type";

interface LogEntry {
  id: number;
  type: "add" | "update" | "delete";
  objectId: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

const TOOL_KEYS: Record<string, ToolType> = {
  s: "select",
  p: "pen",
  r: "rect",
  e: "ellipse",
  l: "line",
  t: "text",
  x: "eraser",
};

const COLOR_PALETTE = [
  "#000000",
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#a855f7",
  "#ec4899",
  "#6b7280",
];

interface WhiteboardTestHarnessProps {
  socket: Socket | null;
  callId: string | null;
  canSync: boolean;
  registerStaleAckHandler: (handler: (ack?: WbAck) => void) => void;
}

function WhiteboardTestHarness({ socket, callId, canSync, registerStaleAckHandler }: WhiteboardTestHarnessProps) {
  const {
    isActive,
    objects,
    activeTool,
    activeColor,
    openWhiteboard,
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
  } = useWhiteboard();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);
  const logIdRef = useRef(0);

  useEffect(() => {
    openWhiteboard(); // dev harness: keep whiteboard active to exercise join/sync
  }, [openWhiteboard]);

  const addLog = useCallback((type: LogEntry["type"], objectId: string, data?: Record<string, unknown>) => {
    logIdRef.current += 1;
    const newId = logIdRef.current;
    setLogs((logs) => [...logs.slice(-49), { id: newId, type, objectId, data, timestamp: new Date() }]);
  }, []);

  const handleAdd = useCallback(
    (object: PartialSerializedObject) => {
      addLog("add", object.id, { type: object.type });
      emitAdd(object as SerializedObject);
    },
    [addLog, emitAdd],
  );

  const handleUpdate = useCallback(
    (objectId: string, patch: ObjectPatch) => {
      addLog("update", objectId, patch as Record<string, unknown>);
      emitUpdate(objectId, patch);
    },
    [addLog, emitUpdate],
  );

  const handleDelete = useCallback(
    (objectId: string) => {
      addLog("delete", objectId);
      emitDelete(objectId);
    },
    [addLog, emitDelete],
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
    registerStaleAckHandler(handleStaleAck);
  }, [registerStaleAckHandler, handleStaleAck]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        setActiveTool(tool);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveTool]);

  const clearLogs = () => setLogs([]);

  return (
    <div className="flex h-screen w-screen bg-gray-100">
      {/* Toolbar */}
      <div className="flex w-16 flex-col gap-2 bg-gray-800 p-2">
        <div className="mb-2 text-center text-xs text-gray-400">Tools</div>
        {(Object.entries(TOOL_KEYS) as [string, ToolType][]).map(([key, tool]) => (
          <button
            key={tool}
            onClick={() => setActiveTool(tool)}
            className={`rounded p-2 text-xs font-mono transition-colors ${
              activeTool === tool ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
            title={`${tool} (${key.toUpperCase()})`}
          >
            {key.toUpperCase()}
          </button>
        ))}

        <div className="my-2 border-t border-gray-600" />
        <div className="mb-1 text-center text-xs text-gray-400">Color</div>
        <div className="grid grid-cols-2 gap-1">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color}
              onClick={() => setActiveColor(color)}
              className={`h-6 w-6 rounded border-2 ${activeColor === color ? "border-white" : "border-transparent"}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative flex-1 overflow-auto bg-gray-200 p-4">
        <div className="inline-block shadow-lg">
          <canvas ref={canvasCallbackRef} className="block" />
        </div>

        {/* Status Bar */}
        <div className="absolute left-4 top-4 flex gap-4 rounded bg-black/70 px-3 py-1.5 text-sm text-white">
          <span>
            Tool: <strong>{activeTool}</strong>
          </span>
          <span>
            Color: <span className="inline-block h-4 w-4 rounded" style={{ backgroundColor: activeColor }} />
          </span>
          <span>Synced Objects: {Object.keys(objects).length}</span>
          <span>Sync: {canSync ? "Enabled" : "Disabled"}</span>
          <span>Canvas: {isReady ? "✓ Ready" : "Loading..."}</span>
        </div>
      </div>

      {/* Log Panel - Collapsible */}
      <div
        className={`flex flex-col bg-gray-900 text-sm text-gray-300 transition-all duration-200 ${
          isLogPanelOpen ? "w-80" : "w-10"
        }`}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setIsLogPanelOpen(!isLogPanelOpen)}
          className="flex h-10 items-center justify-center border-b border-gray-700 hover:bg-gray-800"
          title={isLogPanelOpen ? "Collapse" : "Expand Event Log"}
        >
          <span className="text-lg">{isLogPanelOpen ? "»" : "«"}</span>
        </button>

        {isLogPanelOpen && (
          <>
            <div className="flex items-center justify-between border-b border-gray-700 px-3 py-2">
              <span className="font-semibold">Event Log ({logs.length})</span>
              <button onClick={clearLogs} className="rounded bg-gray-700 px-2 py-1 text-xs hover:bg-gray-600">
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="py-4 text-center text-gray-500">No events yet</div>
              ) : (
                logs
                  .slice()
                  .reverse()
                  .map((log) => (
                    <div key={log.id} className="mb-2 rounded bg-gray-800 p-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                            log.type === "add"
                              ? "bg-green-600"
                              : log.type === "update"
                                ? "bg-yellow-600"
                                : "bg-red-600"
                          }`}
                        >
                          {log.type.toUpperCase()}
                        </span>
                        <span className="text-gray-400">{log.objectId.slice(0, 8)}...</span>
                      </div>
                      {log.data && (
                        <pre className="mt-1 text-gray-500">{String(JSON.stringify(log.data, null, 2))}</pre>
                      )}
                    </div>
                  ))
              )}
            </div>

            {/* Keyboard Shortcuts Help */}
            <div className="border-t border-gray-700 p-3 text-xs text-gray-500">
              <div className="font-semibold text-gray-400">Shortcuts:</div>
              <div>S=Select P=Pen R=Rect E=Ellipse</div>
              <div>L=Line T=Text X=Eraser</div>
              <div>Del/Backspace = Delete selected</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface WhiteboardUIMountProps {
  socket: Socket | null;
  callId: string | null;
  canSync: boolean;
  registerStaleAckHandler: (handler: (ack?: WbAck) => void) => void;
}

function WhiteboardUIMount({ socket, callId, canSync, registerStaleAckHandler }: WhiteboardUIMountProps) {
  const { isActive, openWhiteboard } = useWhiteboard();

  useEffect(() => {
    openWhiteboard();
  }, [openWhiteboard]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-950">
      {isActive ? (
        <Whiteboard
          socket={socket}
          callId={callId}
          canSync={canSync}
          registerStaleAckHandler={registerStaleAckHandler}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <button
            type="button"
            onClick={openWhiteboard}
            className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 transition-colors"
          >
            Open Whiteboard
          </button>
        </div>
      )}
    </div>
  );
}

export default function WhiteboardTestPage() {
  const { socket, isConnected } = useSocket();
  const [searchParams] = useSearchParams();
  const callId = searchParams.get("callId");
  const isUIMode = searchParams.get("ui") === "1";
  const canSync = Boolean(isConnected && callId);
  const staleAckHandlerRef = useRef<(ack?: WbAck) => void>(() => {});
  const registerStaleAckHandler = useCallback((handler: (ack?: WbAck) => void) => {
    staleAckHandlerRef.current = handler;
  }, []);

  return (
    <WhiteboardProvider
      socket={socket}
      callId={callId}
      canSync={canSync}
      onStaleAck={(ack) => staleAckHandlerRef.current(ack)}
    >
      {isUIMode ? (
        <WhiteboardUIMount
          socket={socket}
          callId={callId}
          canSync={canSync}
          registerStaleAckHandler={registerStaleAckHandler}
        />
      ) : (
        <WhiteboardTestHarness
          socket={socket}
          callId={callId}
          canSync={canSync}
          registerStaleAckHandler={registerStaleAckHandler}
        />
      )}
    </WhiteboardProvider>
  );
}
