import { useMessageSockets } from "@/features/chat/hooks/useMessageSockets";
import ConversationListPanel from "@/features/conversation/components/ConversationListPanel";
import ChatWindow from "@/features/chat/components/ChatWindow";
import MainContentPanel from "@/app/components/MainContentPanel";
import { useSearchParams } from "react-router-dom";

export default function ChatPage(): React.JSX.Element {
  useMessageSockets();
  const [searchParams] = useSearchParams();
  const hasActiveConversation = Boolean(Number(searchParams.get("conversationId")) || null);

  return (
    <div className="h-screen md:grid md:grid-cols-[300px_minmax(0,1fr)]">
      <div className={hasActiveConversation ? "hidden md:block" : "h-full"}>
        <ConversationListPanel />
      </div>
      <MainContentPanel
        mobileDetail
        className={hasActiveConversation ? "h-full" : "hidden md:block"}
      >
        <ChatWindow />
      </MainContentPanel>
    </div>
  );
}
