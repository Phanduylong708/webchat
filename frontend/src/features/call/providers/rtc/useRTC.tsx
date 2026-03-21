import { useContext } from "react";
import { RTCContext } from "@/features/call/providers/rtc/rtcContext";
import type { RTCContextValue } from "@/features/call/types/rtc.type";

export function useRTC(): RTCContextValue {
  const context = useContext(RTCContext);
  if (!context) {
    throw new Error("useRTC must be used within a RTCProvider");
  }
  return context;
}
