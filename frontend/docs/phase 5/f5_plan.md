# Phase 5: Video Call UI Implementation

## Overview

Implement video call UI with signaling flow. Focus on UI/UX first, WebRTC/MediaStream rendering will be handled later.

### Key Design Decisions

| Decision             | Choice                     | Rationale                                                         |
| -------------------- | -------------------------- | ----------------------------------------------------------------- |
| Call page vs overlay | **Page** (`/call/:callId`) | Like Google Meet, separate from chat                              |
| Tab behavior         | **New tab**                | Caller opens new tab immediately, callee opens after accept       |
| Incoming call UI     | **Dialog overlay**         | Simple modal on chat tab with accept/reject                       |
| Countdown timer      | **No**                     | Auto-close when server emits `call:end`                           |
| Pass conversationId  | **From ACK**               | Server returns in `call:join` ACK, URL only needs `/call/:callId` |
| Socket client        | **Shared singleton**       | Each tab creates own connection, server handles multi-tab         |
| UI language          | **English**                | Consistency with codebase                                         |
| Reload behavior      | **Redirect on fail**       | Emit `call:join`, redirect to `/` if ACK fails                    |
| Participants in ACK  | **Full user objects**      | CallPage needs username/avatar without extra API calls            |
| Decline handling     | **No per-user decline evt**| Callee decline only affects server-side all-declined check        |

---

## Backend Changes Required

### Modify `call:join` handler

Add ACK response with call context (snapshot users from socket):

```javascript
socket.on("call:join", async (payload = {}, callback) => {
  // ... existing validation and logic ...

  // Track user snapshots when they join
  // session.participants: Map<userId, userObject>
  session.participants.set(userId, socket.data.user);

  const participants = Array.from(session.participants.values());

  return maybeAck(callback, {
    success: true,
    conversationId: session.conversationId,
    isInitiator: userId === session.initiatorId,
    participants: participants, // [{ id, username, avatar }, ...]
  });
});
```

---

## Files to Create

| Category    | File                                     | Description                                                   |
| ----------- | ---------------------------------------- | ------------------------------------------------------------- |
| Types       | `types/call.type.ts`                     | Call state, participant, socket event payload types           |
| Socket Hook | `hooks/sockets/useCallSockets.ts`        | Handle `call:initiate`, `call:join`, `call:leave`, `call:end` |
| Context     | `contexts/callContext.ts`                | Call context type definition                                  |
| Context     | `contexts/callProvider.tsx`              | Call state management and actions                             |
| Component   | `components/call/CallButton.tsx`         | Call button for ChatWindow header                             |
| Component   | `components/call/IncomingCallDialog.tsx` | Dialog showing caller info with accept/reject buttons         |
| Component   | `components/call/CallControls.tsx`       | Mute, camera toggle, hangup buttons                           |
| Page        | `pages/call/CallPage.tsx`                | Full-screen call page with ringing/active states              |

## Files to Modify

| File                                          | Changes                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `backend/.../call.handler.js`                 | Add ACK to `call:join` with conversationId, isInitiator, participants  |
| `frontend/src/App.tsx`                        | Add `CallProvider`, route `/call/:callId`, render `IncomingCallDialog` |
| `frontend/src/components/chat/ChatWindow.tsx` | Add `CallButton` to header                                             |
| `backend/.../call.handler.js`                 | Add `call:decline` event (callee emits; server ends only if all declined) |

## Files to Review (Later - WebRTC Phase)

| File                                  | Purpose                                 |
| ------------------------------------- | --------------------------------------- |
| `lib/videocall/webrtcManager.ts`      | WebRTC peer connection management       |
| `lib/videocall/mediaStreamManager.ts` | Camera/Mic access and stream management |

---

## Implementation Steps

### Step 0: Update Backend `call:join`

Modify `backend/src/sockets/handlers/call.handler.js`:

- Add callback parameter to `call:join` handler
- Return ACK with `{ success, conversationId, isInitiator, participants }`
- Handle error cases with `{ success: false, error: "..." }`
- Update tests for new ACK behavior
- Track participants as `Map<userId, userObject>` using `socket.data.user` snapshot; build ACK from this map.
- Add `call:decline` handler: callee emits; server only ends immediately if all callees have declined (reason `all_declined`), otherwise waits for others/timeout.

### Step 1: Create Types

Create `types/call.type.ts` with:

- `CallStatus`: `'idle' | 'ringing' | 'connecting' | 'active' | 'ended'`
- `CallParticipant`: `{ id, username, avatar }`
- `IncomingCall`: incoming call payload from server
- `CallJoinAck`: ACK response type
- `CallState`: current call state
- `CallContextValue`: context value with state + actions

### Step 2: Create Socket Hook

Create `hooks/sockets/useCallSockets.ts`:

- Follow pattern from `useConversationSockets.ts`
- Listen for: `call:initiate`, `call:join`, `call:leave`, `call:end`
- Update call state via setters

