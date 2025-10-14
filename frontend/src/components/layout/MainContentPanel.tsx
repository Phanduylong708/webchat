import React from "react";

export default function MainContentPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      className={`bg-background p-2 md:p-4 border-l border-border h-full min-w-0 overflow-y-auto ${className}`}
    >
      {children}
    </div>
  );
}
