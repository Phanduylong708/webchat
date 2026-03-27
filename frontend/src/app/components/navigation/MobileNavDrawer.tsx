import React from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

type MobileNavDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function MobileNavDrawer({
  open,
  onClose,
  children,
}: MobileNavDrawerProps): React.JSX.Element {
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        side="left"
        showCloseButton={false}
        aria-describedby={undefined}
        className="z-50 flex h-full w-[min(82vw,22rem)] max-w-full flex-col overflow-hidden border-r border-white/10 bg-sidebar p-0 text-sidebar-foreground shadow-2xl md:hidden"
      >
        <SheetTitle className="sr-only">Mobile navigation</SheetTitle>

        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <span className="text-2xl font-bold tracking-tight text-sidebar-foreground">WC</span>
          <SheetClose
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </SheetClose>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
