# Whiteboard Implementation Plan

## 1. Executive Summary

**Problem:** Video calls need a collaborative whiteboard for brainstorming, explaining concepts, and visual collaboration. Currently no whiteboard exists.

**Solution:** Fabric.js-powered canvas with Socket.IO event-based synchronization using snapshot-first strategy, optimistic UI updates, and version-based LWW conflict resolution.

**Current State:**
- ✅ **Phase 1a (Canvas Foundation):** Complete - Types, Fabric.js lifecycle, tool strategies, serialization
- ✅ **Phase 1b (Socket Sync):** Complete - Provider, sync hooks, server handler, multi-select fix
- 🔄 **Phase 1c (UI Components):** Pending - Toolbar, color picker, call layout integration

---

## 2. Architecture Snapshot

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                                                                              │
│  ┌──────────────────┐    ┌─────────────────────┐    ┌──────────────────┐    │
│  │ WhiteboardProvider│◄───│useWhiteboardOrchestration│◄───│ useWhiteboardSync│    │
│  │  (Context State)  │    │    (Bridge Layer)   │    │  (Socket I/O)    │    │
│  │                   │    │                     │    │                  │    │
│  │ • objects{}       │    │ • handleStaleAck()  │    │ • requestJoin()  │    │
│  │ • emit*()/apply*()│    │ • requestJoin()     │    │ • bufferOrDispatch│   │
│  └────────┬──────────┘    └─────────────────────┘    └────────┬─────────┘    │
│           │                                                    │              │
│           ▼                                                    │              │
│  ┌──────────────────┐                                          │              │
│  │   useCanvasSync  │◄── objects Record<ID, SerializedObject>  │              │
│  │ (Reconciliation) │                                          │              │
│  │ • version check  │                                          │              │
│  │ • skip if grouped│                                          │              │
│  └────────┬─────────┘                                          │              │
│           ▼                                                    │              │
│  ┌──────────────────┐    ┌─────────────────────┐               │              │
│  │    useFabric     │───▶│   useFabricEvents   │               │              │
│  │(Canvas Lifecycle)│    │   (Event Router)    │               │              │
│  └──────────────────┘    └──────────┬──────────┘               │              │
│                                     ▼                          │              │
│                          ┌─────────────────────┐               │              │
│                          │whiteboard.strategies│               │              │
│                          │   (Tool Logic)      │               │              │
│                          └──────────────────────┘               │              │
└─────────────────────────────────────────────────────────────────┼──────────────┘
                                                                  │
                                    Socket.IO Events              │
                    ┌─────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                         │
│  whiteboard.handler.js                                                       │
│  • whiteboardStates: Map<callId, {objects, tombstones, userColors}>         │
│  • Events: wb:join → wb:snapshot, wb:add/update/delete → broadcast + ACK   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Ownership

| Component | Responsibility |
|-----------|----------------|
| `WhiteboardProvider` | Context: `objects`, `userColors`, `activeTool`; exposes `emit*()` and `apply*()` |
| `useWhiteboardSync` | Socket listeners, join/snapshot flow, pending buffer, reconnect |
| `useWhiteboardOrchestration` | Bridges provider ↔ sync; exposes `handleStaleAck()` |
| `useCanvasSync` | Reconciles `objects` → Fabric canvas; version-gated, skips grouped |
| `useFabric` | Canvas lifecycle (init/dispose), `canvasCallbackRef`, `isReady` |
| `useFabricEvents` | Event router: tool modes, mouse/keyboard listeners → strategies |
| `whiteboard.strategies` | Tool logic: shape drag, text editing, eraser, multi-select patch |
| `whiteboard.handler.js` | Server state, version validation, tombstones, broadcast |

---

## 3. Key Decisions & Implementation Notes

### Provider Dependency Injection
- Accepts optional `socket`, `callId`, `canSync` props for testability
- `onStaleAck` callback for parent to intercept version conflicts

### Stale ACK Handling
- Server returns `applied: false` → orchestration calls `requestJoin()` to re-fetch snapshot
- Auto retry with backoff (max 3 retries, 5s timeout)

### Snapshot-First, Optimistic UI
- `wb:join` → server sends `wb:snapshot` with full state
- Local edits apply immediately, then emit to server
- Remote events buffered until snapshot received

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

