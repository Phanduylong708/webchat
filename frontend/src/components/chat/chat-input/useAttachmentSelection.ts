import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

type DetachedAttachment = {
  file: File | null;
  previewUrl: string | null;
};

export function useAttachmentSelection() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset input first — so re-selecting same file (even if invalid) triggers onChange
    e.target.value = "";

    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error("Only JPEG, PNG and WEBP images are allowed");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Image must be less than 10 MB");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearSelectedFile() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(null);
    setPreviewUrl(null);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function detachSelectedForSubmit(): DetachedAttachment {
    const detachedAttachment: DetachedAttachment = {
      file: selectedFile,
      previewUrl,
    };

    setSelectedFile(null);
    setPreviewUrl(null);

    return detachedAttachment;
  }

  return {
    selectedFile,
    previewUrl,
    fileInputRef,
    handleFileSelect,
    clearSelectedFile,
    openFilePicker,
    detachSelectedForSubmit,
  };
}
