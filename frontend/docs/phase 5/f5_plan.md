# Phase 5: Video Call UI Implementation

## Overview

Implement video call UI with signaling flow. Focus on UI/UX first, WebRTC/MediaStream rendering will be handled later.

### Key Design Decisions

| Decision             | Choice                      | Rationale                                                         |
| -------------------- | --------------------------- | ----------------------------------------------------------------- |
| Call page vs overlay | **Page** (`/call/:callId`)  | Like Google Meet, separate from chat                              |
| Tab behavior         | **New tab**                 | Caller opens new tab immediately, callee opens after accept       |
| Incoming call UI     | **Dialog overlay**          | Simple modal on chat tab with accept/reject                       |
| Countdown timer      | **No**                      | Auto-close when server emits `call:end`                           |
| Pass conversationId  | **From ACK**                | Server returns in `call:join` ACK, URL only needs `/call/:callId` |
| Socket client        | **Shared singleton**        | Each tab creates own connection, server handles multi-tab         |
| UI language          | **English**                 | Consistency with codebase                                         |
| Reload behavior      | **Redirect on fail**        | Emit `call:join`, redirect to `/` if ACK fails                    |
| Participants in ACK  | **Full user objects**       | CallPage needs username/avatar without extra API calls            |
| Conversation type    | **From ACK**                | Backend returns `conversationType` in `call:join` ACK             |
| Decline handling     | **No per-user decline evt** | Callee decline only affects server-side all-declined check        |

---

## Backend Changes Required

### Modify `call:join` handler (Completed)

- ACK response with call context (snapshot users from socket), participants as user objects (id/username/avatar).
- Track participants as `Map<userId, { user, socketIds: Set }>` for multi-tab.
- Add `call:decline` handler: callee emits; server only ends immediately if all callees have declined (reason `all_declined`); no per-user decline event.
- Add `conversationType` into session and return it in `call:join` ACK.

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

| File                                          | Changes                                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `backend/.../call.handler.js`                 | ACK `call:join` with conversationId, conversationType, isInitiator, participants; call:decline ends only if all declined |
| `frontend/src/App.tsx`                        | Add `CallProvider`, render `IncomingCallDialog` globally                                                                 |
| `frontend/src/components/chat/ChatWindow.tsx` | Add `CallButton` to header                                                                                               |

## Files to Review (Later - WebRTC Phase)

| File                                  | Purpose                                 |
| ------------------------------------- | --------------------------------------- |
| `lib/videocall/webrtcManager.ts`      | WebRTC peer connection management       |
| `lib/videocall/mediaStreamManager.ts` | Camera/Mic access and stream management |

---

## Implementation Steps

### Step 0: Update Backend `call:join` (Completed)

Modify `backend/src/sockets/handlers/call.handler.js`:

- Add callback parameter to `call:join` handler
- Return ACK with `{ success, conversationId, conversationType, isInitiator, participants }`
- Handle error cases with `{ success: false, error: "..." }`
- Track participants as `Map<userId, { user, socketIds }>` using `socket.data.user` snapshot; build ACK from this map.
- Add `call:decline` handler: callee emits; server only ends immediately if all callees have declined (reason `all_declined`), otherwise waits for others/timeout; no per-user decline event.

### Step 1: Create Types (Completed)

Create `types/call.type.ts` with:

- `CallStatus`: `'ringing' | 'connecting' | 'active' | 'ended'`
- `CallParticipant`: `{ id, username, avatar }`
- `IncomingCall`: incoming call payload from server
- `CallJoinAck`: ACK response type
- `CallState`: current call state
- `CallContextValue`: context value with state + actions

### Step 2: Create Socket Hook (Completed)

Create `hooks/sockets/useCallSockets.ts`:

- Follow pattern from `useConversationSockets.ts`
- Listen for: `call:initiate`, `call:join`, `call:leave`, `call:end`
- Update call state via setters

