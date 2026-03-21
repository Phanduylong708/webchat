import { ConversationUiProvider } from "@/contexts/conversationUiProvider";
import { useMessageSockets } from "@/features/chat/hooks/useMessageSockets";
import ConversationListPanel from "@/features/conversation/components/ConversationListPanel";
import ChatWindow from "@/features/chat/components/ChatWindow";
import MainContentPanel from "@/components/layout/MainContentPanel";

export default function ChatPage(): React.JSX.Element {
  useMessageSockets();

  return (
    <ConversationUiProvider>
      <div className="grid grid-cols-[300px_minmax(0,1fr)] h-screen">
        <ConversationListPanel />
        <MainContentPanel>
          <ChatWindow />
        </MainContentPanel>
      </div>
    </ConversationUiProvider>
  );
}
