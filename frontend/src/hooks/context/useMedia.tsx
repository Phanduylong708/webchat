import { useContext } from "react";
import { MediaContext } from "@/contexts/mediaContext";
import type { MediaContextValue } from "@/types/media.type";

export function useMedia(): MediaContextValue {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error("useMedia must be used within a MediaProvider");
  }
  return context;
}
