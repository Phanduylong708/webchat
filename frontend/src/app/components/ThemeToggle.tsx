import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="w-16 h-16 flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors cursor-pointer"
      aria-label="Toggle theme"
    >
      {/* Show Sun icon in dark mode (click to switch to light), Moon in light mode */}
      <Sun className="size-[18px] hidden dark:block" />
      <Moon className="size-[18px] block dark:hidden" />
      <span className="text-xs">Theme</span>
    </button>
  );
}
