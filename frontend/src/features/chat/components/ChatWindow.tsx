import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useConversationsQuery } from "@/features/conversation/hooks/conversations";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useConversationUi } from "@/features/conversation/providers/useConversationUi";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StackedAvatars } from "@/components/ui/stacked-avatars";
import { getOptimizedAvatarUrl, getAvatarFallback } from "@/utils/image.util";
import type { DisplayMessage, ReplyToPreview } from "@/types/chat.type";
import useSocket from "@/app/providers/useSocket";
import MessageList from "@/features/chat/components/MessageList";
import ChatInput from "@/features/chat/components/ChatInput";
import GroupMembersDialog from "@/features/conversation/components/GroupMembersDialog";
import DeleteMessageDialog from "@/features/chat/components/message/DeleteMessageDialog";
import PinnedMessagesBanner from "@/features/chat/components/pin/PinnedMessagesBanner";
import PinnedMessagesPanel from "@/features/chat/components/pin/PinnedMessagesPanel";
import type { DeleteMessageTarget } from "@/features/chat/components/message/DeleteMessageDialog";
import { CallButton } from "@/features/call/components/CallButton";
import { useConversationPinsQuery, usePinMessageMutation, useUnpinMessageMutation } from "@/features/chat/hooks/pins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type MessageDeletedPayload = {
  conversationId: number;
  messageId: number;
};

