import { useMessage } from "@/hooks/context/useMessage";
import { useConversation } from "@/hooks/context/useConversation";
import { useAuth } from "@/hooks/context/useAuth";
import type { DisplayMessage } from "@/types/chat.type";
import MessageItem from "./MessageItem";
import TypingIndicator from "./TypingIndicator";
import InfiniteScroll from "react-infinite-scroll-component";

type Props = {
  onRequestEdit?: (message: DisplayMessage) => void;
  onRequestReply?: (message: DisplayMessage) => void;
  editingMessageId?: number | null;
};

export default function MessageList({ onRequestEdit, onRequestReply, editingMessageId = null }: Props) {
  const { messagesByConversation, loadingMessages, loadOlderMessages, pagination, error } = useMessage();
  const { activeConversationId } = useConversation();
  const paginationInfo = activeConversationId ? pagination.get(activeConversationId) : undefined;
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
        <p className="text-center text-muted-foreground py-8">Loading messages...</p>
      </div>
    );
  }

  if (error && messages.length === 0) {
    return <div className="text-center text-destructive py-8">Error: {error}</div>;
  }

  if (messages.length === 0) {
    return <div className="text-center text-muted-foreground py-8">No messages yet</div>;
  }
  return (
    //prettier-ignore
    <div id="scrollableDiv" className="flex flex-col-reverse flex-1 overflow-y-auto px-4 py-6">
      <InfiniteScroll
        dataLength={messages.length}
        next={() => loadOlderMessages(activeConversationId)}
        hasMore = {paginationInfo?.hasMore ?? false}
        loader= {null}
        scrollableTarget="scrollableDiv"
        inverse ={true}
      >
        <div className="space-y-1">
        {messages.map((message, index) => {
          const isOwn = message.senderId === user?.id;
          const prevMessage = messages[index - 1];
          const nextMessage = messages[index + 1];
          const isFirstInGroup = !prevMessage || prevMessage.senderId !== message.senderId;
          const isLastInGroup = !nextMessage || nextMessage.senderId !== message.senderId;
          const stableKey = "_stableKey" in message
            ? String(message._stableKey)
            : String(message.id);
          return (
            <div
              key={stableKey}
              data-message-id={message.id}
              className={isFirstInGroup && index !== 0 ? "pt-3" : ""}
            >
              <MessageItem
                message={message}
                isOwn={isOwn}
                isFirstInGroup={isFirstInGroup}
                isLastInGroup={isLastInGroup}
                isEditing={editingMessageId === message.id}
                onRequestEdit={onRequestEdit}
                onRequestReply={onRequestReply}
              />
            </div>
          );
        })}
        <TypingIndicator conversationId={activeConversationId} />
        </div>
      </InfiniteScroll>
    </div>
  );
}
