import { createContext } from "react";
import type { CallContextValue } from "@/features/call/types/call.type";

// Global context for accessing call state and actions across the app.
export const CallContext = createContext<CallContextValue | null>(null);


