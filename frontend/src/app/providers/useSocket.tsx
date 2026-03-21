import { SocketContext } from "@/app/providers/socketContext";
import { useContext } from "react";
import type { SocketContextType } from "@/types/socket.type";

export default function useSocket(): SocketContextType {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used inside SocketProvider");
  }
  return context;
}
