# ConversationProvider Refactor Plan

## Current State
- Single file (`frontend/src/contexts/conversationProvider.tsx`) ~320 lines.
- Manages REST actions, socket listeners, helper logic, UI-specific state.
- Six socket listeners (newMessage, friendOnline/offline, typing, memberAdded, addedToConversation, memberLeft).
- Tight coupling makes maintenance difficult.

## Goal
- Keep `ConversationProvider` focused on state + exposing context.
- Move socket subscriptions into a dedicated hook `useConversationSockets` under `frontend/src/hooks/`.
- Extract helper utilities (typing map/system message) to `frontend/src/utils/conversation.utils.ts`.

## Proposed Structure
```
frontend/src/hooks/
  useSocket.tsx (unchanged)
  useConversationSockets.ts (new)
frontend/src/utils/
  conversation.utils.ts (new helper file)
frontend/src/contexts/
  conversationProvider.tsx (simplified)
```

## Hook Responsibilities
`useConversationSockets({ socket, setConversations, setOnlineUsers, setTypingByConversation, setSystemMessages })`
- Internally register/unregister handlers for:
  - newMessage
  - friendOnline/friendOffline
  - userTyping
  - memberAdded
  - addedToConversation
  - memberLeft
- Each handler extracted into helper functions for readability.

## Provider Changes
- Import `useConversationSockets` and call it after state declarations (pass setters).
- Remove duplicated helper functions (e.g., `updateTypingMap`) into utils.
- Provider file only handles REST actions + state, not direct socket wiring.

## Benefits
- Clear separation of concerns.
- Easier to track socket logic in one location.
- Simplified provider (<200 lines), improved maintainability.
