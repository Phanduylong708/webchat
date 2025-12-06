import type { JSX } from "react";
import { useCall } from "@/hooks/context/useCall";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, PhoneOff } from "lucide-react";

export function IncomingCallDialog(): JSX.Element | null {
  const { incomingCall, acceptCall, declineCall } = useCall();

  if (!incomingCall) return null;

  const username = incomingCall.caller?.username ?? "";
  const displayName = username || "Unknown";
  const initial = username.trim().charAt(0).toUpperCase() || "U";

  return (
    <AlertDialog open>
      {/* 
        - w-[320px]: Fixed width for the dialog. Similar to the phone width.
        - gap-8: Gap between the components.
      */}
      <AlertDialogContent className="w-[320px]  gap-8 p-8 sm:rounded-3xl border shadow-xl">
        {/* HEADER: column center text and avatar */}
        <AlertDialogHeader className="flex flex-col items-center text-center sm:text-center space-y-4">
          {/* tracking-widest: make the text look wider */}
          <AlertDialogTitle className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Incoming Call
          </AlertDialogTitle>

          {/* Avatar Area */}
          <div className="relative">
            {/* slight wave effect to indicate the call is ringing, but not too loud */}
            <div className="absolute inset-0 rounded-full border border-primary/50 animate-ping" />
            <Avatar className="h-20 w-20 border-2 border-background shadow-sm relative z-10">
              <AvatarImage
                src={incomingCall.caller?.avatar ?? undefined}
                alt={displayName}
                className="object-cover"
              />
              <AvatarFallback className="text-xl bg-muted">
                {initial}
              </AvatarFallback>
            </Avatar>
          </div>
          {/* leading-none: remove default margin of shadcn */}
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-foreground leading-none">
              {displayName}
            </h3>
            <AlertDialogDescription>is calling you...</AlertDialogDescription>
          </div>
        </AlertDialogHeader>

        {/* FOOTER: buttons */}
        <AlertDialogFooter className="flex flex-row items-center justify-center gap-8 sm:justify-center sm:space-x-0 w-full">
          <AlertDialogCancel
            onClick={declineCall}
            className=" h-14 w-14 rounded-full border-none bg-red-500 text-white hover:bg-red-600 hover:text-white shadow-sm transition-colors"
          >
            <PhoneOff />
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={acceptCall}
            className="h-14 w-14 rounded-full bg-green-500 text-white hover:bg-green-600 hover:text-white shadow-sm transition-colors"
          >
            <Phone />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
