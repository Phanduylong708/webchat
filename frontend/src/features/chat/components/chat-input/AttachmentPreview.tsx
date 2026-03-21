import { X } from "lucide-react";

type Props = {
  previewUrl: string | null;
  selectedFile: File | null;
  isSending: boolean;
  onClear: () => void;
};

export default function AttachmentPreview({
  previewUrl,
  selectedFile,
  isSending,
  onClear,
}: Props): React.JSX.Element | null {
  if (!previewUrl || !selectedFile) {
    return null;
  }

  return (
    <div className="px-3 pt-3 pb-2">
      <div className="inline-flex flex-col gap-1.5">
        <div className="relative group rounded-lg bg-muted/50 p-1.5">
          <img src={previewUrl} alt={selectedFile.name} className="max-h-[160px] rounded-md object-cover" />
          <button
            type="button"
            onClick={onClear}
            disabled={isSending}
            className="absolute top-3 right-3 size-6 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-destructive hover:bg-background transition-colors disabled:opacity-50"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <span className="text-xs text-muted-foreground truncate max-w-[240px]">{selectedFile.name}</span>
      </div>
    </div>
  );
}
