import { useMemo } from "react";
import useSocket from "@/hooks/context/useSocket";

export function useOnlineUsers(): Set<number> {
  const { isConnected, presenceByUserId } = useSocket();

  return useMemo(() => {
    if (!isConnected) {
      return new Set<number>();
    }

    const online = new Set<number>();
    presenceByUserId.forEach((entry, userId) => {
      if (entry.isOnline) {
        online.add(userId);
      }
    });
    return online;
  }, [isConnected, presenceByUserId]);
}
