import { useContext } from "react";
import { RTCContext } from "@/contexts/rtcContext";
import type { RTCContextValue } from "@/types/rtc.type";

export function useRTC(): RTCContextValue {
  const context = useContext(RTCContext);
  if (!context) {
    throw new Error("useRTC must be used within a RTCProvider");
  }
  return context;
}
