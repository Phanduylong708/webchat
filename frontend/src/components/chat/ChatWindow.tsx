import { useConversation } from "@/hooks/useConversation";
import MessageList from "./MessageList";

function ChatWindow(): React.JSX.Element {
  const { conversations, activeConversationId } = useConversation();
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

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h2 className="font-semibold">
          {activeConversations.type === "PRIVATE"
            ? activeConversations.otherUser?.username
            : activeConversations.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {activeConversations.type === "GROUP"
            ? `${activeConversations.memberCount} members`
            : "Online"}
        </p>
      </div>
      <MessageList />
      <div className="border-t p-4">
        <input
          type="text"
          placeholder="Message input coming soon..."
          disabled
          className="w-full px-4 py-2 border rounded-lg bg-muted"
        />
      </div>
    </div>
  );
}

export default ChatWindow;
