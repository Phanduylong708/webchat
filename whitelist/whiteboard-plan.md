# Whiteboard Implementation Plan

<IMPORTANT_OVERVIEW>

## 1. Executive Summary

**Problem:** Video calls need a collaborative whiteboard for brainstorming, explaining concepts, and visual collaboration.

**Solution:** Fabric.js-powered canvas with Socket.IO event-based synchronization using snapshot-first strategy, optimistic UI updates, and version-based LWW conflict resolution.

**Current State:**

- ✅ **Phase 1a (Canvas Foundation):** Complete - Types, Fabric.js lifecycle, tool strategies, serialization
- ✅ **Phase 1b (Socket Sync):** Complete - Provider, sync hooks, server handler, multi-select fix
- ✅ **Phase 1c (UI + Call Integration):** Complete - UI components, call controls toggle, stage takeover
- ✅ **Phase 1d (Presence & Cursors):** Complete - cursor sync + overlay + TTL fade + robust clear (mouse-only)

---

## 2. Architecture Snapshot

### Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND                                   │
│                                                                              │
│  Call UI Integration (Phase 1c)                                               │
│  ┌───────────────────────────────┐                                           │
│  │ CallPage.tsx                  │                                           │
│  │ • wraps WhiteboardProvider    │                                           │
│  │ • staleAckHandlerRef bridge   │◄───────────────────────────────┐          │
│  │ • stage precedence:           │                                onStaleAck  │
│  │   screenshare > whiteboard >  │                                           │
│  │   normal                      │                                           │
│  └───────────────┬───────────────┘                                           │
│                  │                                                           │
│                  │ stage takeover (stageContent)                              │
│                  ▼                                                           │
│  ┌───────────────────────────────┐        ┌──────────────────────────────┐   │
│  │ StageLayout.tsx               │        │ CallControls.tsx              │   │
│  │ • stageContent?: ReactNode    │        │ • whiteboard toggle           │   │
│  │ • renders stage + strip tiles │        │ • disabled during screenshare │   │
│  └───────────────┬───────────────┘        └───────────────┬──────────────┘   │
│                  │                                        │                  │
│                  │ stageContent=<Whiteboard .../>         │ open/close        │
│                  ▼                                        ▼                  │
│  Whiteboard UI Container                                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Whiteboard.tsx                                                          │ │
│  │ • gates isActive -> unmount when inactive                               │ │
│  │ • registers handleStaleAck via registerStaleAckHandler()                │ │
│  │ • composes Toolbar + Canvas + Cursors + Controls                         │ │
│  └───────────────┬────────────────────────────────────────────────────────┘ │
│                  │                                                          │
│                  ▼                                                          │
│  Sync + Canvas Core (Phase 1a/1b)                                           │
│  ┌──────────────────┐   ┌──────────────────────────┐   ┌──────────────────┐ │
│  │ WhiteboardProvider│◄──│ useWhiteboardOrchestration│◄──│ useWhiteboardSync│ │
│  │ (Context State)   │   │ (Bridge Layer)            │   │ (Socket I/O)     │ │
│  │ • objects{}       │   │ • handleStaleAck()        │   │ • requestJoin()  │ │
│  │ • emit/apply      │   │ • requestJoin()           │   │ • buffer ops     │ │
│  └─────────┬────────┘   └──────────────┬───────────┘   └─────────┬────────┘ │
│            │                           │                         │          │
│            ▼                           │                         │          │
│  ┌──────────────────┐                  │                         │          │
│  │ useCanvasSync     │◄────────────────┘                         │          │
│  │ • version gate    │                                            │          │
│  │ • skip grouped    │                                            │          │
│  └─────────┬────────┘                                            │          │
│            ▼                                                     │          │
│  ┌──────────────────┐   ┌─────────────────────┐                 │          │
│  │ useFabric         │──▶│ useFabricEvents     │                 │          │
│  │ • canvasCallbackRef│  │ • routes strategies  │                 │          │
│  └──────────────────┘   └──────────┬──────────┘                 │          │
│                                    ▼                             │          │
│                           ┌─────────────────────┐                │          │
│                           │ whiteboard.strategies│                │          │
│                           └──────────────────────┘                │          │
└───────────────────────────────────────────────────────────────────┼──────────┘
                                                                    │ Socket.IO
                                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                   BACKEND                                    │
