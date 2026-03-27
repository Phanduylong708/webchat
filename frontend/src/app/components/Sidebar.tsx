import React from "react";
import AppNavContent from "@/app/components/navigation/AppNavContent";

export default function Sidebar(): React.JSX.Element {
  return (
    <aside className="h-full bg-sidebar text-sidebar-foreground p-1">
      <AppNavContent layout="desktop" />
    </aside>
  );
}
