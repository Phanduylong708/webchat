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
    <div className="mb-2 flex items-center gap-2">
      <div className="relative">
        <img
          src={previewUrl}
          alt={selectedFile.name}
          className="h-16 w-16 rounded-lg object-cover border border-border"
        />
        <button
          type="button"
          onClick={onClear}
          disabled={isSending}
          className="absolute -top-1.5 -right-1.5 size-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs disabled:opacity-50"
        >
          <X className="size-3" />
        </button>
      </div>
      <span className="text-xs text-muted-foreground truncate max-w-[200px]">{selectedFile.name}</span>
    </div>
  );
}
