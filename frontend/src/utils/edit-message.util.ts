function normalizeTextDraft(draft: string): string {
  return draft.trim();
}

function normalizeImageCaptionDraft(draft: string): string | null {
  const trimmed = draft.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isNoopTextEdit(oldContent: string | null, draft: string): boolean {
  return normalizeTextDraft(oldContent ?? "") === normalizeTextDraft(draft);
}

function isNoopImageCaptionEdit(oldContent: string | null, draft: string): boolean {
  const normalizedOld = oldContent === null ? null : normalizeImageCaptionDraft(oldContent);
  const normalizedDraft = normalizeImageCaptionDraft(draft);
  return normalizedOld === normalizedDraft;
}

export {
  normalizeTextDraft,
  normalizeImageCaptionDraft,
  isNoopTextEdit,
  isNoopImageCaptionEdit,
};
