import { ConversationProvider } from "@/contexts/conversationProvider";
import { FriendProvider } from "@/contexts/friendContext";
import { MessageProvider } from "@/contexts/messageProvider";
import { useEffect } from "react";
import { useConversation } from "@/hooks/context/useConversation";
import { useMessage } from "@/hooks/context/useMessage";
import ConversationListPanel from "@/components/layout/ConversationListPanel";
import ChatWindow from "@/components/chat/ChatWindow";
import MainContentPanel from "@/components/layout/MainContentPanel";

export default function ChatPage(): React.JSX.Element {
  return (
    <FriendProvider>
      <ConversationProvider>
        <MessageProvider>
          <ChatPageContent />
        </MessageProvider>
      </ConversationProvider>
    </FriendProvider>
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
