# Interview Decisions Log

## Scope and Product Direction

1. Q1 - Primary goal
- Decision: Ship image sending now, while laying a scalable foundation for general chat media (video/file later).

2. Q2 - Data model
- Decision: Use a separate `MessageAttachment` table (not embedding attachment data in `Message`).
- Note: Implement as intentional MVP, avoid over-engineering.

3. Q3 - Send flow
- Decision: Use 2-step flow: `REST upload -> Socket send`.
- Reasoning: Upload and realtime message send are different actions with different transport requirements.

## Attachment Lifecycle and Cleanup

4. Q4 - Attachment status model
- Decision: Use simplified status enum:
  - `PENDING` (uploaded, not attached yet)
  - `ATTACHED` (already linked to message)
- Decision: Cleanup stale `PENDING` attachments older than 24h.

5. Q5 - Cleanup trigger
- Decision: Run cleanup once at server startup, with optional manual invocation.

## Message and Contract Design

6. Q6 - Cardinality strategy
- Decision: Design contracts for multiple attachments per message from day one (`attachmentIds[]`), while current UI allows 1 image only.

7. Q7 - Upload timing in UI
- Decision: Upload at send time (defer upload until user clicks Send).
- Tradeoff accepted: simpler MVP implementation and lower workload, at the cost of less smooth upload UX.

8. Q8 - Content rule with media
- Decision: `content` stays optional (`String?` already fits), including for media messages.

9. Q9 - Validation policy (phase 1)
- Decision: image-only upload with `jpeg/png/webp`, max `10MB` per file, max `1` file in current UI.

10. Q10 - AuthZ and integrity checks
- Decision: Strict server validation inside transaction before attaching:
  - attachment exists
  - ownership matches sender
  - status is `PENDING`
  - not already attached
  - valid media type for phase
- Then atomically mark attachment(s) `ATTACHED` and create message.

11. Q11 - Retry policy
- Decision: Manual retry only for MVP (no auto retry).
- Decision: Error state must expose explicit manual retry action.

13. Q13 - Socket event contract
- Decision: Keep single unified event `sendMessage` with payload:
  - `conversationId?`
  - `recipientId?`
  - `content?`
  - `attachmentIds?`
- Validation rule: at least one of `content` or non-empty `attachmentIds`.

14. Q14 - Upload API response shape
- Decision: Return `attachments[]` now (even if current UI uses one item).

15. Q15 - Attachment metadata in DB
- Decision: Store core metadata set:
  - `id`
  - `uploadedByUserId`
  - `status`
  - `url`
  - `mimeType`
  - `sizeBytes`
  - `width?`
  - `height?`
  - `originalFileName?`
  - `createdAt`
  - `updatedAt`
- Decision: `mimeType` is the source of truth for media classification in this phase (no separate `mediaType` enum authority).

16. Q16 - `messageType` source of truth
- Decision: Keep detailed message type enum (`TEXT | IMAGE | VIDEO | FILE`) as source of truth.
- Decision: Server derives concrete type from payload; for this phase (image-only attachments), messages with attachments are stored as `IMAGE`.

17. Q17 - `messageId` DB constraint strategy
- Decision: Use `messageId Int?` with normal index on `messageId`.
- Integrity is enforced in service/transaction layer for MVP.

18. Q18 - Upload endpoint boundary
- Decision: Use independent endpoint `POST /api/media/upload` (not coupled to conversation at upload step).

19. Q19 - Cloud file cleanup strategy
- Decision: Best-effort Cloudinary delete in service; DB remains source of truth.
- If Cloudinary delete fails, log warning and continue DB-side cleanup flow.

20. Q20 - Delete message semantics with attachments
- Decision: Attachment is owned by message in this phase.
- Deleting a message also deletes attachment records + best-effort physical file deletion.

21. Q21 - Optimistic UI behavior for media
- Decision: Follow the same optimistic pattern as current text messages:
  - Insert temp bubble immediately on Send (with local image preview via `URL.createObjectURL`)
  - On server ack success: replace temp bubble with real message
  - On fail: keep temp bubble visible with `failed` state and Retry action (improvement over current text behavior which silently removes)
- Decision: State model uses single `isSending` boolean + `uploadProgress` number (0-100), not separate `uploading`/`sending` states. UI derives visual from progress value:
  - `uploadProgress < 100` → show progress indicator (e.g. overlay percentage or progress bar)
  - `uploadProgress = 100` + `isSending = true` → brief "finalizing" state (socket ack pending, typically < 1s)
  - `isSending = false` → bubble has been reconciled (success) or marked failed
- Note: `URL.createObjectURL` must be revoked after reconciliation to prevent memory leak.

22. Q22 - Send failure after successful upload
- Decision: Keep bubble in `failed` state with `Retry send`.
- Retry send reruns the full flow (upload + send), no attachment ID reuse in this phase.

24. Q24 - Optimized image URL for chat media
- Decision: Apply optimized image URL strategy for chat images (similar principle as avatar), but keep a message-specific transform profile.
- Decision: Store original URL in DB; optimize at render time on frontend.
- Decision: If URL is not Cloudinary-compatible, fallback to original URL (no transform).
- Implementation reference path: `frontend/src/utils/image.util.ts`.

25. Q25 - Attachment storage fields for rendering/cleanup
- Decision: Store both `url` and `publicId`.

27. Q27 - Message payload shape (REST + socket)
- Decision: Embed `attachments[]` directly in message payloads for both message history and realtime events.

28. Q28 - Attachment cap and conversation preview
- Decision: Backend hard cap for `attachmentIds[]` is `1`.
- Note: Current UI remains single-image selection for this phase.
- Decision: When opening multi-attachment phase later, target backend cap is `5`.
- Decision: Conversation list preview uses backend-provided media type key (e.g. `image`, `video`, `file`), not hardcoded display text.
- Decision: Preview precedence is `content` first; only fall back to media type key when content is empty.

## QA and Delivery Notes

1. Automated tests
- Decision: No automated test implementation in this phase.
- Validation approach: manual testing on product after implementation.

2. Time estimate
- Estimated implementation effort: `10-14` working hours (`~1.5-2` days).
- Suggested buffer for integration/migration surprises: `+2-3` hours.

3. LOC estimate
- Estimated net LOC changed: `500-750`.
- Estimated total code churn (add + delete): `800-1200`.
