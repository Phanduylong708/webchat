import { ConversationUiProvider } from "@/contexts/conversationUiProvider";
import { MessageProvider } from "@/contexts/messageProvider";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useMessage } from "@/hooks/context/useMessage";
import ConversationListPanel from "@/components/layout/ConversationListPanel";
import ChatWindow from "@/components/chat/ChatWindow";
import MainContentPanel from "@/components/layout/MainContentPanel";

export default function ChatPage(): React.JSX.Element {
  return (
    <ConversationUiProvider>
      <MessageProvider>
        <ChatPageContent />
      </MessageProvider>
    </ConversationUiProvider>
  );
}

function ChatPageContent(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const activeConversationId = Number(searchParams.get("conversationId")) || null;
  const { fetchMessages } = useMessage();

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    }
  }, [activeConversationId, fetchMessages]);

  return (
    <div className="grid grid-cols-[300px_minmax(0,1fr)] h-screen">
      <ConversationListPanel />
      <MainContentPanel>
        <ChatWindow />
      </MainContentPanel>
    </div>
  );
}
