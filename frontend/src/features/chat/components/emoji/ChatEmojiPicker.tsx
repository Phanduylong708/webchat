import { Suspense, lazy } from "react";
import type { EmojiClickData, Theme } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";

const LazyEmojiPicker = lazy(async () => {
  const emojiPickerModule = await import("emoji-picker-react");

  return {
    default: emojiPickerModule.default,
  };
});

type ChatEmojiPickerProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isDisabled: boolean;
  pickerTheme: Theme;
  suppressCloseOnFocus: boolean;
  onEmojiClick: (emojiData: EmojiClickData) => void;
};

export default function ChatEmojiPicker({
  isOpen,
  setIsOpen,
  isDisabled,
  pickerTheme,
  suppressCloseOnFocus,
  onEmojiClick,
}: ChatEmojiPickerProps): React.JSX.Element {
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={isDisabled}
          className="size-11 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors shrink-0"
        >
          <Smile className="size-[18px]" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="p-0 w-80"
        onFocusOutside={(event) => {
          if (suppressCloseOnFocus) {
            event.preventDefault();
          }
        }}
      >
        <Suspense fallback={<div className="h-[400px] w-[320px] bg-background" />}>
          {isOpen ? (
            <LazyEmojiPicker
              onEmojiClick={onEmojiClick}
              autoFocusSearch={false}
              theme={pickerTheme}
              width={320}
              height={400}
            />
          ) : null}
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
