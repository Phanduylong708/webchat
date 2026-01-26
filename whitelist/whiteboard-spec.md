# Whiteboard Feature Specification

## Overview

Collaborative whiteboard for video calls, allowing participants to draw, add shapes, and text together in real-time.

---

## Scope

### In Scope (MVP)

- 1:1 and group calls
- Desktop browsers: full editing
- Mobile browsers: view-only
- Real-time sync via Socket.IO
- Tools: freehand pen, shapes (rectangle, ellipse, line), text, eraser, selection
- Color picker (preset palette)
- Zoom/pan navigation
- Local undo/redo (per-user)

### Out of Scope (Post-MVP)

- Image upload/paste
- Export to PNG/PDF
- Templates (pre-made boards)
- Laser pointer mode
- Arrow shape
- Stroke width control
- Font selection
- Persistence after call ends

---

## UI/UX Specification

### Layout

- **Stage takeover**: Whiteboard replaces main stage (like screen share)
- **Split view**: Reuse existing StageLayout - whiteboard = main stage, video strip on side
- **Toolbar**: Left sidebar (vertical)
- **Controls**: Zoom buttons, close button in corner

### Components

| Component            | Responsibility                            |
| -------------------- | ----------------------------------------- |
| `WhiteboardCanvas`   | Renders Fabric.js canvas, handles drawing |
| `WhiteboardToolbar`  | Tool selection UI (left sidebar)          |
| `WhiteboardCursors`  | Renders remote cursors overlay            |
| `WhiteboardControls` | Zoom buttons (+/-/reset), close button    |

### Zoom/Pan Interactions

| Interaction                  | Behavior               |
| ---------------------------- | ---------------------- |
| Mouse wheel                  | Zoom in/out            |
| Pinch (touch)                | Zoom in/out            |
| Drag (hand tool or modifier) | Pan canvas             |
| Zoom buttons                 | +/- zoom, reset to fit |

### Open/Close

| Action           | Trigger                                             |
| ---------------- | --------------------------------------------------- |
| Open whiteboard  | Dedicated button in CallControls                    |
| Close whiteboard | Anyone can close; content preserved until call ends |

### Mobile

- **View-only**: Can see whiteboard but cannot draw
- WhiteboardToolbar hidden on mobile

---

## Drawing Tools

### Tool List (MVP)

| Tool             | Description                           |
| ---------------- | ------------------------------------- |
| **Freehand Pen** | Draw paths with mouse/touch           |
| **Rectangle**    | Click to place, drag to resize        |
| **Ellipse**      | Click to place, drag to resize        |
| **Line**         | Click to place, drag to resize        |
| **Text**         | Click to create, inline editing       |
| **Eraser**       | Click object to delete (whole object) |
| **Selection**    | Select, move, resize, rotate objects  |

### Shape Creation

- **Click + resize** with drag-threshold enhancement
- If user drags > threshold immediately after click → treat as "place + resize" (single codepath)

### Text Tool

- **Inline editing**: Click to create, double-click to edit existing
- **Commit on exit**: Text saved when clicking outside or pressing Escape/Enter
- **Soft-lock**: Client-side visual hint while editing (no server tracking)
- **No font choice**: Single font for MVP

### Color Picker

- **Preset palette only** (8-12 colors)
- Applies to stroke and fill

### Eraser

- **Object eraser**: Click to delete whole object
- **Delete/Backspace key**: Deletes selected object(s)

### Undo/Redo

- **Local undo**: Per-user stack, cap 30 actions
- **Stroke = 1 item**: Each freehand stroke is one undo item
- **Undo = emit new operation**: Undo generates delete/add operation, synced to others

---

<IMPORTANT>

## Architecture

### System Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  WhiteboardUI   │────▶│WhiteboardProvider│────▶│  useFabric hook │
│  (Components)   │     │  (State/Actions) │     │(Lifecycle/Init) │
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
                                 │                        │
                                 ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │ useWhiteboardSync│     │useFabricEvents  │
                        │   (Socket.IO)    │     │(Coordination)   │
                        └────────┬─────────┘     └────────┬────────┘
                                 │                        │
                                 ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │   Server Handler │     │   Strategies    │
                        │ (Relay + State)  │     │ (Tool Logic)    │
                        └──────────────────┘     └─────────────────┘
