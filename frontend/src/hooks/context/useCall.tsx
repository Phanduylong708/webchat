import { useContext } from "react";
import { CallContext } from "@/contexts/callContext";
import type { CallContextValue } from "@/types/call.type";

export function useCall(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}
