import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Friend } from "@/features/friends/types/friend.type";
import formatLastSeen from "@/utils/helper.util";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedAvatarUrl } from "@/utils/image.util";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageCircle, UserMinus, Video } from "lucide-react";
import RemoveFriendDialog from "./RemoveFriendDialog";
import { startPrivateChatApi } from "@/features/conversation/api/conversation.api";
import {
  selectCurrentCallId,
  selectInitiateCall,
  selectIsInitiatingCall,
  useAppSideCallStore,
} from "@/features/call/stores/appSideCallStore";
import useSocket from "@/app/providers/useSocket";

interface FriendProfileProps {
  friend: Friend;
  onClearSelection?: () => void;
}

export default function FriendProfile({ friend, onClearSelection }: FriendProfileProps): React.JSX.Element {
  const { isConnected, presenceByUserId } = useSocket();
  const navigate = useNavigate();
  const [isStartingCall, setIsStartingCall] = React.useState(false);
  const currentCallId = useAppSideCallStore(selectCurrentCallId);
  const isInitiatingCall = useAppSideCallStore(selectIsInitiatingCall);
  const initiateCall = useAppSideCallStore(selectInitiateCall);

  const presence = isConnected ? presenceByUserId.get(friend.id) : undefined;
  const displayIsOnline = presence?.isOnline ?? friend.isOnline;
  const displayLastSeen = presence?.lastSeen ?? friend.lastSeen;
  const isCallDisabled = Boolean(currentCallId) || isInitiatingCall || isStartingCall;

  async function handleSendMessage(): Promise<void> {
    try {
      const { conversationId } = await startPrivateChatApi(friend.id);
      navigate(`/chat?conversationId=${conversationId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start chat";
      toast.error(message);
    }
  }

  async function handleStartCall(): Promise<void> {
    if (isCallDisabled) return;
    if (!isConnected) {
      toast.error("You need to reconnect before starting a call");
      return;
    }

    setIsStartingCall(true);
    try {
      const { conversationId } = await startPrivateChatApi(friend.id);
      await initiateCall(conversationId);

      if (!useAppSideCallStore.getState().currentCallId) {
        toast.error("Failed to start call");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start call";
      toast.error(message);
    } finally {
      setIsStartingCall(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3 md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onClearSelection?.()}
          aria-label="Back to friends"
        >
          <ArrowLeft className="size-5" />
        </Button>
      </div>

      <Card className="mx-auto w-full max-w-md md:mt-8">
        <CardContent className="pt-6">
          <Avatar className="mx-auto size-24">
            <AvatarImage src={getOptimizedAvatarUrl(friend.avatar, 96)} alt="Friend's Avatar" />
            <AvatarFallback>{friend.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <h2 className="mt-4 text-center text-2xl font-semibold">{friend.username}</h2>
          {displayIsOnline ? (
            <p className="text-center text-sm text-green-500">Online</p>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Last seen {formatLastSeen(displayLastSeen)}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <div className="inline-flex flex-col gap-2">
            <Button
              className="w-full justify-start bg-green-600 text-white hover:bg-green-700 disabled:bg-green-600/50"
              onClick={handleStartCall}
              disabled={isCallDisabled}
            >
              <Video className="mr-2 h-4 w-4" />
              {isStartingCall || isInitiatingCall ? "Calling..." : "Call"}
            </Button>
            <Button variant="secondary" className="w-full justify-start" onClick={handleSendMessage}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Message
            </Button>
            <RemoveFriendDialog
              friend={friend}
              trigger={
                <Button variant="destructive" className="w-full justify-start">
                  <UserMinus className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              }
              onRemove={() => {
                onClearSelection?.();
              }}
            />
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
