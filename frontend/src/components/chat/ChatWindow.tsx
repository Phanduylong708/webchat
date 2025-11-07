import { useConversation } from "@/hooks/useConversation";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

function ChatWindow(): React.JSX.Element {
  const { conversations, activeConversationId, onlineUsers } =
    useConversation();
  let statusText: string;
  const activeConversations = conversations.find(
    (c) => c.id === activeConversationId
  );

  if (!activeConversations) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-lg">Select a conversation to start chatting</p>
      </div>
    );
  }

  if (activeConversations.type == "GROUP") {
    statusText = `${activeConversations.memberCount} members`;
  } else {
    const isOnline = activeConversations?.otherUser
      ? onlineUsers.has(activeConversations.otherUser.id)
      : false;
    statusText = isOnline ? "Online" : "Offline";
  }
  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h2 className="font-semibold">
          {activeConversations.type === "PRIVATE"
            ? activeConversations.otherUser?.username
            : activeConversations.title}
        </h2>
        <p className="text-sm text-muted-foreground">{statusText}</p>
      </div>
      <MessageList />
      <ChatInput conversationId={activeConversations.id} />
    </div>
  );
}

export default ChatWindow;