### Step 3: Create Call Context & Provider

Create `contexts/callContext.ts` + `contexts/callProvider.tsx`:

- Manage call state (status, callId, conversationId, participants, incomingCall)
- Integrate `useCallSockets` hook
- Expose actions:
  - `initiateCall(conversationId)` - emit `call:initiate`, open new tab `/call/:callId`
  - `acceptCall()` - open new tab `/call/:callId`, close dialog
  - `declineCall()` - emit `call:decline` (server may end with `all_declined` if applicable), close dialog
  - `joinCall(callId)` - emit `call:join` with ACK, update state from response
  - `leaveCall()` - emit `call:leave`
  - `endCall()` - emit `call:end`

### Step 4: Create IncomingCallDialog

Create `components/call/IncomingCallDialog.tsx`:

- Use `AlertDialog` component from `components/ui/alert-dialog.tsx`
- Display caller avatar, username, "is calling..."
- "Decline" and "Accept" buttons
- Controlled by `incomingCall` state from context

### Step 5: Create CallButton

Create `components/call/CallButton.tsx`:

- Video call icon button
- On click: call `initiateCall(conversationId)`

### Step 6: Create CallControls

Create `components/call/CallControls.tsx`:

- Toggle camera button (placeholder state)
- Toggle mic button (placeholder state)
- Add participant button (placeholder)
- Hangup button - calls `leaveCall()` or `endCall()`

### Step 7: Create CallPage

Create `pages/call/CallPage.tsx`:

- Route: `/call/:callId`
- On mount:
  1. Extract `callId` from URL params
  2. Call `joinCall(callId)`
  3. If ACK fails → redirect to `/`
  4. If ACK success → update state with conversationId, isInitiator, participants
- UI States:
  - **Connecting**: Show spinner while waiting for ACK
  - **Ringing** (isInitiator): Show callee avatar + "Calling..."
  - **Active**: Show video grid placeholder + participants
  - **Ended**: Show "Call ended" message, auto-close or redirect
- Include `CallControls` at bottom

### Step 8: Wire Everything

- Update `App.tsx`:
  - Wrap with `CallProvider` inside `SocketProvider`
  - Add route `/call/:callId` → `CallPage`
  - Render `IncomingCallDialog` globally (outside routes, inside providers)
- Update `ChatWindow.tsx`:
  - Add `CallButton` to header

---

## UI Flow

### Caller Flow

```
1. User clicks CallButton in ChatWindow (Chat Tab)
2. initiateCall(conversationId) called
3. Socket emits call:initiate → receives ACK with callId
4. window.open('/call/:callId') opens new tab
5. CallPage mounts → emits call:join → receives ACK
6. CallPage shows "Calling..." with callee info (from conversation)
7. When call:join event received (callee joined) → update participants
8. When call:end received → show "Call ended", close tab
```

### Callee Flow

```
1. Socket receives call:initiate event (Chat Tab)
2. IncomingCallDialog appears showing caller info
3. User clicks "Accept"
4. acceptCall() → window.open('/call/:callId') opens new tab
5. Dialog closes
6. CallPage mounts → emits call:join → receives ACK
7. CallPage shows active call with participants
8. When call:end received → show "Call ended", close tab
```

### Reload Flow

```
1. User refreshes CallPage
2. CallPage mounts → emits call:join with callId from URL
3. If ACK success → restore state (conversationId, isInitiator, participants)
4. If ACK fails (call ended/not found) → redirect to /
```

---

## ACK Response Structures

### `call:initiate` ACK (existing)

```typescript
{ success: true, callId: string }
{ success: false, error: string }
```

### `call:join` ACK (new)

```typescript
{
  success: true,
  conversationId: number,
  isInitiator: boolean,
  participants: Array<{ id: number, username: string, avatar: string | null }>
}
{ success: false, error: string }
```

---

## UI Messages

| State/Event                                    | Message                    |
| ---------------------------------------------- | -------------------------- |
| Ringing (caller)                               | "Calling..."               |
| Incoming call                                  | "{username} is calling..." |
| Accept button                                  | "Accept"                   |
| Decline button                                 | "Decline"                  |
| Call ended (reason: ended)                     | "Call ended"               |
| Call ended (reason: timeout)                   | "No answer"                |
| Call ended (reason: all_declined)              | "Everyone declined the call"|
| Call ended (reason: insufficient_participants) | "Call ended"               |

---

## Component Structure

```
frontend/src/
├── types/
│   └── call.type.ts
├── hooks/
│   └── sockets/
│       └── useCallSockets.ts
├── contexts/
│   ├── callContext.ts
│   └── callProvider.tsx
├── components/
│   └── call/
│       ├── CallButton.tsx
│       ├── IncomingCallDialog.tsx
│       └── CallControls.tsx
├── pages/
│   └── call/
│       └── CallPage.tsx
└── App.tsx (modified)

backend/src/
└── sockets/
    └── handlers/
        └── call.handler.js (modified)
```