│  backend/src/sockets/handlers/whiteboard.handler.js                           │
│  • whiteboardStates: Map<callId, { objects, tombstones, userColors }>         │
│  • wb:join -> socket.join(call_room) -> wb:snapshot                           │
│  • wb:add/update/delete -> validate/version -> broadcast + ACK                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Presence & Cursors (Phase 1d)

- Local cursor: `WhiteboardCanvas.tsx` computes 1:1 canvas coordinates from pointer events and calls `useCursorPresence.emitCursor(...)` which emits `wb:cursor` (throttled).
- Remote cursor: `useWhiteboardSync.ts` listens for `wb:cursor` and (after snapshot + Fabric ready) invokes `onCursorUpdate` → `useCursorPresence.handleRemoteCursor(...)` → `WhiteboardCursors.tsx` renders the overlay and fades stale cursors.
- Cursor events are ephemeral and are dropped until snapshot + Fabric ready (they are not buffered like object ops).

### Component Ownership

| Component / Layer | Responsibility |
| --- | --- |
| `frontend/src/contexts/whiteboardProvider.tsx` | Whiteboard context state: `objects`, `activeTool`, `activeColor`; optimistic local apply; emits ops to server; invokes `onStaleAck` when server rejects/stales an op |
| `frontend/src/hooks/whiteboard/useWhiteboardSync.ts` | Socket sync: `wb:join` → `wb:snapshot`; buffers ops until snapshot + Fabric ready; retries join on snapshot timeout |
| `frontend/src/hooks/whiteboard/useWhiteboardOrchestration.ts` | Bridge: wires sync callbacks to provider `apply*`; exposes `handleStaleAck()` (re-join on `applied:false`) |
| `frontend/src/hooks/whiteboard/useCanvasSync.ts` | Canvas reconciliation: provider `objects` → Fabric canvas; version-gated; skips updates for objects currently grouped/ActiveSelection |
| `frontend/src/hooks/whiteboard/useFabric.ts` | Fabric lifecycle: init/dispose canvas via `canvasCallbackRef`; exposes `isReady`; integrates `useFabricEvents` |
| `frontend/src/hooks/whiteboard/useFabricEvents.ts` + `frontend/src/hooks/whiteboard/whiteboard.strategies.ts` | Event routing + tool strategies: create/update/delete objects, compute patches, serialize |
| `frontend/src/hooks/whiteboard/useCursorPresence.ts` | Cursor presence: stores remote cursors with TTL/fade timestamps; throttled emit + robust clear |
| `frontend/src/components/whiteboard/WhiteboardCursors.tsx` | Cursor overlay: renders remote cursors above the canvas; fades stale cursors |
| `frontend/src/components/whiteboard/*` | UI: `Whiteboard` wiring + toolbar/canvas/controls; `WhiteboardCanvas` emits/clears local cursor |
| `frontend/src/pages/call/CallPage.tsx` | Call integration: wraps call UI with `WhiteboardProvider`; stage takeover decision (screen share > whiteboard > normal) |
| `frontend/src/components/call/StageLayout.tsx` | Stage layout: reusable stage + participant strip; supports `stageContent` for whiteboard takeover |
| `frontend/src/components/call/CallControls.tsx` | Call control bar: whiteboard toggle button; disabled during screen share |
| `backend/src/sockets/handlers/whiteboard.handler.js` | Backend authority: validates versions, maintains per-call state (`objects`, `tombstones`, `userColors`), broadcasts ops to call room |

### Call Integration (Phase 1c)

