import React from "react";
import type { Friend } from "@/types/friend.type";
import formatLastSeen from "@/utils/helper.util";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useFriend } from "@/hooks/context/useFriend";
import { MessageCircle, UserMinus } from "lucide-react";
import RemoveFriendDialog from "./RemoveFriendDialog";

export default function FriendProfile({ friend }: { friend: Friend }): React.JSX.Element {
  const { selectFriend } = useFriend();

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardContent className="pt-6">
        <Avatar className="size-24 mx-auto">
          <AvatarImage src={friend.avatar || undefined} alt="Friend's Avatar" />
          <AvatarFallback>{friend.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <h2 className="text-2xl font-semibold text-center mt-4">{friend.username}</h2>
        {friend.isOnline ? (
          <p className="text-sm text-green-500 text-center">Online</p>
        ) : (
          <p className="text-sm text-muted-foreground text-center">
            Last seen {formatLastSeen(friend.lastSeen)}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button disabled variant="outline" title="Coming in Phase 4">
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
          onRemove={() => selectFriend(null)}
        ></RemoveFriendDialog>
      </CardFooter>
    </Card>
  );
}