```

### Tech Stack

| Layer            | Technology                         |
| ---------------- | ---------------------------------- |
| Canvas           | Fabric.js                          |
| State management | React Context (WhiteboardProvider) |
| Real-time sync   | Socket.IO (existing namespace)     |
| Server storage   | In-memory Map (keyed by callId)    |

### Canvas

- **Size**: Fixed 2560×1440
- **Navigation**: Zoom + pan to explore

---

## Real-time Sync Specification

### Sync Model

- **Hybrid**: Operations for real-time + snapshot for late joiners
- **Server role**: Relay + state store (not authoritative)

### Socket Events

All events use `wb:` prefix in existing call namespace.

| Event         | Direction       | Description                                   |
| ------------- | --------------- | --------------------------------------------- |
| `wb:join`     | Client → Server | User joins whiteboard, requests current state |
| `wb:snapshot` | Server → Client | Full canvas state for late joiner             |
| `wb:add`      | Bidirectional   | New object added                              |
| `wb:update`   | Bidirectional   | Object properties changed (PATCH)             |
| `wb:delete`   | Bidirectional   | Object removed                                |
| `wb:cursor`   | Bidirectional   | Cursor position update (throttled)            |

### Fabric.js Events Mapping

| Logic Trigger (Manual/Event)      | Fabric Event      | Socket Event | Notes                                    |
| --------------------------------- | ----------------- | ------------ | ---------------------------------------- |
| **manual** (onMouseUp)            | n/a               | `wb:add`     | Triggered after shape creation completes |
| **manual** (onEditingExit)        | n/a               | `wb:add`     | Triggered after text entry completes     |
| **event** (path:created)          | `path:created`    | `wb:add`     | Triggered after pen stroke finishes      |
| **event** (object:modified)       | `object:modified` | `wb:update`  | Final state after move/scale/rotate      |
| **manual** (onDelete)             | n/a               | `wb:delete`  | Triggered on eraser click or key press   |
| **event** (object:moving/scaling) | `object:moving`   | `wb:update`  | Throttled updates during drag (Future)   |

### Operation Batching

- **Hybrid batching**: Immediate for add/delete, throttled for updates
- Update throttle: 50-100ms during drag/transform

### Object Identification

- **Client UUID**: Client generates unique ID for each object
- **Per-object version**: Each object has own version counter for LWW

### Conflict Resolution

- **Granular LWW (Last Write Wins) with PATCH**
- Allowlisted properties only
- Server maintains per-object version
- Higher version wins on conflict

### Property Allowlist

| Category  | Properties                                             |
| --------- | ------------------------------------------------------ |
| Transform | `left`, `top`, `angle`                                 |
| Size      | `width`, `height`, `scaleX`, `scaleY`                  |
| Style     | `fill`, `stroke`, `strokeWidth`, `opacity`             |
| Content   | `text` (for text objects)                              |
| Immutable | `path` (for freehand - never updated, only add/delete) |

### Object Serialization

- **Filtered toObject()**: Strict per-type include list
- Not full Fabric toObject() output

```typescript
// Example: Rectangle include list
const rectProps = [
  "type",
  "left",
  "top",
  "width",
  "height",
  "fill",
  "stroke",
  "angle",
  "scaleX",
  "scaleY",
  "id",
  "version",
];
```

### Late Joiner Flow

1. User joins call with active whiteboard
2. Client emits `wb:join`
3. Server automatically sends `wb:snapshot` with full canvas state
4. Client hydrates Fabric canvas from snapshot

---

## Cursor & Presence (Phase 2)

### Remote Cursors

- **Style**: Colored arrow with user name label
- **Throttle**: 50-75ms
- **Separate stream**: Cursor updates separate from object operations

### User Colors

- **Server assigns**: Unique color per user on join
- **Rejoin**: Gets any available color (not necessarily same)
- **Used for**: Cursor color, object highlight border

### Object Highlight

- When user is editing an object, show colored border matching their assigned color
- **Client-side only**: Visual hint, no server tracking

---

## Server Specification

### State Storage

- **In-memory Map**: Keyed by `callId`
- **Structure**:

```typescript
interface WhiteboardState {
  objects: Map<string, WhiteboardObject>; // objectId → object data
  userColors: Map<number, string>; // userId → assigned color
  createdAt: number;
  lastActivity: number;
}
```

### Cleanup

| Trigger              | Action                      |
| -------------------- | --------------------------- |
| Call ends            | Start 5-minute grace period |
| Grace period expires | Delete whiteboard state     |
| Hard TTL (30 min)    | Safety net deletion         |

### Handler Events

```typescript
// Client → Server
socket.on('wb:join', (callId) => { ... });
socket.on('wb:add', (callId, object) => { ... });
socket.on('wb:update', (callId, objectId, patch, version) => { ... });
socket.on('wb:delete', (callId, objectId) => { ... });
socket.on('wb:cursor', (callId, position) => { ... });

// Server → Client (broadcast to room)
socket.to(callId).emit('wb:add', object);
socket.to(callId).emit('wb:update', objectId, patch, version);
socket.to(callId).emit('wb:delete', objectId);
socket.to(callId).emit('wb:cursor', userId, position);
```

---

## Edge Cases

### Disconnect Handling

- **Queue + replay**: Local changes queued while disconnected
- On reconnect: replay queued operations to server

### Screen Share Conflict

- **Screen share > Whiteboard**
- If screen share starts while whiteboard active: auto-pause whiteboard, preserve content
- When screen share stops: can resume whiteboard

### User Leaves

- **Objects stay**: User's objects remain on canvas
- **Cursor disappears**: Immediately removed

### Object Limit

- **Soft limit + warning**: Show warning when approaching limit (e.g., 500 objects)
- Don't hard-block, just warn about performance

### Permissions

- **Any participant** can open whiteboard
- **All can edit** simultaneously (no presenter mode for MVP)
- **Exclusive feature**: Like screen share - one active at a time per call

---

## Frontend Implementation

### Provider (WhiteboardProvider)

```typescript
interface WhiteboardContextValue {
  // State
  isActive: boolean;
  isConnected: boolean;
  objects: Record<ObjectID, SerializedObject>;
  userColors: Record<UserID, string>;
  myColor: string | null;

