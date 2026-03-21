import { createContext } from "react";
import type { RTCContextValue } from "@/features/call/types/rtc.type";

export const RTCContext = createContext<RTCContextValue | null>(null);
