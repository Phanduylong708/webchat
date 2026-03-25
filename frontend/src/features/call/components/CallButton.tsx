import type { JSX } from "react";
import { Button } from "@/components/ui/button";
import {
  selectCurrentCallId,
  selectInitiateCall,
  selectIsInitiatingCall,
  useAppSideCallStore,
} from "@/features/call/stores/appSideCallStore";
import { Video } from "lucide-react";

interface CallButtonProps {
  conversationId: number;
}

/**
 * Renders a video call icon button that initiates a call for the given conversation.
 * The button is disabled if a call is already in progress.
 */
export function CallButton({ conversationId }: CallButtonProps): JSX.Element {
  const currentCallId = useAppSideCallStore(selectCurrentCallId);
  const isInitiatingCall = useAppSideCallStore(selectIsInitiatingCall);
  const initiateCall = useAppSideCallStore(selectInitiateCall);
  const isDisabled = Boolean(currentCallId) || isInitiatingCall;

  const handleInitiateCall = () => {
    if (isDisabled) return;
    void initiateCall(conversationId);
  };

  return (
    <Button
      size="icon"
      variant="outline"
      onClick={handleInitiateCall}
      disabled={isDisabled}
      aria-label="Start video call"
    >
      <Video />
    </Button>
  );
}