- **Stage precedence:** `screen share` (presenter detected) > `whiteboard` (local toggle) > normal call layouts.
- **Stage rendering:** `StageLayout` is reused for both screen share and whiteboard via the `stageContent` slot.
- **Screen share wins (no auto-resume):** if screen share starts while whiteboard is active, `CallPage` auto-closes whiteboard so it will not re-open when screen share ends.

---

## 3. Key Decisions & Implementation Notes

### Provider Dependency Injection

- Accepts optional `socket`, `callId`, `canSync` props for testability
- `onStaleAck` callback for parent to intercept version conflicts

### Stale ACK Handling

- Server returns `applied: false` → orchestration calls `requestJoin()` to re-fetch snapshot
- Auto retry with backoff (max 3 retries, 5s timeout)

### Stale ACK Bridge (UI/Call Integration Critical Path)

Because `WhiteboardProvider` lives above the orchestration hook in the call tree, Phase 1c uses a **ref-bridge** pattern:

- `CallPage` keeps `staleAckHandlerRef` and passes `onStaleAck={(ack) => staleAckHandlerRef.current(ack)}` into `WhiteboardProvider`.
- `Whiteboard` registers the orchestration handler via `registerStaleAckHandler(handleStaleAck)`.

If you remove this wiring, stale/not_found updates will not self-heal (clients drift until refresh).

### Snapshot-First, Optimistic UI

- `wb:join` → server sends `wb:snapshot` with full state
- Local edits apply immediately, then emit to server
- Remote events buffered until snapshot received

### Canvas Presentation (Phase 1c)

- **1:1 canvas, center + internal scroll:** no CSS scale / fit-to-view in Phase 1c.
- **Scroll container must be constrained:** the scrollable wrapper needs a bounded height (`h-full w-full overflow-auto`) or scroll will be clipped by call stage wrappers (`overflow-hidden`).
- **Unmount when inactive:** the `Whiteboard` UI returns `null` when not active so Fabric and event listeners are disposed cleanly.

### Presence & Cursors (Phase 1d)

- No username labels; remote cursors only (no local ghost cursor).
- Cursor identity is keyed by `userId` (multi-tab is last-write-wins).
- Emit policy: mouse-only; leading throttle (~75ms); clear on pointer leave + window blur + cancel/lost-capture; avoid repeated null emits when out-of-bounds.
- Receive policy: cursor events are dropped until snapshot + Fabric ready and are not buffered like object operations (`WbPendingEvent` excludes cursor).

### Screen Share Conflict Policy

- **Screen share wins:** the whiteboard toggle is disabled during screen share.
- **Auto-close + no auto-resume:** if screen share starts while whiteboard is active, `CallPage` closes whiteboard; it will not automatically re-open when screen share ends.

### Multi-Select Fix (`getTransformPatch`)

Objects in `ActiveSelection` have relative coords. Fix computes world coords:

```typescript
const center = obj.getCenterPoint();
const totalAngle = obj.getTotalAngle();
const totalScale = obj.getObjectScaling();
// Manual rotation: derive top-left from center
left = center.x + (-halfW * cos + halfH * sin);
top = center.y + (-halfW * sin - halfH * cos);
```

---

## 4. Critical Files Map

