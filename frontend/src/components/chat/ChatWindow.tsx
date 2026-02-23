import { useConversation } from "@/hooks/context/useConversation";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StackedAvatars } from "@/components/ui/stacked-avatars";
import { getOptimizedAvatarUrl, getAvatarFallback } from "@/utils/image.util";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import GroupMembersDialog from "./GroupMembersDialog";
import { CallButton } from "@/components/call/CallButton";

function ChatWindow(): React.JSX.Element {
  const { conversations, activeConversationId, onlineUsers, systemMessages } = useConversation();
  const activeConversations = conversations.find((c) => c.id === activeConversationId);
  const isGroup = activeConversations?.type === "GROUP";
  const isOnline = activeConversations?.otherUser ? onlineUsers.has(activeConversations.otherUser.id) : false;
  const title = isGroup ? activeConversations.title : activeConversations?.otherUser?.username;
  const statusText = isGroup ? `${activeConversations.memberCount} members` : isOnline ? "Online" : "Offline";

  const showGroupButtons = isGroup;

  if (!activeConversations) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-lg">Select a conversation to start chatting</p>
      </div>
    );
  }

  const systemMessage = activeConversations ? systemMessages.get(activeConversations.id) : undefined;

  // Build avatar(s) for the header
  const previewMembers = activeConversations.previewMembers ?? [];

  return (
    // main container
    <div className="flex flex-col h-full">
      {/* header container */}
      <div className=" px-4 pb-2">
        {/* header content, left and right */}
        <div className="flex items-center justify-between">
          {/* left content */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar section */}
            {isGroup ? (
              <StackedAvatars users={previewMembers} />
            ) : (
              /* Single avatar for private chat */
              <div className="relative shrink-0">
                <Avatar className="size-10">
                  <AvatarImage src={getOptimizedAvatarUrl(activeConversations.otherUser?.avatar, 40)} />
                  <AvatarFallback>
                    {activeConversations.otherUser
                      ? getAvatarFallback(activeConversations.otherUser.username)
                      : "U"}
                  </AvatarFallback>
                </Avatar>
                {/* Online indicator dot overlaid on avatar */}
                <span
                  className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background ${
                    isOnline ? "bg-green-500" : "bg-muted-foreground/30"
                  }`}
                />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold truncate">{title}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{statusText}</p>
            </div>
          </div>
          {/* Right content */}
          <div className="shrink-0 ml-4 flex items-center gap-2">
            <CallButton conversationId={activeConversations.id} />
            {/* group buttons only on group chat */}
            {showGroupButtons && <GroupMembersDialog conversationId={activeConversations.id} />}
          </div>
        </div>
      </div>
      <Separator />
      <MessageList /> {/* message list */}
      {/* system message, eg: typing indicator */}
      {systemMessage && (
        <div className="bg-muted px-4 py-2 text-xs text-muted-foreground">{systemMessage}</div>
      )}
      <ChatInput conversationId={activeConversations.id} /> {/* chat input */}
    </div>
  );
}

export default ChatWindow;
