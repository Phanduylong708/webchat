import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCall } from "@/hooks/context/useCall";
import useSocket from "@/hooks/context/useSocket";
import { Button } from "@/components/ui/button";
import {
  callEndReasonMessages,
  type ConversationType,
} from "@/types/call.type";

/**
 * Container component for the call page.
 * Handles joining a call, loading/error states, and dispatches to appropriate layout (1-1 vs group).
 */
export default function CallPage(): React.JSX.Element {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { joinCall, status, endReason } = useCall();
  const { isConnected } = useSocket();

  // Local state for page-level UI control
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [conversationType, setConversationType] =
    useState<ConversationType | null>(null);

  // Join call on mount (only after socket is connected)
  useEffect(() => {
    if (!callId) {
      setError("Call ID is missing");
      setIsLoading(false);
      setTimeout(() => navigate("/"), 2000);
      return;
    }

    if (!isConnected) {
      return;
    }

    async function handleJoin() {
      if (!callId) return; // Type guard
      const ack = await joinCall(callId);
      if (!ack.success) {
        setError(ack.error || "Failed to join call");
        setIsLoading(false);
        setTimeout(() => navigate("/"), 2000);
        return;
      }

      // Success: set conversationType from ACK
      setConversationType(ack.conversationType);
      setIsLoading(false);
    }

    handleJoin();
  }, [callId, joinCall, navigate, isConnected]);

  // Auto-redirect when call ends (optional UX enhancement)
  useEffect(() => {
    if (status === "ended" && endReason) {
      const timer = setTimeout(() => {
        navigate("/");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, endReason, navigate]);

  // Conditional rendering based on state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Joining call...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Redirecting to home...
          </p>
        </div>
      </div>
    );
  }

  if (status === "ended") {
    const message =
      endReason && endReason in callEndReasonMessages
        ? callEndReasonMessages[endReason]
        : "Call ended";

    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold">{message}</p>
          <p className="text-sm text-muted-foreground">
            Redirecting to home in 3 seconds...
          </p>
          <Button onClick={() => navigate("/")} variant="outline">
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  // Active call states (ringing/connecting/active) - placeholder for now
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-muted-foreground">
          CallPage - Active Call (Status: {status})
        </p>
        <p className="text-sm text-muted-foreground">
          Type: {conversationType || "Unknown"}
        </p>
        <p className="text-xs text-muted-foreground">
          Layout placeholder - will dispatch to OneOnOne/Group layout
        </p>
      </div>
    </div>
  );
}
