---
title: phase5-fe-step7-buttons
type: note
permalink: webchat-phase5-fe-step7-buttons
---

# Phase 5 Frontend - Step 7: CallControls Component

## Plan Overview

**Refer to user for full details on the plan and additional context**
Implement CallControls component with buttons for video call interactions. This component will be reusable for both 1-on-1 and group calls, with some buttons conditionally shown for group calls only. Implementing controls before layouts allows testing various call flows (leave, participant list, etc.).

## Completed

**Phase 5 Steps 0-6 (Previous Steps)**

Modified files:

- `backend/src/sockets/handlers/call.handler.js` - Added ACK to call:join with conversationType, status, participants. Added call:decline handler. Fixed offline users edge case.
- `backend/src/sockets/helpers/helpers.js` - Added getOnlineUserIds() helper to filter online users
- `frontend/src/types/call.type.ts` - All call-related types including CallJoinAck with conversationType
- `frontend/src/contexts/callProvider.tsx` - Call state management, actions (initiateCall, acceptCall, declineCall, joinCall, leaveCall, endCall, resetCall)
- `frontend/src/hooks/sockets/useCallSockets.ts` - Socket event listeners for call:initiate, call:join, call:leave, call:end
- `frontend/src/components/call/IncomingCallDialog.tsx` - Dialog for incoming calls with accept/decline
- `frontend/src/components/call/CallButton.tsx` - Button in ChatWindow header to initiate calls
- `frontend/src/pages/call/CallPage.tsx` - Container component handling join flow, loading/error/ended states
- `frontend/src/App.tsx` - Added CallProvider and IncomingCallDialog
- `frontend/src/main.tsx` - Added route /call/:callId

Files created:

- All call-related types, hooks, contexts, components, and pages listed above

Implementation:

- Backend returns conversationType in call:join ACK to avoid dependency on useConversation data
- Backend filters callees to only online users to prevent stuck calls when offline users can't respond
- Frontend uses status from backend ACK (single source of truth) instead of deriving from participants.length
- CallPage waits for socket connection before joining call

## Issues & Solutions

**1. Caller Status Stuck at Ringing**

- **Issue:** When callee accepts, caller's status remained "ringing" because useCallSockets only updated participants, not status
- **Solution:** Backend now includes status in call:join event payload. Frontend updates status when receiving call:join with status: "active"

**2. Group Call with Offline Users**

- **Issue:** Call stuck in ringing when all online users declined but offline users were still counted in callees
- **Solution:** Added getOnlineUserIds() helper to filter only online users when building callees Set in call:initiate handler

**3. Dialog Not Auto-Closing for Remaining Callees**

- **Issue:** In group calls, when one person accepts, other callees still see dialog until timeout
- **Solution:** Frontend clears incomingCall when receiving call:join with status: "active"

## Design Decisions

**1. Hangup Button Always Uses leaveCall()**

- Decision: Hangup button calls leaveCall() for both 1-on-1 and group calls
- Rationale: Server handler already has logic to distinguish cases, keeps frontend consistent
- Implementation: Single hangup button, no conditional logic needed

**2. EndCall as Separate Test Button**

- Decision: endCall() is a separate button, primarily for testing
- Rationale: Production may not need explicit "end call for everyone" button
- Implementation: Can be conditionally rendered or marked as test-only

**3. CallControls Before Layouts**

- Decision: Implement CallControls component before creating OneOnOne/Group layouts
- Rationale: Controls are reusable, allows testing call flows independently, layouts can integrate controls later

## Next Steps

**Step 7: Create CallControls Component**

- Create `components/call/CallControls.tsx`
- Buttons: Toggle camera (placeholder), Toggle mic (placeholder), Hangup (leaveCall()), EndCall (endCall(), test-only)
- Group-only features: Participant list (placeholder), Screen share (placeholder), Chat input (placeholder)
- Small video tab for self-view (placeholder)
- Wire into CallPage for testing

**Step 8: Create CallLayouts**

- Create OneOnOneCallLayout.tsx and GroupCallLayout.tsx
- Integrate CallControls into each layout
- Wire layouts into CallPage based on conversationType

## Note for AI (ALWAYS COPY-PASTE THIS SECTION TO THE END OF THIS FILE)

1. File name in markdown follows the format "phase{number}-{side}-{step}-{feature}"
2. All sections are necessary
3. For bugs, group minor issues into a single point while major issues should have their own point. Issues that don't affect logic like typos, naming errors, etc. can be completely omitted. These should be in the "Issues" section, not called "bugs"
4. Do not include code snippets - only describe implementation
5. Do not include testing results - only document issues and solutions
6. THIS SECTION IS WRITTEN BY HUMAN, AI MODELS MUST ABSOLUTELY NOT EDIT IT THEMSELVES

### EVEN MORE IMPORTANT NOTE FOR AI (ALWAYS COPY-PASTE THIS SECTION TO THE END OF THIS FILE)

- DO NOT TREAT THIS FILE AS A PLAN, OR A SINGLE SOURCE OF TRUTH. IT IS HIGH LEVEL SUMMARY OF THE WORK DONE IN A SESSION, INFORMATION CAN BE DIFFERENT OR OUTDATED WITH THE REAL PROJECT. IT IS ADVISED TO ASK USER FOR FULL DETAILS OR READ THE SOURCE CODE LINK MENTIONED IN THE FILE TO GET THE MOST UP TO DATE INFORMATION.
