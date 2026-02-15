import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Camera, Pencil, X } from "lucide-react";
import { useAuth } from "@/hooks/context/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { uploadMyAvatarApi } from "@/api/user.api";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function getAvatarFallback(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

type EditableField = "displayName" | "email";
const MAX_AVATAR_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const INVALID_FILE_TYPE_MESSAGE = "Invalid file type. Only JPEG, PNG, and WEBP are allowed.";
const FILE_TOO_LARGE_MESSAGE = "File too large. Max size is 5MB.";

export function ProfileDialog(): React.JSX.Element | null {
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="cursor-pointer rounded-full transition-opacity duration-[var(--dur-fast)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none"
          aria-label="Open profile settings"
        >
          <Avatar className="size-9">
            <AvatarImage src={currentUser.avatar || undefined} />
            <AvatarFallback>{getAvatarFallback(currentUser.username)}</AvatarFallback>
          </Avatar>
        </button>
      </DialogTrigger>

      <DialogPortal>
        <DialogOverlay className="!bg-[var(--overlay-dim)]" />
        <DialogPrimitive.Content
          className={cn(
            "bg-[var(--surface-raised)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50",
            "w-[340px] max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-[14px] border border-[var(--border-subtle)]",
            "p-0 shadow-lg duration-200 focus:outline-none",
          )}
        >
          <div className="relative h-[100px]" style={{ background: "var(--signature-gradient)" }}>
            <DialogClose asChild>
              <button
                type="button"
                className="absolute top-3 right-3 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white transition-colors duration-[var(--dur-fast)] hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
              >
                <X className="size-4" />
              </button>
            </DialogClose>
          </div>

          <div className="absolute left-1/2 top-[56px] -translate-x-1/2">
            <div
              className={cn(
                "group/avatar relative rounded-full bg-[var(--surface-raised)] p-1",
                isUploadingAvatar ? "cursor-not-allowed opacity-80" : "cursor-pointer",
              )}
              onClick={openAvatarPicker}
            >
              <Avatar className="size-[88px] border border-[var(--border-subtle)]">
                <AvatarImage
                  src={currentUser.avatar || undefined}
                  className={cn(
                    "object-cover transition-[filter,transform] duration-[var(--dur-slow)] ease-[var(--ease-out-smooth)]",
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
                  "opacity-0 transition-opacity duration-[var(--dur-slow)] ease-[var(--ease-out-smooth)]",
                  "group-hover/avatar:opacity-100",
                )}
              >
                <Camera className="size-4 text-white" />
                <span className="mt-1 text-[10px] font-semibold tracking-[0.12em] text-white">CHANGE</span>
              </div>

              <span className="absolute right-[2px] bottom-[2px] z-20 size-[18px] rounded-full border-[3.5px] border-[var(--surface-raised)] bg-[var(--status-online)]" />
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

          <div className="mx-5 mt-[60px] mb-5 overflow-hidden rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-inset)]">
            <div
              className={cn(
                "group/name-row flex cursor-pointer items-center justify-between bg-transparent px-4 py-3",
                "transition-colors duration-[var(--dur)] ease-[var(--ease-out-smooth)] hover:bg-[var(--surface-raised)]",
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
                    className="mt-1 h-8 border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 text-sm"
                  />
                ) : (
                  <p className="truncate text-sm font-medium">{draftDisplayName}</p>
                )}
              </div>
              <Pencil
                className={cn(
                  "text-muted-foreground size-4 shrink-0 opacity-0",
                  "transition-opacity duration-[var(--dur)] ease-[var(--ease-out-smooth)]",
                  "group-hover/name-row:opacity-100",
                  editingField === "displayName" && "opacity-40",
                )}
              />
            </div>

            <div className="h-px bg-[var(--border-subtle)]" />

            <div
              className={cn(
                "group/email-row flex cursor-pointer items-center justify-between px-4 py-3",
                "transition-colors duration-[var(--dur)] ease-[var(--ease-out-smooth)] hover:bg-[var(--surface-raised)]",
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
                    className="mt-1 h-8 border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 text-sm"
                  />
                ) : (
                  <p className="truncate text-sm font-medium">{draftEmail}</p>
                )}
              </div>
              <Pencil
                className={cn(
                  "text-muted-foreground size-4 shrink-0 opacity-0",
                  "transition-opacity duration-[var(--dur)] ease-[var(--ease-out-smooth)]",
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
