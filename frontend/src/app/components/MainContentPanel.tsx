import React from "react";
import { cn } from "@/lib/utils";

type MainContentPanelProps = {
  children: React.ReactNode;
  className?: string;
  mobileDetail?: boolean;
};

export default function MainContentPanel({
  children,
  className,
  mobileDetail = false,
}: MainContentPanelProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "h-full min-w-0 overflow-y-auto bg-background",
        mobileDetail ? "p-0 md:border-l md:border-border md:p-4" : "border-l border-border p-2 md:p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
