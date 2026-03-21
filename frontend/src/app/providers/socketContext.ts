import { createContext } from "react";
import type { SocketContextType } from "@/types/socket.type";

export const SocketContext = createContext<SocketContextType | undefined>(undefined);