| File | Purpose | Key Exports / Notes |
| --- | --- | --- |
| `frontend/src/types/whiteboard.type.ts` | Types | `SerializedObject`, `PartialSerializedObject`, `ObjectPatch`, `ToolType`, `WbAck` |
| `frontend/src/hooks/whiteboard/utils/whiteboard.config.ts` | Constants | `CANVAS_WIDTH`, `CANVAS_HEIGHT`, `CANVAS_OPTIONS` |
| `frontend/src/hooks/whiteboard/utils/whiteboard.utils.ts` | Serialization + transforms | `serialize*`, `deserializeToFabric`, `getTransformPatch` |
| `frontend/src/hooks/whiteboard/whiteboard.strategies.ts` | Tool logic | shape/text/eraser handlers; emits add/update/delete patches |
| `frontend/src/hooks/whiteboard/useFabric.ts` | Fabric lifecycle | `{ canvas, isReady, canvasCallbackRef }` |
| `frontend/src/hooks/whiteboard/useFabricEvents.ts` | Event routing | attaches Fabric listeners based on `activeTool` |
| `frontend/src/hooks/whiteboard/useWhiteboardSync.ts` | Socket sync | join/snapshot/buffer/retry; exposes `requestJoin()` |
| `frontend/src/hooks/whiteboard/useWhiteboardOrchestration.ts` | Bridge | returns `{ requestJoin, handleStaleAck }` |
| `frontend/src/hooks/whiteboard/useCanvasSync.ts` | Reconciliation | applies provider `objects` into Fabric; version-gated |
| `frontend/src/hooks/whiteboard/useCursorPresence.ts` | Cursor presence | `remoteCursors`, `emitCursor`, TTL stale/fade, robust clear |
| `frontend/src/contexts/whiteboardProvider.tsx` | Context provider | `emit*` + `apply*` + `applySnapshot`; accepts `onStaleAck` |
| `frontend/src/hooks/context/useWhiteboard.tsx` | Context hook | throws if used outside provider |
| `frontend/src/components/whiteboard/Whiteboard.tsx` | Container | wires hooks, registers stale-ack handler, composes toolbar/canvas/controls |
| `frontend/src/components/whiteboard/WhiteboardCanvas.tsx` | Canvas UI | mounts `<canvas>` via `canvasCallbackRef`; 1:1 + scroll; emits/clears local cursor |
| `frontend/src/components/whiteboard/WhiteboardToolbar.tsx` | Toolbar UI | tool + color selection (desktop only) |
| `frontend/src/components/whiteboard/WhiteboardControls.tsx` | Controls UI | close button overlay |
| `frontend/src/components/whiteboard/WhiteboardCursors.tsx` | Cursor overlay | renders remote cursors above the canvas; fades stale cursors |
| `frontend/src/pages/call/CallPage.tsx` | Call integration | wraps call with `WhiteboardProvider`, stage takeover, auto-close on screen share |
| `frontend/src/components/call/StageLayout.tsx` | Stage layout | accepts `stageContent` for whiteboard takeover |
| `frontend/src/components/call/CallControls.tsx` | Toggle UI | whiteboard button (desktop) disabled during screen share |
| `frontend/src/pages/dev/WhiteboardTestPage.tsx` | Dev harness | `/dev/whiteboard` + UI mode `?ui=1` |
| `backend/src/sockets/handlers/whiteboard.handler.js` | Backend handler | `wb:join`, `wb:add/update/delete`, snapshot + broadcast |
| `backend/src/sockets/index.js` | Socket registration | registers the whiteboard handler |

---

## 5. Dev Testing Notes

Primary verification happens in the real call flow (`/call/:callId`) since Phase 1c integrates stage takeover.

Dev fallback:

- `/dev/whiteboard?ui=1&callId=<callId>` mounts the Phase 1c UI directly.
- Without `callId`, whiteboard runs in local-only mode.

---

## 6. Known Limitations

| Issue                               | Description                                              |
| ----------------------------------- | -------------------------------------------------------- |
| Skip update when in ActiveSelection | `useCanvasSync` skips remote updates for grouped objects |
| No skew/flip handling               | `getTransformPatch` doesn't handle skewX/Y or flipX/Y    |
| Path geometry immutable             | Path data can't be updated after creation                |
| Cursor presence is mouse-only       | Cursor emit is gated to mouse pointer events             |
| Cursor coordinates are 1:1          | Transform-aware cursor mapping is part of Phase 1e       |
| Cursor events are not buffered      | Dropped until snapshot + Fabric ready (ephemeral)        |

Additional Phase 1c behaviors (by design):

- Whiteboard toolbar is desktop-first (`hidden sm:flex`); mobile UX is intentionally minimal in MVP.
- Whiteboard toggle button is currently implemented in GROUP call controls only; extend to PRIVATE calls if needed.
- Whiteboard toggle is disabled during screen share and will auto-close if screen share starts (no auto-resume).
- No zoom/pan in Phase 1c (roadmap moved to Phase 1e after Presence/Cursors).

