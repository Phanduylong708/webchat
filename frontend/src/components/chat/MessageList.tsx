import { useAuth } from "@/hooks/context/useAuth";
import { useMessagesQuery } from "@/hooks/queries/messages";
import type { DisplayMessage } from "@/types/chat.type";
import MessageItem from "./MessageItem";
import TypingIndicator from "./TypingIndicator";
import InfiniteScroll from "react-infinite-scroll-component";

type Props = {
  conversationId: number;
  onRequestEdit?: (message: DisplayMessage) => void;
  onRequestReply?: (message: DisplayMessage) => void;
  onRequestDelete?: (message: DisplayMessage) => void;
  onRequestPin?: (message: DisplayMessage) => void;
  onRequestUnpin?: (message: DisplayMessage) => void;
  pinnedMessageIds?: ReadonlySet<number>;
  editingMessageId?: number | null;
};

export default function MessageList({
  conversationId,
  onRequestEdit,
  onRequestReply,
  onRequestDelete,
  onRequestPin,
  onRequestUnpin,
  pinnedMessageIds,
  editingMessageId = null,
}: Props) {
  const { user } = useAuth();
  const { data, isPending, isError, hasNextPage, fetchNextPage } = useMessagesQuery(conversationId);

  // Reverse pages so oldest batch comes first, then flatMap within each page.
  // pages[0] is the newest batch (initial fetch), pages[N] is the oldest (loaded via fetchNextPage).
  // Reversing gives chronological order oldest → newest, which matches the flex-col-reverse container.
  const messages = data?.pages.slice().reverse().flatMap((page) => page.messages) ?? [];

  // Initial load — query in flight and nothing cached yet
  if (isPending && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-center text-muted-foreground py-8">Loading messages...</p>
      </div>
    );
  }

  // Fetch failed and no cached data to fall back on
  if (isError && messages.length === 0) {
    return <div className="text-center text-destructive py-8">Failed to load messages</div>;
  }

  if (messages.length === 0) {
    return <div className="text-center text-muted-foreground py-8">No messages yet</div>;
  }

  // If isError but messages.length > 0, we still render the list —
  // a background refetch failure shouldn't hide cached data the user can read.
  return (
    //prettier-ignore
    <div id="scrollableDiv" className="flex flex-col-reverse flex-1 overflow-y-auto px-4 py-6">
      <InfiniteScroll
        dataLength={messages.length}
        next={fetchNextPage}
        hasMore={hasNextPage ?? false}
        loader={null}
        scrollableTarget="scrollableDiv"
        inverse={true}
      >
        <div className="space-y-1">
        {messages.map((message, index) => {
          const isOwn = message.senderId === user?.id;
          const prevMessage = messages[index - 1];
          const nextMessage = messages[index + 1];
          const isFirstInGroup = !prevMessage || prevMessage.senderId !== message.senderId;
          const isLastInGroup = !nextMessage || nextMessage.senderId !== message.senderId;
          const isPinned = pinnedMessageIds?.has(message.id) ?? false;
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
                onRequestDelete={onRequestDelete}
                onRequestPin={!isPinned ? onRequestPin : undefined}
                onRequestUnpin={isPinned ? onRequestUnpin : undefined}
              />
            </div>
          );
        })}
        <TypingIndicator conversationId={conversationId} />
        </div>
      </InfiniteScroll>
    </div>
  );
}
