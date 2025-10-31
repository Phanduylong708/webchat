import { ConversationProvider } from "@/contexts/conversationContext";
import ConversationListPanel from "@/components/chat/ConversationListPanel";

export default function ChatPage(): React.JSX.Element {
  return (
    <ConversationProvider>
      <ChatPageContent />
    </ConversationProvider>
  );
}

function ChatPageContent(): React.JSX.Element {
  return (
    <div className="grid grid-cols-[300px_1fr] h-screen">
      <ConversationListPanel />
    </div>
  );
}
