import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhiteboardControlsProps {
  onClose: () => void;
  className?: string;
}

export function WhiteboardControls({ onClose, className }: WhiteboardControlsProps) {
  return (
    <div className={cn("absolute top-4 right-4 z-20", className)}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close whiteboard"
        title="Close whiteboard"
        className="flex items-center justify-center w-10 h-10 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-black/70 transition-colors"
      >
        <XIcon className="w-5 h-5" />
      </button>
    </div>
  );
}
