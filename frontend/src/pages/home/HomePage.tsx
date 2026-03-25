import Sidebar from "@/app/components/Sidebar";
import { useAuth } from "@/features/auth/providers/useAuth";
import { IncomingCallDialog } from "@/features/call/components/IncomingCallDialog";
import { useAppSideCallSockets } from "@/features/call/hooks/sockets/useAppSideCallSockets";
import { Loader2 } from "lucide-react";
import { Outlet } from "react-router-dom";

function HomePage() {
  const { loading } = useAuth();
  useAppSideCallSockets();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <IncomingCallDialog />
      <div className="grid grid-cols-[minmax(56px,80px)_minmax(0,1fr)] h-screen">
        <Sidebar />
        <Outlet />
      </div>
    </>
  );
}

export default HomePage;