| File | Purpose | Key Exports |
|------|---------|-------------|
| `whiteboard.type.ts` | TypeScript types | `SerializedObject`, `ObjectPatch`, `ToolType`, `WbAck` |
| `whiteboard.config.ts` | Constants | `CANVAS_WIDTH/HEIGHT`, `DEFAULT_STROKE_WIDTH`, `CANVAS_OPTIONS` |
| `whiteboard.utils.ts` | Serialization | `serializePath/Shape/Textbox`, `deserializeToFabric`, `getTransformPatch` |
| `whiteboard.strategies.ts` | Tool logic | `handleShape*`, `handleText*`, `handleEraserClick`, `handleObjectModified` |
| `useFabric.ts` | Canvas lifecycle | `useFabric()` → `{canvas, isReady, canvasCallbackRef}` |
| `useFabricEvents.ts` | Event routing | `useFabricEvents()` - attaches listeners per tool |
| `useWhiteboardSync.ts` | Socket sync | `useWhiteboardSync()` → `{requestJoin}` |
| `useWhiteboardOrchestration.ts` | Bridge | `useWhiteboardOrchestration()` → `{handleStaleAck}` |
| `useCanvasSync.ts` | Reconciliation | `useCanvasSync(canvas, objects, isReady)` |
| `whiteboardProvider.tsx` | Context | `emit*`, `apply*`, `applySnapshot` |
| `whiteboard.handler.js` | Server | `handleWhiteboard()`, `whiteboardStates` |

---

## 5. Dev Testing Notes

### Using `/dev/whiteboard`
1. Start backend with socket server
2. Create/join a call to get valid `callId`
3. Navigate to: `/dev/whiteboard?callId=<your-call-id>`
4. Verify: "Sync: Enabled" and "Canvas: ✓ Ready"

### Requirements
- Active socket connection (must be call participant)
- Without `callId`: local-only mode (no sync)

### Tool Hotkeys
| Key | Tool |
|-----|------|
| S | Select |
| P | Pen |
| R | Rectangle |
| E | Ellipse |
| L | Line |
| T | Text |
| X | Eraser |
| Del | Delete selected |

---

## 6. Known Limitations

| Issue | Description |
|-------|-------------|
| Skip update when in ActiveSelection | `useCanvasSync` skips remote updates for grouped objects |
| No skew/flip handling | `getTransformPatch` doesn't handle skewX/Y or flipX/Y |
| Path geometry immutable | Path data can't be updated after creation |

### Phase 2 Items (Pending)
- **2a:** Remote cursors with user colors
- **2b:** Undo/redo (stubs exist in provider)
- **2c:** Zoom/pan controls
- **2d:** Database persistence (currently in-memory with TTL)

---

## Implementation Phases

### Phase 1c: UI Components

#### Step 13: Create WhiteboardCanvas Component

**File:** `frontend/src/components/whiteboard/WhiteboardCanvas.tsx` (new file)

- Render `<canvas>` element with ref
- Get canvasCallbackRef from the hook and mount it
- use canvas
- Apply container styles (centered, overflow hidden)
- Show loading state while canvas initializes

#### Step 14: Create WhiteboardToolbar Component

**File:** `frontend/src/components/whiteboard/WhiteboardToolbar.tsx` (new file)

- Vertical toolbar on left side
- Tool buttons: Select, Pen, Rect, Ellipse, Line, Text, Eraser
- Color palette (8 preset colors)
- Active tool/color highlighted
- Hidden on mobile (`hidden sm:flex`)

#### Step 15: Create WhiteboardControls Component

**File:** `frontend/src/components/whiteboard/WhiteboardControls.tsx` (new file)

- Zoom buttons: +, -, Reset (fit to view)
- Close button (X icon)
- Position: top-right corner overlay
- Wire close button to `closeWhiteboard()`

#### Step 16: Create Whiteboard Container

**File:** `frontend/src/components/whiteboard/Whiteboard.tsx` (new file)

- Compose: `WhiteboardToolbar` + `WhiteboardCanvas` + `WhiteboardControls`
- Layout: toolbar left, canvas center, controls overlay
- Only render when `isActive === true`

#### Step 17: Add Whiteboard Button to CallControls

**File:** `frontend/src/components/call/CallControls.tsx`

- Add whiteboard button (PenTool or similar icon)
- Click → toggle `openWhiteboard()` / `closeWhiteboard()`
- Highlight when whiteboard is active
- Hidden on mobile (`hidden sm:inline-flex`)

