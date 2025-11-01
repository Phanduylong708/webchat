import type { Messages } from "@/types/chat.type";

interface MessageItemProps {
  message: Messages;
  isOwn: boolean;
}

export default function MessageItem({
  message,
  isOwn,
}: MessageItemProps): React.JSX.Element {
  const timestamp = new Date(message.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isOwn) {
    return (
      <div className="flex justify-end">
        <div className="flex flex-col items-end max-w-[70%]">
          <div className="break-words whitespace-pre-wrap bg-primary text-primary-foreground p-2 rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl">
            {message.content}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">
            {timestamp}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-xs text-muted-foreground">
        {message.sender.username}
      </span>
      <div className="max-w-[70%] break-words whitespace-pre-wrap bg-muted text-foreground px-3 py-2 rounded-tl-2xl rounded-tr-2xl rounded-br-2xl">
        {message.content}
      </div>
      <span className="text-[10px] text-muted-foreground">{timestamp}</span>
    </div>
  );
}
