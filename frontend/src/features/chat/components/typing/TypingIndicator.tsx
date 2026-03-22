import { useConversationUi } from "@/features/conversation/providers/useConversationUi";

export default function TypingIndicator({
  conversationId,
}: {
  conversationId: number;
}): React.JSX.Element {
  const { typingByConversation } = useConversationUi();
  const typingSet = typingByConversation.get(conversationId);
  const usernames = Array.from(typingSet?.values() || []);

  if (usernames.length === 0) return <></>;
  if (usernames.length === 1) {
    return (
      <div className="text-sm text-muted-foreground italic px-4 py-2">
        <span>{usernames[0]} is typing...</span>
      </div>
    );
  }
  return (
    <div className="text-sm text-muted-foreground italic px-4 py-2">
      <span>{usernames.join(", ")} are typing...</span>
    </div>
  );
}
