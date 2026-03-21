import { create } from "zustand";

// ---------------------------------------------------------------------------
// Why this store exists
//
// TanStack Query owns the message list (server state). But during a media
// upload, progress updates arrive continuously (0 → 100%) via XHR callbacks.
// Storing that inside the TanStack cache would re-render the entire message
// list on every percent change — wasteful and visually jittery.
//
// This store holds only that narrow slice of transient client state:
// "what is the upload progress for this in-flight optimistic message?"
//
// Nothing here is persisted or synced with the server.
// ---------------------------------------------------------------------------

export interface MessageTransientState {
  // Key: the negative temporary ID assigned to an optimistic message.
  // Value: upload progress as a percentage (0–100).
  uploadProgressByOptimisticId: Map<number, number>;

  setUploadProgress: (optimisticMessageId: number, progressPercent: number) => void;
  clearUploadProgress: (optimisticMessageId: number) => void;
}

export const useMessageStore = create<MessageTransientState>((set) => ({
  uploadProgressByOptimisticId: new Map(),

  setUploadProgress: (optimisticMessageId, progressPercent) =>
    set((currentState) => {
      const updatedProgressMap = new Map(currentState.uploadProgressByOptimisticId);
      updatedProgressMap.set(optimisticMessageId, progressPercent);
      return { uploadProgressByOptimisticId: updatedProgressMap };
    }),

  clearUploadProgress: (optimisticMessageId) =>
    set((currentState) => {
      // Guard: if the ID is not tracked, skip the update entirely.
      // Without this, deleting a non-existent key still returns a new Map,
      // which would cause unnecessary re-renders in Zustand subscribers.
      if (!currentState.uploadProgressByOptimisticId.has(optimisticMessageId)) return {};
      const updatedProgressMap = new Map(currentState.uploadProgressByOptimisticId);
      updatedProgressMap.delete(optimisticMessageId);
      return { uploadProgressByOptimisticId: updatedProgressMap };
    }),
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

// Selects the progress for ONE specific optimistic message.
// Use this in components — it only re-renders when that specific message's
// progress changes, not when any other upload ticks.
export const selectUploadProgressForMessage =
  (optimisticMessageId: number) =>
  (state: MessageTransientState): number | undefined =>
    state.uploadProgressByOptimisticId.get(optimisticMessageId);

// Selects the full Map — useful for bulk reads (e.g. checking all in-flight
// uploads at once). Avoid this in per-message components.
export const selectAllUploadProgress = (state: MessageTransientState) =>
  state.uploadProgressByOptimisticId;

// Action selectors — stable references, won't trigger re-renders
export const selectSetUploadProgress   = (state: MessageTransientState) => state.setUploadProgress;
export const selectClearUploadProgress = (state: MessageTransientState) => state.clearUploadProgress;
