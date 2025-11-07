import { ConversationProvider } from "@/contexts/conversationContext";
import { MessageProvider } from "@/contexts/messageProvider";
import { useEffect } from "react";
import { useConversation } from "@/hooks/useConversation";
import { useMessage } from "@/hooks/useMessage";
import ConversationListPanel from "@/components/chat/ConversationListPanel";
import ChatWindow from "@/components/chat/ChatWindow";
import MainContentPanel from "@/components/layout/MainContentPanel";

export default function ChatPage(): React.JSX.Element {
  return (
    <ConversationProvider>
      <MessageProvider>
        <ChatPageContent />
      </MessageProvider>
    </ConversationProvider>
  );
}

function ChatPageContent(): React.JSX.Element {
  const { activeConversationId } = useConversation();
  const { fetchMessages } = useMessage();

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    }
  }, [activeConversationId, fetchMessages]);
  return (
    <div className="grid grid-cols-[300px_1fr] h-screen">
      <ConversationListPanel />
      <MainContentPanel>
        <ChatWindow />
      </MainContentPanel>
    </div>
  );
}