Additional Phase 1d behaviors (by design):

- No username labels and no local ghost cursor (remote cursors only).
- Cursor clears on pointer leave / window blur / pointer cancel/lost-capture.

### Next Items (Pending)

- **1e:** Zoom & pan (viewport zoom/pan controls)
- **2a:** Undo/redo (stubs exist in provider)
- **2b:** Polish (disconnect queue, screen share refinements, mobile view-only, limits)
- **2c:** Database persistence (currently in-memory with TTL)

---
</IMPORTANT_OVERVIEW>

## Implementation Phases

Phases below are roadmap items. Phase 1c is documented above in the architecture sections.

### Phase 1e: Zoom & Pan

#### Step 23: Implement Zoom Controls

**File:** `frontend/src/hooks/whiteboard/useFabric.ts`

- Add `zoomIn()`, `zoomOut()`, `resetZoom()` functions
- Zoom centered on canvas center
- Min zoom: 0.1, Max zoom: 5
- Expose via hook return

#### Step 24: Implement Wheel Zoom

**File:** `frontend/src/hooks/whiteboard/useFabric.ts`

- Listen to `mouse:wheel` event
- Zoom centered on cursor position
- Prevent default scroll behavior

#### Step 25: Implement Pan

**File:** `frontend/src/hooks/whiteboard/useFabric.ts`

- Pan mode: when spacebar held OR hand tool selected
- On drag: adjust `viewportTransform`
- Alternative: middle-mouse drag for pan

---

### Phase 2a: Undo/Redo

#### Step 26: Implement Undo Stack

**File:** `frontend/src/hooks/whiteboard/useUndoRedo.ts` (new file)

- Maintain per-user action stack (max 30 items)
- Push action on: add, update, delete
- Store inverse operation for each action
- `undo()`: pop stack, apply inverse, emit operation
- `redo()`: reapply original operation

#### Step 27: Wire Undo to Provider

**File:** `frontend/src/contexts/whiteboardProvider.tsx`

- Expose `undo()`, `redo()`, `canUndo`, `canRedo`
- Wire to keyboard shortcuts: Ctrl+Z, Ctrl+Shift+Z

---

### Phase 2b: Polish

#### Step 33: Add Object Highlight

**File:** `frontend/src/hooks/whiteboard/useFabric.ts`

- Apply local-only selection highlight using current user color
- Preserve existing Fabric selection controls behavior
- Clear highlight reliably on deselect and tool/context changes

#### Step 28: Add Disconnect Queue

**File:** `frontend/src/hooks/whiteboard/useWhiteboardSync.ts`

- Queue operations when socket disconnected
- On reconnect: replay queued operations
- Request fresh snapshot if too many queued

#### Step 29: Handle Screen Share Conflict

**File:** `frontend/src/contexts/whiteboardProvider.tsx`

- Listen to `videoSource` from MediaProvider
- If screen share starts while whiteboard active: auto-pause
- Preserve whiteboard state, resume when screen share stops

#### Step 30: Add Object Limit Warning

**File:** `frontend/src/contexts/whiteboardProvider.tsx`

- Track object count
- Show warning toast when approaching limit (e.g., 500)
- Don't hard-block, just warn about performance

#### Step 31: Mobile View-Only

**File:** `frontend/src/components/whiteboard/WhiteboardCanvas.tsx`

- Detect mobile via media query or user agent
- Disable canvas interactions on mobile
- Hide toolbar (already done via CSS)
- Show "View only" badge

#### Step 32: Add User Color Lifecycle Polish

**File:** `backend/src/sockets/handlers/whiteboard.handler.js`

- Keep `myColor`/`userColors` snapshot behavior stable
- Recycle or cleanup per-call color assignment on effective user leave (multi-tab aware)
- Avoid color leaks during reconnect/disconnect churn

