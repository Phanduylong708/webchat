import { ConversationProvider } from "@/contexts/conversationProvider";
import { FriendProvider } from "@/contexts/friendContext";
import { MessageProvider } from "@/contexts/messageProvider";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
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
  const location = useLocation();
  const { activeConversationId, conversations, loadingConversations, selectConversation } = useConversation();
  const { fetchMessages } = useMessage();
  const hasAutoSelected = useRef(false);

  useEffect(() => {
    const selectId = (location.state as { selectConversationId?: number } | null)?.selectConversationId;
    if (selectId && !loadingConversations && !hasAutoSelected.current) {
      const exists = conversations.some(c => c.id === selectId);
      if (exists) {
        selectConversation(selectId);
        hasAutoSelected.current = true;
      }
    }
  }, [location.state, loadingConversations, conversations, selectConversation]);

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
