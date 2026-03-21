import type { JSX } from "react";
import { useCall } from "@/features/call/providers/useCall";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";

interface CallButtonProps {
  conversationId: number;
}

/**
 * Renders a video call icon button that initiates a call for the given conversation.
 * The button is disabled if a call is already in progress.
 */
export function CallButton({ conversationId }: CallButtonProps): JSX.Element {
  const { initiateCall, status } = useCall();

  // A call is considered active if its status is not 'ended'.
  // This prevents starting a new call while one is ringing, connecting, or active.
  const isCallActive = status !== "ended";

  const handleInitiateCall = () => {
    if (isCallActive) return;
    initiateCall(conversationId);
  };

  return (
    <Button
      size="icon"
      variant="outline"
      onClick={handleInitiateCall}
      disabled={isCallActive}
      aria-label="Start video call"
    >
      <Video />
    </Button>
  );
}
