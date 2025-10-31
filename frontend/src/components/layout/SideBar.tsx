import React from "react";
import { User, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

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
        <Avatar className="size-9">
          <AvatarImage src={user?.avatar || "https://github.com/shadcn.png"} />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
        <span className="text-xs text-center truncate w-full">
          {user?.username}
        </span>
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
