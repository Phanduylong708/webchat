import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import MobileNavDrawer from "@/app/components/navigation/MobileNavDrawer";
import { useAuth } from "@/features/auth/providers/useAuth";
import { IncomingCallDialog } from "@/features/call/components/IncomingCallDialog";
import { useAppSideCallSockets } from "@/features/call/hooks/sockets/useAppSideCallSockets";
import { ConversationUiProvider } from "@/features/conversation/providers/conversationUiProvider";
import { Loader2 } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";

export type HomeLayoutOutletContext = {
  openMobileNav: () => void;
  closeMobileNav: () => void;
};

function HomePage() {
  const { loading } = useAuth();
  const { pathname } = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useAppSideCallSockets();

  const openMobileNav = useCallback(() => {
    setIsMobileNavOpen(true);
  }, []);

  const closeMobileNav = useCallback(() => {
    setIsMobileNavOpen(false);
  }, []);

  useEffect(() => {
    closeMobileNav();
  }, [closeMobileNav, pathname]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    function handleViewportChange(event: MediaQueryListEvent | MediaQueryList) {
      if (event.matches) {
        closeMobileNav();
      }
    }

    handleViewportChange(mediaQuery);
    mediaQuery.addEventListener("change", handleViewportChange);

    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, [closeMobileNav]);

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
      <ConversationUiProvider>
        <div className="h-screen md:grid md:grid-cols-[minmax(56px,80px)_minmax(0,1fr)]">
          <div className="hidden h-full md:block">
            <Sidebar />
          </div>
          <div className="h-full min-w-0">
            <Outlet context={{ openMobileNav, closeMobileNav }} />
          </div>
        </div>
      </ConversationUiProvider>
      <MobileNavDrawer open={isMobileNavOpen} onClose={closeMobileNav} />
    </>
  );
}

export default HomePage;
