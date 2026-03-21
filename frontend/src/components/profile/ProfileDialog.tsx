import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Camera, Pencil, X } from "lucide-react";
import { useAuth } from "@/features/auth/providers/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedAvatarUrl, getAvatarFallback } from "@/utils/image.util";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { uploadMyAvatarApi } from "@/api/user.api";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type EditableField = "displayName" | "email";
const MAX_AVATAR_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const INVALID_FILE_TYPE_MESSAGE = "Invalid file type. Only JPEG, PNG, and WEBP are allowed.";
const FILE_TOO_LARGE_MESSAGE = "File too large. Max size is 5MB.";

export function ProfileDialog({ trigger }: { trigger?: React.ReactNode }): React.JSX.Element | null {
  const { user, setCurrentUser } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [draftDisplayName, setDraftDisplayName] = React.useState(user?.username ?? "");
  const [draftEmail, setDraftEmail] = React.useState(user?.email ?? "");
  const [editingField, setEditingField] = React.useState<EditableField | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!user) {
    return null;
  }
  const currentUser = user;

  function resetDraftState(): void {
    setDraftDisplayName(currentUser.username);
    setDraftEmail(currentUser.email);
    setEditingField(null);
    setEditValue("");
  }

  function handleOpenChange(nextOpen: boolean): void {
    setOpen(nextOpen);
    resetDraftState();
  }

  function startEdit(field: EditableField): void {
    const nextValue = field === "displayName" ? draftDisplayName : draftEmail;
    setEditingField(field);
    setEditValue(nextValue);
  }

  function commitEdit(): void {
    if (!editingField) {
      return;
    }

    if (editingField === "displayName") {
      setDraftDisplayName(editValue);
    } else {
      setDraftEmail(editValue);
    }

    setEditingField(null);
    setEditValue("");
  }

  function handleEditInputBlur(): void {
    commitEdit();
  }

  function openAvatarPicker(): void {
    if (isUploadingAvatar) {
      return;
    }

    fileInputRef.current?.click();
  }

  async function handleAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    if (!ALLOWED_AVATAR_MIME_TYPES.has(selectedFile.type)) {
      toast.error(INVALID_FILE_TYPE_MESSAGE);
      event.target.value = "";
      return;
    }

    if (selectedFile.size > MAX_AVATAR_FILE_SIZE_BYTES) {
      toast.error(FILE_TOO_LARGE_MESSAGE);
      event.target.value = "";
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const updatedUser = await uploadMyAvatarApi(selectedFile);
      setCurrentUser(updatedUser);
    } catch (error) {
      const caughtError = error as { message?: string };
      toast.error(caughtError.message ?? "Avatar upload failed");
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = "";
    }
  }

  const defaultTrigger = (
    <button
      type="button"
      className="cursor-pointer rounded-full transition-opacity duration-(--dur-fast) hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none"
      aria-label="Open profile settings"
    >
      <Avatar className="size-10">
        <AvatarImage src={getOptimizedAvatarUrl(currentUser.avatar, 40)} />
        <AvatarFallback>{getAvatarFallback(currentUser.username)}</AvatarFallback>
      </Avatar>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>

      <DialogPortal>
        <DialogOverlay className="bg-(--overlay-dim)!" />
        <DialogPrimitive.Content
          className={cn(
            "bg-(--surface-raised) data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50",
            "w-[340px] max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-[14px] border border-(--border-subtle)",
            "p-0 shadow-lg duration-200 focus:outline-none",
          )}
        >
          <div className="relative h-[100px]" style={{ background: "var(--signature-gradient)" }}>
            <DialogClose asChild>
              <button
                type="button"
                className="absolute top-3 right-3 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white transition-colors duration-(--dur-fast) hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
              >
                <X className="size-4" />
              </button>
            </DialogClose>
          </div>

          <div className="absolute left-1/2 top-[52px] -translate-x-1/2">
            <div
              className={cn(
                "group/avatar relative rounded-full bg-(--surface-raised) p-1",
                isUploadingAvatar ? "cursor-not-allowed opacity-80" : "cursor-pointer",
              )}
              onClick={openAvatarPicker}
            >
              <Avatar className="size-24 border border-(--border-subtle)">
                <AvatarImage
                  src={getOptimizedAvatarUrl(currentUser.avatar, 96)}
                  className={cn(
                    "object-cover transition-[filter,transform] duration-(--dur-slow) ease-(--ease-out-smooth)",
                    "group-hover/avatar:blur-[1px]",
                  )}
                />
                <AvatarFallback className="text-xl font-semibold">
                  {getAvatarFallback(currentUser.username)}
                </AvatarFallback>
              </Avatar>

              <div
                className={cn(
                  "pointer-events-none absolute inset-1 z-10 flex flex-col items-center justify-center rounded-full bg-black/55",
                  "opacity-0 transition-opacity duration-(--dur-slow) ease-(--ease-out-smooth)",
                  "group-hover/avatar:opacity-100",
                )}
              >
                <Camera className="size-4 text-white" />
                <span className="mt-1 text-[10px] font-semibold tracking-[0.12em] text-white">CHANGE</span>
              </div>

              <span className="absolute right-[2px] bottom-[2px] z-20 size-[18px] rounded-full border-[3.5px] border-(--surface-raised) bg-(--status-online)" />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              disabled={isUploadingAvatar}
              onChange={handleAvatarFileChange}
            />
          </div>

          <div className="mx-5 mt-[64px] mb-5 overflow-hidden rounded-[10px] border border-(--border-subtle) bg-(--surface-inset)">
            <div
              className={cn(
                "group/name-row flex cursor-pointer items-center justify-between bg-transparent px-4 py-3",
                "transition-colors duration-(--dur) ease-(--ease-out-smooth) hover:bg-(--surface-raised)",
              )}
              onClick={() => {
                if (!editingField) {
                  startEdit("displayName");
                }
              }}
            >
              <div className="min-w-0">
                <p className="text-muted-foreground text-[11px] font-bold tracking-[0.04em]">DISPLAY NAME</p>
                {editingField === "displayName" ? (
                  <Input
                    autoFocus
                    value={editValue}
                    onChange={(event) => setEditValue(event.target.value)}
                    onBlur={handleEditInputBlur}
                    onFocus={(event) => event.currentTarget.select()}
                    className="mt-1 h-8 border-(--border-subtle) bg-(--surface-raised) px-2 text-sm"
                  />
                ) : (
                  <p className="truncate text-sm font-medium">{draftDisplayName}</p>
                )}
              </div>
              <Pencil
                className={cn(
                  "text-muted-foreground size-4 shrink-0 opacity-0",
                  "transition-opacity duration-(--dur) ease-(--ease-out-smooth)",
                  "group-hover/name-row:opacity-100",
                  editingField === "displayName" && "opacity-40",
                )}
              />
            </div>

            <div className="h-px bg-(--border-subtle)" />

            <div
              className={cn(
                "group/email-row flex cursor-pointer items-center justify-between px-4 py-3",
                "transition-colors duration-(--dur) ease-(--ease-out-smooth) hover:bg-(--surface-raised)",
              )}
              onClick={() => {
                if (!editingField) {
                  startEdit("email");
                }
              }}
            >
              <div className="min-w-0">
                <p className="text-muted-foreground text-[11px] font-bold tracking-[0.04em]">EMAIL</p>
                {editingField === "email" ? (
                  <Input
                    autoFocus
                    value={editValue}
                    onChange={(event) => setEditValue(event.target.value)}
                    onBlur={handleEditInputBlur}
                    onFocus={(event) => event.currentTarget.select()}
                    className="mt-1 h-8 border-(--border-subtle) bg-(--surface-raised) px-2 text-sm"
                  />
                ) : (
                  <p className="truncate text-sm font-medium">{draftEmail}</p>
                )}
              </div>
              <Pencil
                className={cn(
                  "text-muted-foreground size-4 shrink-0 opacity-0",
                  "transition-opacity duration-(--dur) ease-(--ease-out-smooth)",
                  "group-hover/email-row:opacity-100",
                  editingField === "email" && "opacity-40",
                )}
              />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
