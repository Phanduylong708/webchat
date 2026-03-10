import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@/hooks/context/useConversation";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StackedAvatars } from "@/components/ui/stacked-avatars";
import { getOptimizedAvatarUrl, getAvatarFallback } from "@/utils/image.util";
import type { DisplayMessage, ReplyToPreview } from "@/types/chat.type";
import useSocket from "@/hooks/context/useSocket";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import GroupMembersDialog from "./GroupMembersDialog";
import DeleteMessageDialog from "./DeleteMessageDialog";
import PinnedMessagesBanner from "./PinnedMessagesBanner";
import PinnedMessagesPanel from "./PinnedMessagesPanel";
import type { DeleteMessageTarget } from "./DeleteMessageDialog";
import { CallButton } from "@/components/call/CallButton";
import { useConversationPinsQuery, usePinMessageMutation, useUnpinMessageMutation } from "@/hooks/queries/pins";
import { toast } from "sonner";

type MessageDeletedPayload = {
  conversationId: number;
  messageId: number;
};

function ChatWindow(): React.JSX.Element {
  const { conversations, activeConversationId, onlineUsers, systemMessages } = useConversation();
  const { socket } = useSocket();
  const activeConversations = conversations.find((c) => c.id === activeConversationId);
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

  if (!activeConversations) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-lg">Select a conversation to start chatting</p>
      </div>
    );
  }

  const isGroup = activeConversations.type === "GROUP";
  const isOnline = activeConversations.otherUser ? onlineUsers.has(activeConversations.otherUser.id) : false;
  const title = isGroup ? activeConversations.title : activeConversations.otherUser?.username;
  const statusText = isGroup ? `${activeConversations.memberCount} members` : isOnline ? "Online" : "Offline";

  const showGroupButtons = isGroup;
  const systemMessage = systemMessages.get(activeConversations.id);
  const pinnedMessageIds = new Set((pinsQuery.data ?? []).map((item) => item.messageId));

  // Build avatar(s) for the header
  const previewMembers = activeConversations.previewMembers ?? [];

  return (
    // main container
    <div className="flex flex-col h-full">
      {/* header container */}
      <div className="px-4 py-3">
        {/* header content, left and right */}
        <div className="flex items-center justify-between">
          {/* left content */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar section */}
            {isGroup ? (
              <StackedAvatars users={previewMembers} />
            ) : (
              /* Single avatar for private chat */
              <div className="relative shrink-0">
                <Avatar className="size-10">
                  <AvatarImage src={getOptimizedAvatarUrl(activeConversations.otherUser?.avatar, 40)} />
                  <AvatarFallback>
                    {activeConversations.otherUser
                      ? getAvatarFallback(activeConversations.otherUser.username)
                      : "U"}
                  </AvatarFallback>
                </Avatar>
                {/* Online indicator dot overlaid on avatar */}
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
          {/* Right content */}
          <div className="shrink-0 ml-4 flex items-center gap-2">
            <CallButton conversationId={activeConversations.id} />
            {/* group buttons only on group chat */}
            {showGroupButtons && <GroupMembersDialog conversationId={activeConversations.id} />}
          </div>
        </div>
      </div>
      <Separator />
      <div ref={pinnedSurfaceRef} className="relative z-20">
        <PinnedMessagesBanner pinSummary={activeConversations.pinSummary} onClick={handleOpenPinnedPanel} />
        <PinnedMessagesPanel
          conversation={activeConversations}
          open={isPinnedPanelOpen}
          onClose={handleClosePinnedPanel}
        />
      </div>
      <MessageList
        onRequestEdit={handleRequestEdit}
        onRequestReply={handleRequestReply}
        onRequestDelete={handleRequestDelete}
        onRequestPin={handleRequestPin}
        onRequestUnpin={handleRequestUnpin}
        pinnedMessageIds={pinnedMessageIds}
        editingMessageId={editTarget?.messageId ?? null}
      />{" "}
      {/* message list */}
      {/* system message, eg: typing indicator */}
      {systemMessage && (
        <div className="bg-muted px-4 py-2 text-xs text-muted-foreground">{systemMessage}</div>
      )}
      <ChatInput
        conversationId={activeConversations.id}
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
