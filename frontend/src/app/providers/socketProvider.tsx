import { useState, useEffect } from "react";
import type { SocketContextType } from "@/types/socket.type";
import {
  getSocket,
  initializeSocket,
  disconnectSocket,
} from "@/lib/socket.client";
import { useAuth } from "@/features/auth/providers/useAuth";
import { getToken } from "@/utils/localStorage.util";
import { SocketContext } from "./socketContext";
import type { PresenceEntry } from "@/types/socket.type";

function SocketProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [isConnected, setIsConnected] = useState<boolean>(false); // connection status
  const [error, setError] = useState<string | null>(null); // error state
  const [presenceByUserId, setPresenceByUserId] = useState<
    Map<number, PresenceEntry>
  >(() => new Map());
  const socketInstance = getSocket(); // get the singleton socket instance
  const { user } = useAuth(); // get the authenticated user

  // Function to connect the socket
  useEffect(() => {
    if (user) {
      const token = getToken();
      if (token) {
        initializeSocket(token);
      }
    } else {
      disconnectSocket();
      setPresenceByUserId(new Map());
    }
  }, [user]);

  // Track friend online/offline status globally.
  useEffect(() => {
    if (!socketInstance) return;

    function normalizeLastSeen(value: unknown): string | null {
      if (value === null || value === undefined) return null;
      if (typeof value === "string") return value;
      if (value instanceof Date) return value.toISOString();
      return String(value);
    }

    function handleFriendsOnlineStatus(payload: {
      statuses: Array<{ userId: number; isOnline: boolean; lastSeen?: unknown }>;
    }) {
      setPresenceByUserId(() => {
        const next = new Map<number, PresenceEntry>();
        for (const status of payload.statuses) {
          next.set(status.userId, {
            isOnline: status.isOnline,
            lastSeen: normalizeLastSeen(status.lastSeen),
          });
        }
        return next;
      });
    }

    function handleFriendOnline(payload: { userId: number }) {
      setPresenceByUserId((prev) => {
        const next = new Map(prev);
        next.set(payload.userId, { isOnline: true, lastSeen: null });
        return next;
      });
    }

    function handleFriendOffline(payload: { userId: number; lastSeen?: unknown }) {
      const lastSeen = normalizeLastSeen(payload.lastSeen);
      setPresenceByUserId((prev) => {
        const next = new Map(prev);
        next.set(payload.userId, { isOnline: false, lastSeen });
        return next;
      });
    }

    socketInstance.on("friendsOnlineStatus", handleFriendsOnlineStatus);
    socketInstance.on("friendOnline", handleFriendOnline);
    socketInstance.on("friendOffline", handleFriendOffline);
    return () => {
      socketInstance.off("friendsOnlineStatus", handleFriendsOnlineStatus);
      socketInstance.off("friendOnline", handleFriendOnline);
      socketInstance.off("friendOffline", handleFriendOffline);
    };
  }, [socketInstance]);

  // Listen for connection events
  useEffect(() => {
    if (!socketInstance) return;

    // Check if already connected (missed event)
    if (socketInstance.connected) {
      setIsConnected(true);
    }

    // Handle connection established
    const handleConnect = () => {
      setIsConnected(true);
      setError(null);
    };
    socketInstance.on("connect", handleConnect);
    // Handle disconnection
    const handleDisconnect = () => {
      setIsConnected(false);
      setError(null);
      setPresenceByUserId(new Map());
    };
    socketInstance.on("disconnect", handleDisconnect);
    // Handle connection errors
    const handleError = (err: Error) => {
      setError(err instanceof Error ? err.message : "Socket connection error");
      setIsConnected(false); // ensure connection status is false on error
      console.error("Socket connection error:", err);
    };
    socketInstance.on("connect_error", handleError);
    // Cleanup event listeners on unmount
    return () => {
      socketInstance.off("connect", handleConnect);
      socketInstance.off("disconnect", handleDisconnect);
      socketInstance.off("connect_error", handleError);
    };
  }, [socketInstance]);

  const contextValue: SocketContextType = {
    socket: socketInstance,
    isConnected,
    error,
    presenceByUserId,
  };
  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}

export { SocketProvider };
