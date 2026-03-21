import { useContext } from "react";
import { CallContext } from "@/features/call/providers/callContext";
import type { CallContextValue } from "@/features/call/types/call.type";

export function useCall(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}