#### Step 18: Integrate Whiteboard into Call Layout

**File:** `frontend/src/pages/call/CallPage.tsx` (or layout component)

- Wrap with `WhiteboardProvider`
- When `isActive`: show Whiteboard as main stage
- Reuse StageLayout: whiteboard = stage content, videos in strip
- Similar to screen share stage takeover

---

### Phase 1d: Zoom & Pan

#### Step 19: Implement Zoom Controls

**File:** `frontend/src/hooks/whiteboard/useFabric.ts`

- Add `zoomIn()`, `zoomOut()`, `resetZoom()` functions
- Zoom centered on canvas center
- Min zoom: 0.1, Max zoom: 5
- Expose via hook return

#### Step 20: Implement Wheel Zoom

**File:** `frontend/src/hooks/whiteboard/useFabric.ts`

- Listen to `mouse:wheel` event
- Zoom centered on cursor position
- Prevent default scroll behavior

#### Step 21: Implement Pan

**File:** `frontend/src/hooks/whiteboard/useFabric.ts`

- Pan mode: when spacebar held OR hand tool selected
- On drag: adjust `viewportTransform`
- Alternative: middle-mouse drag for pan

---

### Phase 2a: Presence & Cursors

#### Step 22: Add Cursor Sync

**File:** `frontend/src/hooks/whiteboard/useWhiteboardSync.ts`

- Emit `wb:cursor` on mouse move (throttled 50-75ms)
- Listen for remote `wb:cursor` events
- Maintain `remoteCursors` state: `Map<odId, CursorPosition>`

#### Step 23: Create WhiteboardCursors Component

**File:** `frontend/src/components/whiteboard/WhiteboardCursors.tsx` (new file)

- Overlay positioned above canvas
- Render colored arrow + name for each remote cursor
- Transform cursor position based on current zoom/pan
- Fade out cursor if no update for 3 seconds

#### Step 24: Add User Colors

**File:** `backend/src/api/handlers/whiteboard.handler.js`

- Assign unique color from palette on `wb:join`
- Include `myColor` in `wb:snapshot` response
- Track used colors per call, recycle when user leaves

**File:** `frontend/src/contexts/whiteboardProvider.tsx`

- Store `myColor` from snapshot
- Store `userColors` map for cursor rendering

#### Step 25: Add Object Highlight

**File:** `frontend/src/hooks/whiteboard/useFabric.ts`

- When selecting object: add colored border matching `myColor`
- Client-side only visual feedback
- Clear highlight on deselect

---

### Phase 2b: Undo/Redo

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

### Phase 2c: Polish

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

---

## Socket Events Summary

| Event         | Direction       | Payload                                    |
| ------------- | --------------- | ------------------------------------------ |
| `wb:join`     | Client → Server | `{ callId }`                               |
| `wb:snapshot` | Server → Client | `{ objects: [], myColor, userColors }`     |
| `wb:add`      | Bidirectional   | `{ callId, object: SerializedObject }`     |
| `wb:update`   | Bidirectional   | `{ callId, objectId, patch: ObjectPatch }` |
| `wb:delete`   | Bidirectional   | `{ callId, objectId }`                     |
| `wb:cursor`   | Bidirectional   | `{ callId, position: CursorPosition }`     |
| `wb:leave`    | Client → Server | `{ callId }`                               |

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
| Server state      | In-memory Map       | Simple, fast; defer persistence to post-MVP           |
| Canvas size       | Fixed 2560×1440     | Standard HD+, covers most use cases                   |
| Object eraser     | Delete whole object | Simpler than stroke-level erasing                     |
| Undo scope        | Local per-user      | Avoids complexity of global undo                      |
| Mobile support    | View-only           | Touch drawing complex; defer to post-MVP              |

---

## Estimated Effort

| Phase | Scope              | Steps |
| ----- | ------------------ | ----- |
| 1a    | Canvas foundation  | 1-7   |
| 1b    | Socket sync        | 8-12  |
| 1c    | UI components      | 13-18 |
| 1d    | Zoom & pan         | 19-21 |
| 2a    | Cursors & presence | 22-25 |
| 2b    | Undo/redo          | 26-27 |
| 2c    | Polish             | 28-31 |

**MVP (Phase 1):** Steps 1-21
**Full feature (Phase 2):** Steps 22-31
