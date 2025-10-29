import { useState, useEffect } from "react";
import type { SocketContextType } from "@/types/socket.type";
import {
  getSocket,
  initializeSocket,
  disconnectSocket,
} from "@/lib/socket.client";
import { useAuth } from "@/hooks/useAuth";
import { getToken } from "@/utils/localStorage.util";
import { SocketContext } from "./socketContext";

function SocketProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [isConnected, setIsConnected] = useState<boolean>(false); // connection status
  const [error, setError] = useState<string | null>(null); // error state
  const socketInstance = getSocket(); // get the singleton socket instance
  const { user } = useAuth(); // get the authenticated user

  // Function to connect the socket
  useEffect(() => {
    if (user) {
      const token = getToken();
      if (token) {
        initializeSocket(token); // initialize socket with token
      }
    } else {
      disconnectSocket(); // disconnect if no user (logged out)
    }
    return () => {
      disconnectSocket(); // cleanup on unmount
    };
  }, [user]);

  // Listen for connection events
  useEffect(() => {
    if (!socketInstance) return;
    // Handle connection established
    const handleConnect = () => {
      setIsConnected(true);
      setError(null);
      console.log("Socket connected");
    };
    socketInstance.on("connect", handleConnect);
    // Handle disconnection
    const handleDisconnect = () => {
      setIsConnected(false);
      setError(null);
      console.log("Socket disconnected");
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
  };
  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}

export { SocketProvider };
