import type { Socket } from "socket.io-client";
interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    error: string | null;
}

export type { SocketContextType };