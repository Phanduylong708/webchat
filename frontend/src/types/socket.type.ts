import type { Socket } from "socket.io-client";

interface PresenceEntry {
  isOnline: boolean;
  lastSeen: string | null;
}

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    error: string | null;

    // Realtime presence overlay driven by socket events.
    // When missing for a userId, UI should fall back to API snapshot (e.g. /friends).
    presenceByUserId: Map<number, PresenceEntry>;
}

export type { SocketContextType, PresenceEntry };
