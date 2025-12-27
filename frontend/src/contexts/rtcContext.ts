import { createContext } from "react";
import type { RTCContextValue } from "@/types/rtc.type";

export const RTCContext = createContext<RTCContextValue | null>(null);
