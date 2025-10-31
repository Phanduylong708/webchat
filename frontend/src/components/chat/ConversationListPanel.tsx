import { useConversation } from "@/hooks/useConversation";
import type { ConversationsResponse } from "@/types/chat.type";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Separator } from "../ui/separator";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { useEffect } from "react";

function ConversationItem({
  conversation,
}: {
  conversation: ConversationsResponse;
}): React.JSX.Element {
  const { selectConversation, activeConversationId } = useConversation();
  const isGroup = conversation.type === "GROUP";
  const firstPreview = conversation.previewMembers?.[0];
  const isActive = conversation.id === activeConversationId;

  const avatarSrc = isGroup
    ? firstPreview?.avatar ?? undefined
    : conversation.otherUser?.avatar ?? undefined;

  const fallback = isGroup
    ? firstPreview?.username[0].toUpperCase() ?? "G"
    : conversation.otherUser?.username[0].toUpperCase() ?? "U";

  const title = isGroup
    ? conversation.title ?? "Unnamed Group"
    : conversation.otherUser?.username ?? "Unknown user";
  return (
    <div
      className={`group flex items-center gap-3 p-3 rounded-lg border border-transparent cursor-pointer transition-all ${
        isActive
          ? "bg-primary/10 border-primary/20 shadow-sm"
          : "bg-background hover:bg-accent/50 hover:border-accent-foreground/10"
      }`}
      onClick={() => selectConversation(conversation.id)}
    >
      <Avatar className="size-10">
        <AvatarImage src={avatarSrc} />
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p
            className={`font-medium truncate ${
              isActive ? "text-foreground" : "text-foreground"
            }`}
          >
            {title}
          </p>
          {isGroup ? (
            <span
              className={`text-[10px] uppercase ${
                isActive ? "text-foreground/80" : "text-muted-foreground"
              }`}
            >
              Group
            </span>
          ) : (
            <span
              className={`text-xs ${
                isActive ? "text-foreground/80" : "text-muted-foreground"
              }`}
            >
              {/* TODO: online badge */}
              <span className="text-green-500">Online</span>
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {conversation.lastMessage?.content ?? "No messages yet."}
        </p>
      </div>
    </div>
  );
}

export default function ConversationListPanel(): React.JSX.Element {
  const { conversations, loadingConversations, error, fetchConversations } =
    useConversation();

  useEffect(() => {
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //helper component to render conversation list
  function renderConversationList(): React.JSX.Element {
    if (loadingConversations) {
      return (
        <div className="text-center text-muted-foreground py-8">Loading...</div>
      );
    }

    if (error && conversations.length === 0) {
      return (
        <div className="text-center text-destructive py-8">Error: {error}</div>
      );
    }

    if (conversations.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          No conversations yet. Start a new chat!
        </div>
      );
    }

    return (
      <>
        {conversations.map((conversation) => (
          <ConversationItem key={conversation.id} conversation={conversation} />
        ))}
      </>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted border-r border-border">
      <div className="p-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Conversations</h2>
      </div>
      <Separator />
      <div className="p-4">
        <Input
          placeholder="Search Conversations..."
          className="bg-background"
        />
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="p-2 gap-2 flex flex-col">
          {renderConversationList()}
        </div>
      </ScrollArea>
    </div>
  );
}
