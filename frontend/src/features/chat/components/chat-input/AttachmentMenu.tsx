import { useState } from "react";
import { ImagePlus, Paperclip } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  onSelectImage: () => void;
  disabled: boolean;
};

export default function AttachmentMenu({ onSelectImage, disabled }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Attach"
          disabled={disabled}
          className="size-11 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors shrink-0"
        >
          <Paperclip className="size-[18px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="w-48 p-1">
        <button
          type="button"
          onClick={() => {
            onSelectImage();
            setOpen(false);
          }}
          className="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-md hover:bg-accent transition-colors"
        >
          <ImagePlus className="size-4 text-muted-foreground" />
          <span>Photo</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
