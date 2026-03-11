export function toPinnedPreviewLabel(previewText: string | null | undefined): string {
  if (!previewText) {
    return "Pinned message";
  }

  if (previewText === "image") return "Image";
  if (previewText === "video") return "Video";
  if (previewText === "file") return "File";
  return previewText;
}