  // Tool state
  activeTool: ToolType;
  activeColor: string;

  // Actions
  openWhiteboard: () => void;
  closeWhiteboard: () => void;
  setActiveTool: (tool: ToolType) => void;
  setActiveColor: (color: string) => void;

  // Sync actions
  emitAdd: (object: SerializedObject) => void;
  emitUpdate: (objectId: ObjectID, patch: ObjectPatch) => void;
  emitDelete: (objectId: ObjectID) => void;

  // Undo (Phase 2)
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}
```

### Fabric Hook (useFabric)

```typescript
// Initialization & Canvas Lifecycle
interface UseFabricReturn {
  canvas: React.RefObject<fabric.Canvas | null>;
  isReady: boolean;
  canvasCallbackRef: (element: HTMLCanvasElement | null) => void;
}
```

### Event Coordination (useFabricEvents)

Hook that orchestrates user interactions by registering Fabric.js event listeners and delegating to tool-specific strategies.

- **Responsibilities**: Manages brush settings, mouse events, and keyboard shortcuts.
- **Workflow**: `useEffect` hooks react to `activeTool` changes to configure canvas state (drawing mode, selection mode).

### Tool Logic (Strategies)

Decoupled logic for each drawing tool to keep hooks clean.

- **Shape Strategy**: Handles `mouseDown`, `mouseMove`, `mouseUp` for Rect, Ellipse, and Line with drag-threshold.
- **Text Strategy**: Manages textbox creation, editing state, and auto-deletion of empty textboxes.
- **Eraser Strategy**: Handles object removal on click.
- **Keyboard Strategy**: Handles deletion via Delete/Backspace keys.

### Sync Hook (useWhiteboardSync)

```typescript
interface UseWhiteboardSyncParams {
  callId: string;
  isActive: boolean;
  onSnapshot: (objects: SerializedObject[]) => void;
  onRemoteAdd: (object: SerializedObject) => void;
  onRemoteUpdate: (objectId: string, patch: ObjectPatch) => void;
  onRemoteDelete: (objectId: string) => void;
  onCursorUpdate: (userId: number, position: CursorPosition) => void;
  onUserColor: (color: string) => void;
}
```

---

## Implementation Phases

### Phase 1: Core MVP

1. **WhiteboardProvider** - context setup, state management
2. **useFabric hook** - Fabric.js lifecycle, drawing tools
3. **WhiteboardCanvas component** - render canvas
4. **WhiteboardToolbar component** - tool selection
5. **Socket handler (backend)** - wb: events, in-memory state
6. **useWhiteboardSync hook** - Socket.IO integration
7. **UI integration** - CallControls button, StageLayout integration
8. **Late joiner snapshot** - server sends state on join

### Phase 2: Polish

1. **WhiteboardCursors component** - remote cursor rendering
2. **Cursor sync** - throttled position updates
3. **User colors** - server assignment, visual indicators
4. **Object highlight** - show who's editing
5. **Undo/redo** - local stack implementation
6. **Zoom/pan controls** - WhiteboardControls component
7. **Mobile view-only** - hide toolbar, disable interactions

---

## Data Structures

### SerializedObject

```typescript
interface SerializedObject {
  id: ObjectID; // Client-generated UUID string
  type: WhiteboardObjectType;
  version: number; // Per-object version for LWW
  createdBy: UserID; // number

  // Transform
  left: number;
  top: number;
  angle: number;

  // Size
  width?: number;
  height?: number;
  scaleX: number;
  scaleY: number;

  // Style
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;

  // Type-specific
  text?: string; // For textbox
  path?: PathData; // (string | number)[][]
}
```

### ObjectPatch

```typescript
interface ObjectPatch {
  version?: number;
  left?: number;
  top?: number;
  angle?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  text?: string;
}
```

### CursorPosition

```typescript
interface CursorPosition {
  x: number;
  y: number;
  tool?: ToolType; // Optional: show what tool user is using
}
```

</IMPORTANT>

---

## Summary

| Aspect              | Decision                                       |
| ------------------- | ---------------------------------------------- |
| UI layout           | Stage takeover, split view with video strip    |
| Toolbar             | Left sidebar                                   |
| Canvas size         | Fixed 2560×1440 with zoom/pan                  |
| Drawing tools       | Pen, rect, ellipse, line, text, eraser, select |
| Colors              | Preset palette (8 colors)                      |
| Sync model          | Operations + snapshot (hybrid)                 |
| Conflict resolution | Granular LWW with per-object version           |
| Server storage      | In-memory, 5min grace + 30min TTL              |
| Socket events       | wb: prefix, same namespace                     |
| Mobile              | View-only                                      |
| Undo                | Local per-user stack (cap 30)                  |
| Cursors             | Phase 2, colored arrows, throttled 50-75ms     |
