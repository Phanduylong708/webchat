import React from "react";
import { User, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/context/useAuth";
import { LogOut } from "lucide-react";
import { ProfileDialog } from "@/components/profile/ProfileDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedAvatarUrl } from "@/utils/image.util";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function SideBar(): React.JSX.Element {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isFriendsPage = location.pathname === "/friends";
  const isChatPage = location.pathname === "/chat";
  return (
    <div className="bg-sidebar text-sidebar-foreground p-1 flex flex-col h-full">
      <div className=" p-4 text-center">
        <span className="text-2xl font-bold">WC</span>
      </div>
      <div className="flex-1 flex flex-col items-center gap-4 py-8">
        {/* prettier-ignore */}
        <Link to="/friends" className={`w-16 h-16 flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors ${
        isFriendsPage ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}>
          <User size={24} />
          <span className="text-xs">Friends</span>
        </Link>

        {/* prettier-ignore */}
        <Link to="/chat" className={`w-16 h-16 flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors ${
        isChatPage ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}>
          <MessageCircle size={24} />
          <span className="text-xs">Chats</span>
        </Link>
      </div>

      <div className="p-4 flex flex-col items-center gap-2">
        <ProfileDialog
          trigger={
            <button
              type="button"
              className="w-16 flex flex-col items-center justify-center gap-1 rounded-lg py-2 cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              aria-label="Open profile settings"
            >
              <Avatar className="size-10">
                <AvatarImage src={getOptimizedAvatarUrl(user?.avatar, 40)} />
                <AvatarFallback>{user?.username?.slice(0, 2).toUpperCase() ?? "U"}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-center truncate w-full">{user?.username}</span>
            </button>
          }
        />
        <ThemeToggle />
        <button
          onClick={logout}
          className="w-16 h-16 flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut size={18} />
          <span className="text-xs">Logout</span>
        </button>
      </div>
    </div>
  );
}
