import { useContext } from "react";
import { WhiteboardContext } from "@/contexts/whiteboardContext";
import type { WhiteboardContextValue } from "@/types/whiteboard.type";

export function useWhiteboard(): WhiteboardContextValue {
  const context = useContext(WhiteboardContext);
  if (!context) {
    throw new Error("useWhiteboard must be used within a WhiteboardProvider");
  }
  return context;
}