**File:** `frontend/src/contexts/whiteboardProvider.tsx`

- Keep `myColor` + `userColors` in sync with incoming snapshots
- Ensure no stale color artifacts after rejoin flows

---

## Socket Events Summary

| Event         | Direction       | Payload                                    |
| ------------- | --------------- | ------------------------------------------ |
| `wb:join`     | Client → Server | `{ callId }`                               |
| `wb:snapshot` | Server → Client | `{ objects: [], myColor, userColors }`     |
| `wb:add`      | Bidirectional   | `{ callId, object: SerializedObject }`     |
| `wb:update`   | Bidirectional   | `{ callId, objectId, patch: ObjectPatch }` |
| `wb:delete`   | Bidirectional   | `{ callId, objectId, version }`            |
| `wb:cursor`   | Client → Server | `{ callId, position: CursorPosition (or null) }` |
| `wb:cursor`   | Server → Client | `{ callId, userId, position: CursorPosition (or null), color }` |

---

## State Derivation

| Condition          | Derivation                                          |
| ------------------ | --------------------------------------------------- |
| Whiteboard active  | `isActive === true`                                 |
| User is drawing    | `activeTool !== 'select'`                           |
| Can undo           | `undoStack.length > 0`                              |
| Someone is sharing | Check if any participant has `videoSource='screen'` |

---

## Files Summary

**Create (Frontend):**

- `frontend/src/types/whiteboard.type.ts`
- `frontend/src/contexts/whiteboardProvider.tsx`
- `frontend/src/contexts/whiteboardContext.ts`
- `frontend/src/hooks/whiteboard/useFabric.ts`
- `frontend/src/hooks/whiteboard/useWhiteboardSync.ts`
- `frontend/src/hooks/whiteboard/useUndoRedo.ts`
- `frontend/src/lib/whiteboard/serialize.ts`
- `frontend/src/components/whiteboard/Whiteboard.tsx`
- `frontend/src/components/whiteboard/WhiteboardCanvas.tsx`
- `frontend/src/components/whiteboard/WhiteboardToolbar.tsx`
- `frontend/src/components/whiteboard/WhiteboardControls.tsx`
- `frontend/src/components/whiteboard/WhiteboardCursors.tsx`

**Create (Backend):**

- `backend/src/api/handlers/whiteboard.handler.js`

**Modify:**

- `frontend/src/components/call/CallControls.tsx` (add whiteboard button)
- `frontend/src/pages/call/CallPage.tsx` (wrap with provider, integrate layout)
- `backend/src/api/socket.js` (register whiteboard handler)

## Design Decisions

| Decision          | Choice              | Rationale                                             |
| ----------------- | ------------------- | ----------------------------------------------------- |
| Canvas library    | Fabric.js           | Rich features, good docs, not too "plug-and-play"     |
| Sync transport    | Socket.IO           | Already in use, familiar, good enough for MVP         |
| Conflict handling | Granular LWW        | Simple, no CRDT complexity, acceptable for whiteboard |
| Server state      | In-memory Map       | Simple and fast for current phases; persistence is in Phase 2c |
| Canvas size       | Fixed 2560×1440     | Standard HD+, covers most use cases                   |
| Object eraser     | Delete whole object | Simpler than stroke-level erasing                     |
| Undo scope        | Local per-user      | Avoids complexity of global undo                      |
| Mobile support    | View-only           | Touch drawing is out of current scope; mobile enhancements are in Phase 2b |

---

## Estimated Effort

| Phase | Scope              | Steps |
| ----- | ------------------ | ----- |
| 1a    | Canvas foundation  | 1-7   |
| 1b    | Socket sync        | 8-12  |
| 1c    | UI components      | 13-18 |
| 1d    | Cursors & presence | 19-20 |
| 1e    | Zoom & pan         | 23-25 |
| 2a    | Undo/redo          | 26-27 |
| 2b    | Polish             | 28-33 |

**MVP (Phase 1):** Steps 1-25
**Full feature (Phase 2):** Steps 26-33
