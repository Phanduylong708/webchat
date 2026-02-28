import { X } from "lucide-react";

type EditTarget = {
  messageType: "TEXT" | "IMAGE";
  initialContent: string | null;
};

type Props = {
  editTarget: EditTarget | null;
  onCancelEdit: () => void;
};

export default function EditModeBanner({ editTarget, onCancelEdit }: Props): React.JSX.Element | null {
  if (!editTarget) {
    return null;
  }

  return (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/30 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs font-medium">
          {editTarget.messageType === "IMAGE" ? "Editing caption" : "Editing message"}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{editTarget.initialContent ?? ""}</div>
      </div>
      <button
        type="button"
        aria-label="Cancel edit"
        onClick={onCancelEdit}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
