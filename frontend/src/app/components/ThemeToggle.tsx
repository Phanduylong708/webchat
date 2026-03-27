import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

type ThemeToggleProps = {
  layout?: "desktop" | "mobile";
};

export function ThemeToggle({ layout = "desktop" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isMobile = layout === "mobile";

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "cursor-pointer rounded-lg transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isMobile
          ? "flex h-14 w-full items-center justify-start gap-3 px-4"
          : "flex h-16 w-16 flex-col items-center justify-center gap-1",
      )}
      aria-label="Toggle theme"
    >
      <Sun className="size-[18px] hidden dark:block" />
      <Moon className="size-[18px] block dark:hidden" />
      <span className={cn(isMobile ? "text-sm font-medium" : "text-xs")}>Theme</span>
    </button>
  );
}
