import React from "react";
import { LogOut, MessageCircle, User } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { ProfileDialog } from "@/features/auth/components/ProfileDialog";
import { useAuth } from "@/features/auth/providers/useAuth";
import { getOptimizedAvatarUrl } from "@/utils/image.util";

type AppNavContentProps = {
  layout?: "desktop" | "mobile";
  onNavigate?: () => void;
  headerAction?: React.ReactNode;
};

type NavItem = {
  to: "/friends" | "/chat";
  label: string;
  icon: typeof User;
};

const navItems: NavItem[] = [
  { to: "/friends", label: "Friends", icon: User },
  { to: "/chat", label: "Chats", icon: MessageCircle },
];

export default function AppNavContent({
  layout = "desktop",
  onNavigate,
  headerAction,
}: AppNavContentProps): React.JSX.Element {
  const { user, logout } = useAuth();
  const isMobile = layout === "mobile";

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          "border-white/10",
          isMobile
            ? "flex items-center justify-between border-b px-5 py-4"
            : "p-4 text-center",
        )}
      >
        <span className="text-2xl font-bold tracking-tight text-sidebar-foreground">WC</span>
        {isMobile ? headerAction : null}
      </div>

      <div
        className={cn(
          "min-h-0 flex flex-1 flex-col",
          isMobile ? "overflow-y-auto" : "",
        )}
      >
        <div
          className={cn(
            "flex-1",
            isMobile ? "flex flex-col gap-2 px-3 py-4" : "flex flex-col items-center gap-4 py-8",
          )}
        >
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center rounded-lg transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isMobile
                    ? "h-14 w-full justify-start gap-3 px-4"
                    : "size-16 flex-col justify-center gap-1",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                )
              }
            >
              <Icon className={cn(isMobile ? "size-5" : "size-6")} />
              <span className={cn(isMobile ? "text-sm font-medium" : "text-xs")}>{label}</span>
            </NavLink>
          ))}
        </div>

        <div
          className={cn(
            isMobile
              ? "border-t border-white/10 px-3 py-4"
              : "flex flex-col items-center gap-2 p-4",
          )}
        >
          <ProfileDialog
            trigger={
              <button
                type="button"
                className={cn(
                  "rounded-lg transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isMobile
                    ? "flex h-16 w-full items-center gap-3 px-4 text-left"
                    : "flex w-16 flex-col items-center justify-center gap-1 py-2",
                )}
                aria-label="Open profile settings"
              >
                <Avatar className="size-10">
                  <AvatarImage src={getOptimizedAvatarUrl(user?.avatar, 40)} />
                  <AvatarFallback>{user?.username?.slice(0, 2).toUpperCase() ?? "U"}</AvatarFallback>
                </Avatar>
                <div className={cn("min-w-0", isMobile ? "flex-1" : "w-full")}>
                  <span
                    className={cn(
                      "block truncate",
                      isMobile ? "text-sm font-medium" : "w-full text-center text-xs",
                    )}
                  >
                    {user?.username}
                  </span>
                </div>
              </button>
            }
          />

          <ThemeToggle layout={layout} />

          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              logout();
            }}
            className={cn(
              "rounded-lg transition-colors hover:bg-destructive/10 hover:text-destructive",
              isMobile
                ? "flex h-14 w-full items-center justify-start gap-3 px-4"
                : "flex size-16 flex-col items-center justify-center gap-1",
            )}
          >
            <LogOut className="size-[18px]" />
            <span className={cn(isMobile ? "text-sm font-medium" : "text-xs")}>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
