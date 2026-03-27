import React from "react";
import { X } from "lucide-react";
import AppNavContent from "@/app/components/navigation/AppNavContent";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

type MobileNavDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export default function MobileNavDrawer({
  open,
  onClose,
}: MobileNavDrawerProps): React.JSX.Element {
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        side="left"
        showCloseButton={false}
        aria-describedby={undefined}
        className="z-50 flex h-full w-[min(82vw,22rem)] max-w-full flex-col overflow-hidden border-r border-white/10 bg-sidebar p-0 text-sidebar-foreground shadow-xl md:hidden"
      >
        <SheetTitle className="sr-only">App menu</SheetTitle>

        <AppNavContent
          layout="mobile"
          onNavigate={onClose}
          headerAction={
            <SheetClose
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </SheetClose>
          }
        />
      </SheetContent>
    </Sheet>
  );
}
