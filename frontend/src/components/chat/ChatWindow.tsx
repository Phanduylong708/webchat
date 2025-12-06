import { useConversation } from "@/hooks/context/useConversation";
import { Separator } from "@/components/ui/separator";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import AddMemberDialog from "./AddMemberDialog";
import LeaveGroupDialog from "./LeaveGroupDialog";
import { CallButton } from "@/components/call/CallButton";

function ChatWindow(): React.JSX.Element {
  const { conversations, activeConversationId, onlineUsers, systemMessages } =
    useConversation();
  const activeConversations = conversations.find(
    (c) => c.id === activeConversationId
  );
  const isGroup = activeConversations?.type === "GROUP";
  const isOnline = activeConversations?.otherUser
    ? onlineUsers.has(activeConversations.otherUser.id)
    : false;
  const title = isGroup
    ? activeConversations.title
    : activeConversations?.otherUser?.username;
  const statusText = isGroup
    ? `${activeConversations.memberCount} members`
    : isOnline
    ? "Online"
    : "Offline";

  const showGroupButtons = isGroup;

  if (!activeConversations) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-lg">Select a conversation to start chatting</p>
      </div>
    );
  }

  const systemMessage = activeConversations
    ? systemMessages.get(activeConversations.id)
    : undefined;

  return (
    // main container
    <div className="flex flex-col h-full">
      {/* header container */}
      <div className=" px-4 pb-2">
        {/* header content, left and right */}
        <div className="flex items-center justify-between">
          {/* left content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* title and online status */}
              <h2 className="font-semibold  truncate">{title}</h2>
              {!isGroup && (
                <div
                  className={`size-2 rounded-full ${
                    isOnline ? "bg-green-500" : "bg-muted-foreground/30"
                  }`}
                />
              )}
            </div>
            {/* online status text */}
            <p className="text-sm text-muted-foreground ">{statusText}</p>
          </div>
          {/* Right content */}
          <div className="shrink-0 ml-4 flex items-center gap-2">
            <CallButton conversationId={activeConversations.id} />
            {/* group buttons only on group chat */}
            {showGroupButtons && (
              <>
                <AddMemberDialog conversationId={activeConversations.id} />
                <LeaveGroupDialog conversationId={activeConversations.id} />
              </>
            )}
          </div>
        </div>
      </div>
      <Separator />
      <MessageList /> {/* message list */}
      {/* system message, eg: typing indicator */}
      {systemMessage && (
        <div className="bg-muted px-4 py-2 text-xs text-muted-foreground">
          {systemMessage}
        </div>
      )}
      <ChatInput conversationId={activeConversations.id} /> {/* chat input */}
    </div>
  );
}

export default ChatWindow;
