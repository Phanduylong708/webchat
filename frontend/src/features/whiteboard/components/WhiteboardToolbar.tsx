import { MousePointer2, Pencil, Square, Circle, Minus, Type, Eraser } from "lucide-react";
import type { ToolType } from "@/features/whiteboard/types/whiteboard.type";
import { cn } from "@/lib/utils";

const TOOLS: { id: ToolType; label: string; icon: React.ElementType }[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "pen", label: "Pen", icon: Pencil },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "line", label: "Line", icon: Minus },
  { id: "text", label: "Text", icon: Type },
  { id: "eraser", label: "Eraser", icon: Eraser },
];

const COLOR_PALETTE = [
  "#000000",
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#a855f7",
  "#ec4899",
  "#6b7280",
];

interface WhiteboardToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  className?: string;
}

export function WhiteboardToolbar({
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  className,
}: WhiteboardToolbarProps) {
  return (
    <div className={cn("hidden sm:flex flex-col items-center gap-0.5 p-1.5 rounded-lg", className)}>
      <div className="text-xs text-[#B8BEC7] tracking-[0.02em] text-center mb-0.5">Tools</div>

      {TOOLS.map(({ id, label, icon: Icon }) => (
        <button
          type="button"
          key={id}
          onClick={() => setActiveTool(id)}
          aria-pressed={activeTool === id}
          aria-label={label}
          title={label}
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-md transition-colors",
            activeTool === id
              ? "bg-[#2D7FF9] text-white"
              : "text-[#D6DAE0] hover:bg-white/10",
          )}
        >
          <span className="flex items-center justify-center w-5 h-5">
            <Icon className="w-5 h-5" />
          </span>
        </button>
      ))}

      <div className="h-px w-full bg-white/12 my-1.5" />

      <div className="text-xs text-[#B8BEC7] tracking-[0.02em] text-center mb-0.5">Color</div>

      <div className="grid grid-cols-2 gap-0.5">
        {COLOR_PALETTE.map((color) => (
          <button
            type="button"
            key={color}
            onClick={() => setActiveColor(color)}
            aria-label={`Set color ${color}`}
            aria-pressed={activeColor === color}
            className={cn(
              "w-5 h-5 rounded border-2 transition-colors",
              activeColor === color ? "border-white" : "border-transparent",
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}
