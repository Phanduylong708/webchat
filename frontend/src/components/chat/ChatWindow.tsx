import { useConversation } from "@/hooks/context/useConversation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import AddMemberDialog from "./AddMemberDialog";
import { useState } from "react";

function ChatWindow(): React.JSX.Element {
  const {
    conversations,
    activeConversationId,
    onlineUsers,
    leaveGroup,
    systemMessages,
  } = useConversation();
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const activeConversations = conversations.find(
    (c) => c.id === activeConversationId
  );
  const isGroup = activeConversations?.type === "GROUP";
  const isOnline = activeConversations?.otherUser
    ? onlineUsers.has(activeConversations.otherUser.id)
    : false;
  const title = isGroup
    ? activeConversations.title
    : activeConversations?.otherUser?.username;
  const statusText = isGroup
    ? `${activeConversations.memberCount} members`
    : isOnline
    ? "Online"
    : "Offline";

  const showGroupButtons = isGroup;

  async function handleLeaveGroup() {
    const { success, message } = await leaveGroup(activeConversationId!);
    if (success) {
      setIsLeaveDialogOpen(false);
    } else {
      alert(message || "Failed to leave group");
    }
  }

  if (!activeConversations) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-lg">Select a conversation to start chatting</p>
      </div>
    );
  }

  const systemMessage = activeConversations
    ? systemMessages.get(activeConversations.id)
    : undefined;

  return (
    <div className="flex flex-col h-full">
      <div className=" px-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold  truncate">{title}</h2>
              {!isGroup && (
                <div
                  className={`size-2 rounded-full ${
                    isOnline ? "bg-green-500" : "bg-muted-foreground/30"
                  }`}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground ">{statusText}</p>
          </div>

          {showGroupButtons && (
            <div className="shrink-0 ml-4 flex items-center gap-2">
              <AddMemberDialog conversationId={activeConversations.id} />
              <AlertDialog
                open={isLeaveDialogOpen}
                onOpenChange={setIsLeaveDialogOpen}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/20 text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4 mr-2 " />
                    Leave
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave Group?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to leave this group?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLeaveGroup}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Leave
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>
      <Separator />
      <MessageList />
      {systemMessage && (
        <div className="bg-muted px-4 py-2 text-xs text-muted-foreground">
          {systemMessage}
        </div>
      )}
      <ChatInput conversationId={activeConversations.id} />
    </div>
  );
}

export default ChatWindow;
