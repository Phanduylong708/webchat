import { AuthProvider } from "@/contexts/authContext";
import { SocketProvider } from "./contexts/socketProvider";
import { CallProvider } from "@/contexts/callProvider";
import { IncomingCallDialog } from "@/components/call/IncomingCallDialog";
import { useAuth } from "@/hooks/context/useAuth";
import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import React from "react";

function AppContent() {
  const { checkAuth } = useAuth();

  React.useEffect(() => {
    checkAuth();
  }, []);

  return <Outlet />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
            <IncomingCallDialog />
            <AppContent />
          </CallProvider>
        </SocketProvider>
        <Toaster position="top-center" richColors duration={3000} />
      </AuthProvider>
    </ThemeProvider>
  );
}

//socket needs to be inside auth to access the token
//AppContent to wait for auth check before rendering routes
