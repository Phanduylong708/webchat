import { useConversation } from "@/hooks/context/useConversation";
import type { ConversationsResponse } from "@/types/chat.type";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { StackedAvatars } from "../ui/stacked-avatars";
import { getOptimizedAvatarUrl } from "@/utils/image.util";
import { Separator } from "../ui/separator";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import CreateGroupDialog from "../chat/CreateGroupDialog";

function ConversationItem({ conversation }: { conversation: ConversationsResponse }): React.JSX.Element {
  const { selectConversation, activeConversationId, onlineUsers } = useConversation();
  const isGroup = conversation.type === "GROUP";
  const firstPreview = conversation.previewMembers?.[0];
  const isActive = conversation.id === activeConversationId;
  const otherUser = conversation.otherUser;

  const isPrivate = conversation.type === "PRIVATE";
  const isOnline = isPrivate && otherUser ? onlineUsers.has(otherUser.id) : false;

  const avatarSrc = isGroup ? (firstPreview?.avatar ?? undefined) : (otherUser?.avatar ?? undefined);

  const fallback = isGroup
    ? (firstPreview?.username[0].toUpperCase() ?? "G")
    : (otherUser?.username[0].toUpperCase() ?? "U");

  const title = isGroup ? (conversation.title ?? "Unnamed Group") : (otherUser?.username ?? "Unknown user");
  return (
    <div
      className={`group flex items-center gap-3 p-3 rounded-lg border border-transparent cursor-pointer transition-all ${
        isActive
          ? "bg-primary/10 border-primary/20 shadow-sm"
          : "bg-background hover:bg-accent/50 hover:border-accent-foreground/10"
      }`}
      onClick={() => selectConversation(conversation.id)}
    >
      {isGroup ? (
        <StackedAvatars users={conversation.previewMembers ?? []} size={24} overlap={8} />
      ) : (
        <Avatar className="size-10">
          <AvatarImage src={getOptimizedAvatarUrl(avatarSrc, 40)} />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`font-medium truncate flex-1 min-w-0 ${isActive ? "text-foreground" : "text-foreground"}`}
          >
            {title}
          </p>
          {isGroup ? (
            <span
              className={`text-[10px] uppercase shrink-0 ${isActive ? "text-foreground/80" : "text-primary"}`}
            >
              Group
            </span>
          ) : (
            <span className={`text-xs shrink-0 ${isActive ? "text-foreground/80" : "text-muted-foreground"}`}>
              {/* TODO: online badge */}
              {isOnline ? (
                <span className="text-green-500">Online</span>
              ) : (
                <span className="text-red-500">Offline</span>
              )}
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
  const { conversations, loadingConversations, error } = useConversation();

  function renderConversationList(): React.JSX.Element {
    if (loadingConversations) {
      return <div className="text-center text-muted-foreground py-8">Loading...</div>;
    }

    if (error && conversations.length === 0) {
      return <div className="text-center text-destructive py-8">Error: {error}</div>;
    }

    if (conversations.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">No conversations yet. Start a new chat!</div>
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
    <div className="h-full min-h-0 flex flex-col bg-muted border-r border-border">
      <div className="p-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Conversations</h2>
        <CreateGroupDialog />
      </div>
      <Separator />
      <div className="p-4">
        <Input placeholder="Search Conversations..." className="bg-background" />
      </div>
      <Separator />
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 gap-2 flex flex-col">{renderConversationList()}</div>
      </ScrollArea>
    </div>
  );
}
