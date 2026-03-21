import { useContext } from "react";
import { WhiteboardContext } from "@/features/whiteboard/providers/whiteboardContext";
import type { WhiteboardContextValue } from "@/features/whiteboard/types/whiteboard.type";

export function useWhiteboard(): WhiteboardContextValue {
  const context = useContext(WhiteboardContext);
  if (!context) {
    throw new Error("useWhiteboard must be used within a WhiteboardProvider");
  }
  return context;
}