### Step 3: Create Call Context & Provider (Completed)

Create `contexts/callContext.ts` + `contexts/callProvider.tsx`:

- Manage call state (status, callId, conversationId, participants, incomingCall)
- Integrate `useCallSockets` hook
- Expose actions:
  - `initiateCall(conversationId)` - emit `call:initiate`, open new tab `/call/:callId` (for caller)
  - `acceptCall()` - open new tab `/call/:callId`, close dialog (for callee)
  - `declineCall()` - emit `call:decline` then reset local state (need dedicated rejoin feature), close dialog
  - `joinCall(callId)` - emit `call:join` with ACK (includes `conversationType`), set status `connecting` → `ringing/active` based on participants. Can join as long as user know the callId (no guard).
  - `leaveCall()` - emit `call:leave`, set status/endReason `ended/leave`, keep metadata for UI (use case: meta data for quick rejoin bubble like google meet)
  - `endCall()` - initiator-only guard, emit `call:end`, set status/endReason `ended` (use case: cancel while ringing, panic button to end call for everyone)
  - `resetCall()` - clear metadata, set status `ended`

### Step 4: Create IncomingCallDialog (Completed)

Create `components/call/IncomingCallDialog.tsx`:

- Use `AlertDialog` component from `components/ui/alert-dialog.tsx`
- Display caller avatar, username, "is calling..."
- "Decline" and "Accept" buttons
- Controlled by `incomingCall` state from context

### Step 5: Create CallButton (Completed)

Create `components/call/CallButton.tsx`:

- Video call icon button
- On click: call `initiateCall(conversationId)`

### Step 6: Create CallPage Container (Completed)

Decision: Container wrapper for OneOnOne/Group layout.
Create `pages/call/CallPage.tsx`:

- Route: `/call/:callId`
- On mount:
  1. Extract `callId` from URL params
  2. Wait for socket connection
  3. Call `joinCall(callId)`
  4. If ACK fails → redirect to `/`
  5. If ACK success → set conversationType from ACK (layout TBD) and stop loading
- UI States:
  - **Connecting**: Show spinner while waiting for ACK
  - **Ringing/Active**: Placeholder text for now; DM/Group layout dispatch pending
  - **Ended**: Show "Call ended" message, auto-close or redirect
- Update `App.tsx`:
  - Wrap with `CallProvider` inside `SocketProvider`
  - Render `IncomingCallDialog` globally (outside routes, inside providers)

### Step 7: Create CallControls (Completed)

Create `components/call/CallControls.tsx`:

- Toggle camera button (on/off) (placeholder state)
- Toggle mic button (mute/unmute) (placeholder state)
- Hangup button - calls `leaveCall()`
- Add participant list (group only) (placeholder state)
- Small video tab to see user's video (placeholder state)
- Screen share button (group only) (placeholder state)
- Chat input (group only) (placeholder state)

### Step 8: Create CallLayout (OneOnOne/Group)

-Layout component for OneOnOne/Group call (also wire for testing).

### Step 9: Webrtc implementation (WebRTC phase)

`frontend/src/lib/videocall/mediaStreamManager.ts` c
`frontend/src/lib/videocall/webrtcManager.ts`

- Create WebRTC layer (provider/hook CallPage)
- CreateMediaStream layer (provider/hook CallPage)

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

| State/Event                                    | Message                      |
| ---------------------------------------------- | ---------------------------- |
| Ringing (caller)                               | "Calling..."                 |
| Incoming call                                  | "{username} is calling..."   |
| Accept button                                  | "Accept"                     |
| Decline button                                 | "Decline"                    |
| Call ended (reason: ended)                     | "Call ended"                 |
| Call ended (reason: timeout)                   | "No answer"                  |
| Call ended (reason: all_declined)              | "Everyone declined the call" |
| Call ended (reason: insufficient_participants) | "Call ended"                 |

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
