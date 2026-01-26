# Whiteboard Implementation Plan

## Problem Statement

Video calls need a collaborative whiteboard for brainstorming, explaining concepts, and visual collaboration. Currently no whiteboard exists - need to build canvas, real-time sync, and integrate into call UI.

## Solution

Build collaborative whiteboard using Fabric.js for canvas, Socket.IO for real-time sync, with in-memory server state. Integrate as stage takeover (like screen share) with split view layout.

---

## Architecture Overview

**Sync Strategy** (Operation-based + Snapshot):

- Individual operations (add/update/delete) for real-time feel
- Full snapshot for late joiners
- Server stores state in-memory (relay + state store)
- Per-object versioning with granular LWW for conflicts

**Component Ownership**:

- `WhiteboardProvider`: State management, socket actions
- `useFabric` hook: Fabric.js canvas lifecycle, drawing logic
- `useWhiteboardSync` hook: Socket.IO event handling

---

## Implementation Phases

### Phase 1a: Canvas Foundation [x]

> <NOTE>
> **Consolidated Completion**: This phase is finished. The architecture was implemented using a decoupled approach (Hooks + Orchestration + Strategies) instead of a single bloated hook.
> **AGENT DIRECTIVE**: Prioritize reading the **real source code** over these plan summaries.
> </NOTE>

#### Core Architecture Implemented:

- **Types & Interfaces**: Full type safety for tools, objects, and sync patches.
- **Provider & Context**: State management using optimized `Record` structures for objects and colors.
- **Hook Layering**:
  - `useFabric` (Initialization)
  - `useFabricEvents` (Orchestration)
  - `Strategies` (Tool-specific logic)
- **Serialization Helpers**: Clean conversion between Fabric.js objects and simple JSON-friendly types.

---

### Codebase Reference & Navigation

Use this map to navigate the current implementation. **Always view the content of these files before making changes/move to next phase.**

#### [whiteboard.type.ts](../frontend/src/types/whiteboard.type.ts)

Core types & interfaces.

- `SerializedObject`, `ObjectPatch`, `WhiteboardContextValue`

#### [whiteboard.config.ts](../frontend/src/hooks/whiteboard/utils/whiteboard.config.ts)

Hardcoded constants & config.

- `CANVAS_OPTIONS`, `INITIAL_SHAPE_STATE`, `DEFAULT_STROKE_WIDTH`

#### [whiteboard.utils.ts](../frontend/src/hooks/whiteboard/utils/whiteboard.utils.ts)

Pure helper functions.

- `serializeShape`, `createShapeObject`, `getTransformPatch`

#### [whiteboard.strategies.ts](../frontend/src/hooks/whiteboard/whiteboard.strategies.ts)

Tool-specific business logic.

- `handleShapeMouseMove`, `handleTextMouseDown`, `handleKeyDown`

#### [useFabric.ts](../frontend/src/hooks/whiteboard/useFabric.ts)

Canvas lifecycle & initialization.

- `useFabric`, `canvasCallbackRef`

#### [useFabricEvents.ts](../frontend/src/hooks/whiteboard/useFabricEvents.ts)

Coordination & Listeners.

- `useFabricEvents`, `handlePathCreated`

---

### Phase 1b: Socket Sync Layer

#### Step 8: Create Backend Whiteboard Handler

**File:** `backend/src/api/handlers/whiteboard.handler.js` (new file)

- Create in-memory Map: `whiteboardStates = new Map<callId, WhiteboardState>()`
- `WhiteboardState`: `{ objects: Map, userColors: Map, createdAt, lastActivity }`
- Handle `wb:join`: assign user color, emit `wb:snapshot`
- Handle `wb:add`: store object, broadcast to room (exclude sender)
- Handle `wb:update`: apply patch with version check, broadcast
- Handle `wb:delete`: remove object, broadcast

#### Step 9: Add Cleanup Logic

**File:** `backend/src/api/handlers/whiteboard.handler.js`

- On call end: start 5-minute grace timer
- After grace period: delete whiteboard state
- Add 30-minute hard TTL as safety net
- Use `setInterval` or call-end event to trigger cleanup

#### Step 10: Create useWhiteboardSync Hook

**File:** `frontend/src/hooks/whiteboard/useWhiteboardSync.ts` (new file)

- Listen to `wb:snapshot`, `wb:add`, `wb:update`, `wb:delete` events
- On `wb:snapshot`: call `loadSnapshot()` on canvas
- On `wb:add`: add remote object to canvas
- On `wb:update`: update object props on canvas
- On `wb:delete`: remove object from canvas
- Emit `wb:join` when whiteboard becomes active

#### Step 11: Wire Sync to Provider

**File:** `frontend/src/contexts/whiteboardProvider.tsx`

- Implement real `emitAdd()`: emit `wb:add` via socket
- Implement real `emitUpdate()`: emit `wb:update` with version bump
- Implement real `emitDelete()`: emit `wb:delete`
- Add throttling for updates (50-100ms during drag)

---

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
