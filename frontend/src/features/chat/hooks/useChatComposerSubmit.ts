import { useState } from "react";
import { toast } from "sonner";
import useSocket from "@/app/providers/useSocket";
import { useAuth } from "@/features/auth/providers/useAuth";
import { uploadMediaApi } from "@/features/chat/api/media.api";
import {
  useInsertOptimisticMessageIntoCache,
  useSendMessageMutation,
  useUpdateOptimisticMessageInCache,
} from "@/features/chat/hooks/messages";
import {
  selectClearUploadProgress,
  selectSetUploadProgress,
  useMessageStore,
} from "@/features/chat/stores/messageStore";
import type { ReplyToPreview } from "@/types/chat.type";
import { emitWithAckTimeout } from "@/utils/socketAck.util";
import { buildOptimisticMediaMessage } from "@/utils/message.utils";
import {
  buildReplySendFields,
  getReplyToFromTarget,
  toUserMessage,
} from "@/features/chat/hooks/chatComposer.utils";

// ---------------------------------------------------------------------------
// Local types
//
// ChatInput already receives these shapes from its parent. Re-declaring them
// here keeps this file self-contained, so the send flow can be understood in
// one place without jumping back and forth between components.
// ---------------------------------------------------------------------------

type EditTarget = {
  conversationId: number;
  messageId: number;
  messageType: "TEXT" | "IMAGE";
  initialContent: string | null;
};

type ReplyTarget = {
  conversationId: number;
  replyTo: ReplyToPreview;
};

type EditMessageAck = {
  success: boolean;
  message?: unknown;
  error?: string;
  code?: string;
};

type UseChatComposerSubmitParams = {
  conversationId: number;
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  selectedFile: File | null;
  previewUrl: string | null;
  clearSelectedFile: () => void;
  detachSelectedForSubmit: () => { file: File | null; previewUrl: string | null };
  editTarget: EditTarget | null;
  replyTarget: ReplyTarget | null;
  editSaveDisabled: boolean;
  onCancelEdit?: () => void;
  onSaveEdit?: (draft: string) => Promise<void>;
  onCancelReply?: () => void;
  stopTyping: () => void;
};

type UseChatComposerSubmitResult = {
  isSending: boolean;
  handleSubmit: () => Promise<void>;
  handleCancelEdit: () => void;
};

// Saving an edit and sending a brand-new message use different backend paths,
// but the composer presents them as the same submit action. This timeout lives
// here because this hook owns the "save current draft" flow.
const EDIT_ACK_TIMEOUT_MS = 12_000;

// ---------------------------------------------------------------------------
// useChatComposerSubmit
//
// ChatInput keeps the UI-facing pieces:
// - textarea state
// - emoji picker state
// - caret placement after inserting emoji
//
// This hook keeps the submit-side pieces:
// - save edit
// - send text
// - send image
// - update optimistic messages
// - track upload progress
//
// The split is simple: if logic mainly exists to talk to the server, patch
// cache, or manage send failures, it belongs here instead of in ChatInput.
// ---------------------------------------------------------------------------

