import { createContext } from "react";
import type { WhiteboardContextValue } from "@/types/whiteboard.type";

export const WhiteboardContext = createContext<WhiteboardContextValue | null>(null);