function ChatWindow(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeConversationId = Number(searchParams.get("conversationId")) || null;

  const { data: conversations = [] } = useConversationsQuery();
  const onlineUsers = useOnlineUsers();
  const { systemMessages } = useConversationUi();
  const { socket } = useSocket();

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const pinsQuery = useConversationPinsQuery(activeConversationId ?? -1, true);
  const pinMessageMutation = usePinMessageMutation();
  const unpinMessageMutation = useUnpinMessageMutation();

  const [editTarget, setEditTarget] = useState<{
    conversationId: number;
    messageId: number;
    messageType: "TEXT" | "IMAGE";
    initialContent: string | null;
  } | null>(null);
  const [replyTarget, setReplyTarget] = useState<{
    conversationId: number;
    replyTo: ReplyToPreview;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteMessageTarget | null>(null);
  const [isPinnedPanelOpen, setIsPinnedPanelOpen] = useState(false);
  const pinnedSurfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeConversationId) return;
    if (editTarget && editTarget.conversationId !== activeConversationId) {
      setEditTarget(null);
    }
    if (replyTarget && replyTarget.conversationId !== activeConversationId) {
      setReplyTarget(null);
    }
    if (deleteTarget && deleteTarget.conversationId !== activeConversationId) {
      setDeleteTarget(null);
    }
    setIsPinnedPanelOpen(false);
  }, [activeConversationId, deleteTarget, editTarget, replyTarget]);

  const handleRequestEdit = useCallback((message: DisplayMessage) => {
    if (message.messageType !== "TEXT" && message.messageType !== "IMAGE") return;
    setReplyTarget(null);
    setEditTarget({
      conversationId: message.conversationId,
      messageId: message.id,
      messageType: message.messageType,
      initialContent: message.content,
    });
  }, []);

  const handleRequestReply = useCallback((message: DisplayMessage) => {
    if ("_optimistic" in message) return;
    setEditTarget(null);
    setReplyTarget({
      conversationId: message.conversationId,
      replyTo: {
        id: message.id,
        content: message.content,
        messageType: message.messageType,
        sender: message.sender,
      },
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditTarget(null);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTarget(null);
  }, []);

  const handleRequestDelete = useCallback((message: DisplayMessage) => {
    if ("_optimistic" in message) return;
    setDeleteTarget({
      conversationId: message.conversationId,
      messageId: message.id,
    });
  }, []);

  const handleRequestPin = useCallback(
    async (message: DisplayMessage) => {
      if ("_optimistic" in message) return;

      try {
        await pinMessageMutation.mutateAsync({
          conversationId: message.conversationId,
          messageId: message.id,
        });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Failed to pin message";
        toast.error(messageText);
      }
    },
    [pinMessageMutation],
  );

  const handleRequestUnpin = useCallback(
    async (message: DisplayMessage) => {
      if ("_optimistic" in message) return;

      try {
        await unpinMessageMutation.mutateAsync({
          conversationId: message.conversationId,
          messageId: message.id,
        });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Failed to unpin message";
        toast.error(messageText);
      }
    },
    [unpinMessageMutation],
  );

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDeleteTarget(null);
    }
  }, []);

  const handleOpenPinnedPanel = useCallback(() => {
    setIsPinnedPanelOpen((value) => !value);
  }, []);

  const handleClosePinnedPanel = useCallback(() => {
    setIsPinnedPanelOpen(false);
  }, []);

  const handleBackToList = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("conversationId");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const handleDeleteSuccess = useCallback(
    (target: DeleteMessageTarget) => {
      if (editTarget?.conversationId === target.conversationId && editTarget.messageId === target.messageId) {
        setEditTarget(null);
      }
    },
    [editTarget],
  );

  useEffect(() => {
    if (!socket || !replyTarget) return;
    const currentReplyTarget = replyTarget;

    function handleMessageDeleted(payload: MessageDeletedPayload) {
      if (payload.conversationId !== currentReplyTarget.conversationId) return;
      if (payload.messageId !== currentReplyTarget.replyTo.id) return;
      setReplyTarget(null);
    }

    socket.on("messageDeleted", handleMessageDeleted);
    return () => {
      socket.off("messageDeleted", handleMessageDeleted);
    };
  }, [replyTarget, socket]);

  useEffect(() => {
    if (!isPinnedPanelOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!pinnedSurfaceRef.current?.contains(event.target as Node)) {
        setIsPinnedPanelOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsPinnedPanelOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPinnedPanelOpen]);

  if (!activeConversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-lg">Select a conversation to start chatting</p>
      </div>
    );
  }

  const isGroup = activeConversation.type === "GROUP";
  const isOnline = activeConversation.otherUser ? onlineUsers.has(activeConversation.otherUser.id) : false;
  const title = isGroup ? activeConversation.title : activeConversation.otherUser?.username;
  const statusText = isGroup ? `${activeConversation.memberCount} members` : isOnline ? "Online" : "Offline";

  const showGroupButtons = isGroup;
  const systemMessage = systemMessages.get(activeConversation.id);
  const pinnedMessageIds = new Set((pinsQuery.data ?? []).map((item) => item.messageId));

  const previewMembers = activeConversation.previewMembers ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleBackToList}
              className="shrink-0 md:hidden"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="size-5" />
            </Button>
            {isGroup ? (
              <StackedAvatars users={previewMembers} />
            ) : (
              <div className="relative shrink-0">
                <Avatar className="size-10">
                  <AvatarImage src={getOptimizedAvatarUrl(activeConversation.otherUser?.avatar, 40)} />
                  <AvatarFallback>
                    {activeConversation.otherUser
                      ? getAvatarFallback(activeConversation.otherUser.username)
                      : "U"}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background ${
                    isOnline ? "bg-green-500" : "bg-muted-foreground/30"
                  }`}
                />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold truncate">{title}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{statusText}</p>
            </div>
          </div>
          <div className="shrink-0 ml-4 flex items-center gap-2">
            <CallButton conversationId={activeConversation.id} />
            {showGroupButtons && <GroupMembersDialog conversationId={activeConversation.id} />}
          </div>
        </div>
      </div>
      <Separator />
      <div ref={pinnedSurfaceRef} className="relative z-20">
        <PinnedMessagesBanner pinSummary={activeConversation.pinSummary} onClick={handleOpenPinnedPanel} />
        <PinnedMessagesPanel
          conversation={activeConversation}
          open={isPinnedPanelOpen}
          onClose={handleClosePinnedPanel}
        />
      </div>
      <MessageList
        key={activeConversation.id}
        conversationId={activeConversation.id}
        onRequestEdit={handleRequestEdit}
        onRequestReply={handleRequestReply}
        onRequestDelete={handleRequestDelete}
        onRequestPin={handleRequestPin}
        onRequestUnpin={handleRequestUnpin}
        pinnedMessageIds={pinnedMessageIds}
        editingMessageId={editTarget?.messageId ?? null}
      />
      {systemMessage && (
        <div className="bg-muted px-4 py-2 text-xs text-muted-foreground">{systemMessage}</div>
      )}
      <ChatInput
        conversationId={activeConversation.id}
        editTarget={editTarget}
        onCancelEdit={handleCancelEdit}
        replyTarget={replyTarget}
        onCancelReply={handleCancelReply}
      />
      <DeleteMessageDialog
        target={deleteTarget}
        onOpenChange={handleDeleteDialogOpenChange}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </div>
  );
}

export default ChatWindow;
