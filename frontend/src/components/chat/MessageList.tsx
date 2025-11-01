import { useMessage } from "@/hooks/useMessage";
import { useConversation } from "@/hooks/useConversation";
import { useAuth } from "@/hooks/useAuth";
import MessageItem from "./MessageItem";

export default function MessageList() {
  const { messagesByConversation, loadingMessages, error } = useMessage();
  const { activeConversationId } = useConversation();
  const { user } = useAuth();
  if (!activeConversationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-lg">Select a conversation to start chatting</p>
      </div>
    );
  }
  const messages = messagesByConversation.get(activeConversationId) || [];
  if (loadingMessages) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-center text-muted-foreground py-8">
          Loading messages...
        </p>
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div className="text-center text-destructive py-8">Error: {error}</div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No messages yet
      </div>
    );
  }
  return (
    <div className="flex flex-col flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.map((message) => {
        const isOwn = message.senderId === user?.id;
        return <MessageItem key={message.id} message={message} isOwn={isOwn} />;
      })}
    </div>
  );
}
