import { isNoopImageCaptionEdit, isNoopTextEdit, normalizeTextDraft } from "./edit-message.util";

type Params = {
  messageType: "TEXT" | "IMAGE";
  oldContent: string | null;
  draft: string;
};

type SaveReason = "EMPTY" | "NOOP";

type SaveState = {
  disabled: boolean;
  reason: SaveReason | null;
};

function getEditSaveState({ messageType, oldContent, draft }: Params): SaveState {
  if (messageType === "TEXT") {
    const normalized = normalizeTextDraft(draft);
    if (normalized.length === 0) return { disabled: true, reason: "EMPTY" };
    if (isNoopTextEdit(oldContent, draft)) return { disabled: true, reason: "NOOP" };
    return { disabled: false, reason: null };
  }

  if (messageType === "IMAGE") {
    if (isNoopImageCaptionEdit(oldContent, draft)) return { disabled: true, reason: "NOOP" };
    return { disabled: false, reason: null };
  }

  return { disabled: true, reason: "NOOP" };
}

export { getEditSaveState };
