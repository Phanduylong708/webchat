import { ConversationUiProvider } from "@/contexts/conversationUiProvider";
import { useMessageSockets } from "@/hooks/sockets/useMessageSockets";
import ConversationListPanel from "@/components/layout/ConversationListPanel";
import ChatWindow from "@/components/chat/ChatWindow";
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
