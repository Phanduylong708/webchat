import React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

type MobilePageHeaderProps = {
  title: string;
  onOpenNav: () => void;
  action?: React.ReactNode;
};

export default function MobilePageHeader({
  title,
  onOpenNav,
  action,
}: MobilePageHeaderProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 px-4 py-3 md:hidden">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onOpenNav}
        className="shrink-0 bg-background"
        aria-label="Open app navigation"
      >
        <Menu className="size-5" />
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
