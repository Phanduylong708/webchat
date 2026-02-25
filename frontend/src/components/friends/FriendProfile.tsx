import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Friend } from "@/types/friend.type";
import formatLastSeen from "@/utils/helper.util";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedAvatarUrl } from "@/utils/image.util";
import { Button } from "@/components/ui/button";
import { MessageCircle, UserMinus } from "lucide-react";
import RemoveFriendDialog from "./RemoveFriendDialog";
import { startPrivateChatApi } from "@/api/conversation.api";
import useSocket from "@/hooks/context/useSocket";

interface FriendProfileProps {
  friend: Friend;
  onClearSelection?: () => void;
}

export default function FriendProfile({ friend, onClearSelection }: FriendProfileProps): React.JSX.Element {
  const { isConnected, presenceByUserId } = useSocket();
  const navigate = useNavigate();

  const presence = isConnected ? presenceByUserId.get(friend.id) : undefined;
  const displayIsOnline = presence?.isOnline ?? friend.isOnline;
  const displayLastSeen = presence?.lastSeen ?? friend.lastSeen;

  async function handleSendMessage(): Promise<void> {
    try {
      const { conversationId } = await startPrivateChatApi(friend.id);
      navigate("/chat", { state: { selectConversationId: conversationId } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start chat";
      toast.error(message);
    }
  }

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardContent className="pt-6">
        <Avatar className="size-24 mx-auto">
          <AvatarImage src={getOptimizedAvatarUrl(friend.avatar, 96)} alt="Friend's Avatar" />
          <AvatarFallback>{friend.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <h2 className="text-2xl font-semibold text-center mt-4">{friend.username}</h2>
        {displayIsOnline ? (
          <p className="text-sm text-green-500 text-center">Online</p>
        ) : (
          <p className="text-sm text-muted-foreground text-center">
            Last seen {formatLastSeen(displayLastSeen)}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button variant="outline" onClick={handleSendMessage}>
          <MessageCircle className="mr-2 h-4 w-4" />
          Send Message
        </Button>
        <RemoveFriendDialog
          friend={friend}
          trigger={
            <Button variant="destructive">
              <UserMinus className="mr-2 h-4 w-4" />
              Remove Friend
            </Button>
          }
          onRemove={() => {
            onClearSelection?.();
          }}
        ></RemoveFriendDialog>
      </CardFooter>
    </Card>
  );
}