export function useChatComposerSubmit({
  conversationId,
  inputValue,
  setInputValue,
  selectedFile,
  previewUrl,
  clearSelectedFile,
  detachSelectedForSubmit,
  editTarget,
  replyTarget,
  editSaveDisabled,
  onCancelEdit,
  onSaveEdit,
  onCancelReply,
  stopTyping,
}: UseChatComposerSubmitParams): UseChatComposerSubmitResult {
  const [isSending, setIsSending] = useState(false);
  const { socket } = useSocket();
  const { user } = useAuth();
  const sendMessageMutation = useSendMessageMutation();
  const insertOptimisticMessageIntoCache = useInsertOptimisticMessageIntoCache();
  const updateOptimisticMessageInCache = useUpdateOptimisticMessageInCache();
  const setUploadProgress = useMessageStore(selectSetUploadProgress);
  const clearUploadProgress = useMessageStore(selectClearUploadProgress);

  // Reply mode should disappear as soon as the current draft has been handed
  // off to the send flow. Waiting for the server would make the UI feel slow,
  // especially when an image still needs time to upload.
  function clearReplyModeAfterEnqueue() {
    if (!replyTarget) return;
    onCancelReply?.();
  }

  // Leaving edit mode should reset all temporary composer state tied to that
  // mode, not just hide the edit banner. That avoids carrying old draft text,
  // selected files, or typing state into the next action.
  function handleCancelEdit() {
    if (!editTarget) return;
    stopTyping();
    setInputValue("");
    clearSelectedFile();
    onCancelEdit?.();
  }

  // Image sending happens in two steps:
  // 1. upload the file to get an attachment ID
  // 2. send the chat message that points at that uploaded attachment
  //
  // The progress number changes too often to live in the main message cache.
  // Keeping it in the small Zustand store prevents the whole message list from
  // re-rendering on every upload tick.
  async function uploadAttachmentAndTrackProgress(
    imageFile: File,
    optimisticMessageId: number,
  ): Promise<number[]> {
    const uploadedAttachment = await uploadMediaApi(imageFile, {
      onProgress: (progressPercent) => {
        setUploadProgress(optimisticMessageId, progressPercent);
      },
    });

    // Once the upload finishes, that progress entry has served its purpose.
    clearUploadProgress(optimisticMessageId);
    return [uploadedAttachment.id];
  }

  // Saving an edit does not create a new message, so it does not go through
  // the same optimistic flow as a text send. It still belongs in this hook
  // because the composer treats both actions as "submit what is in the box".
  async function saveEditedMessage() {
    if (!editTarget || editSaveDisabled) return;

    setIsSending(true);
    try {
      if (onSaveEdit) {
        await onSaveEdit(inputValue);
      } else {
        if (!socket || !socket.connected) {
          throw new Error("Socket is not connected");
        }

        // Existing messages already have a place in the cache. This path only
        // needs confirmation that the server accepted the new content.
        await emitWithAckTimeout<EditMessageAck | undefined, EditMessageAck>({
          socket,
          event: "editMessage",
          payload: {
            conversationId: editTarget.conversationId,
            messageId: editTarget.messageId,
            content: inputValue,
          },
          timeoutMs: EDIT_ACK_TIMEOUT_MS,
          timeoutErrorMessage: "Edit timed out - no server acknowledgement",
          isSuccess: (acknowledgement): acknowledgement is EditMessageAck =>
            Boolean(acknowledgement?.success),
          getErrorMessage: (acknowledgement) => acknowledgement?.error || "Edit failed",
        });
      }

      handleCancelEdit();
    } catch (error) {
      toast.error(toUserMessage(error, "Edit failed"));
      console.error("Edit failed:", error);
    } finally {
      setIsSending(false);
    }
  }

  // Image sending needs a local preview bubble before the upload finishes.
  // If we waited until mutate() ran, the user would not see the image preview
  // or upload state soon enough, which makes the send feel unresponsive.
  async function sendMediaMessage(trimmedInputValue: string, imageFile: File) {
    if (!user) return;

    const optimisticMessageId = -Date.now();
    const replyPreview = getReplyToFromTarget(replyTarget);
    const replySendFields = buildReplySendFields(replyPreview);

    insertOptimisticMessageIntoCache(
      conversationId,
      buildOptimisticMediaMessage({
        tempId: optimisticMessageId,
        conversationId,
        trimmed: trimmedInputValue,
        sender: user,
        previewUrl,
        replyTo: replyPreview,
      }),
    );

    // Clear reply mode right after the draft enters the send flow so text and
    // image messages behave the same way from the user's point of view.
    clearReplyModeAfterEnqueue();

    // Clear the composer right away so the user can keep typing. We detach the
    // selected image without revoking its preview URL because the optimistic
    // bubble still depends on that URL until the server image replaces it.
    setInputValue("");
    detachSelectedForSubmit();

    let uploadedAttachmentIds: number[];
    try {
      uploadedAttachmentIds = await uploadAttachmentAndTrackProgress(imageFile, optimisticMessageId);
    } catch (uploadError) {
      // The preview bubble is already visible, so marking it as failed gives
      // the user clearer feedback than silently removing it from the list.
      updateOptimisticMessageInCache(conversationId, optimisticMessageId, {
        _status: "failed",
      });
      clearUploadProgress(optimisticMessageId);
      toast.error(toUserMessage(uploadError, "Upload failed"));
      return;
    }

    // Reuse the optimistic bubble we inserted above by passing the same ID
    // into the shared send-message mutation.
    await sendMessageMutation.mutateAsync({
      conversationId,
      content: trimmedInputValue.length > 0 ? trimmedInputValue : undefined,
      attachmentIds: uploadedAttachmentIds,
      ...replySendFields,
      _optimisticId: optimisticMessageId,
    });
  }

  // Text sending is simpler. The shared mutation already knows how to add the
  // optimistic text bubble, so this path only needs to start the mutation and
  // clear the draft after it succeeds.
  async function sendTextMessage(trimmedInputValue: string) {
    const replyPreview = getReplyToFromTarget(replyTarget);
    const replySendFields = buildReplySendFields(replyPreview);
    const sendMessagePromise = sendMessageMutation.mutateAsync({
      conversationId,
      content: trimmedInputValue,
      ...replySendFields,
    });

    clearReplyModeAfterEnqueue();
    await sendMessagePromise;
    setInputValue("");
  }

  // This is the only submit entry point used by the send button and the Enter
  // key. It chooses between three paths:
  // - save an existing edit
  // - send an image message
  // - send a text message
  async function handleSubmit() {
    if (editTarget) {
      await saveEditedMessage();
      return;
    }

    const trimmedInputValue = inputValue.trim();
    if ((!trimmedInputValue && !selectedFile) || isSending || !user) return;

    setIsSending(true);
    try {
      if (selectedFile) {
        await sendMediaMessage(trimmedInputValue, selectedFile);
      } else {
        await sendTextMessage(trimmedInputValue);
      }

      // Typing belongs to the draft the user was working on. Once that draft
      // has been handed off to the send flow, the typing signal should stop.
      stopTyping();
      clearSelectedFile();
    } catch (error) {
      // Text sends keep the draft in the input so retry is easy. Image sends
      // already expose failure through the optimistic preview bubble.
      toast.error(toUserMessage(error, "Send failed"));
      console.error("Send failed:", error);
    } finally {
      setIsSending(false);
    }
  }

  return {
    isSending,
    handleSubmit,
    handleCancelEdit,
  };
}
