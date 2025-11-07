---
title: phase4b-frontend-steps1-5-chat-foundation
type: note
permalink: webchat-phase4b-frontend-steps1-5-chat-foundation
---

# Phase 4B Frontend - Chat Foundation (Steps 1-5)

## Plan Overview

Implemented Steps 1-5 of Phase 4B: Socket Infrastructure, Type Definitions, Chat Context Foundation, UI Skeleton, Basic Message Display, and Send Message functionality. The approach followed feature-first bottom-up development with a split-context architecture to avoid god providers and optimize re-renders. Main deliverable: Working real-time chat foundation where users can select conversations, view message history, and send messages with optimistic UI updates.

Key architectural decision: Separated concerns into ConversationContext (conversation list, selection) and MessageContext (messages, send/receive) to maintain clean boundaries and prevent unnecessary re-renders across the component tree.

## Completed

### Socket Infrastructure (Step 1)

**Files created:**

- `frontend/src/lib/socket.client.ts` - Singleton socket factory with initialization/disconnect functions
- `frontend/src/contexts/socketContext.ts` - Socket context definition only (Vite Fast Refresh compatibility)
- `frontend/src/contexts/socketProvider.tsx` - Socket lifecycle management, event listeners (connect/disconnect/error)
- `frontend/src/hooks/useSocket.tsx` - Consumer hook for accessing socket instance and connection state
- `frontend/src/types/socket.type.ts` - TypeScript definitions for socket context

**Implementation:**

- Singleton pattern ensures one socket instance per app session, preventing multiple connections
- Lifecycle tied to user authentication: connects on login with JWT token, disconnects on logout
- Socket persists across React Strict Mode remounts (critical fix - see Issues #1)
- Initial connection check added to handle race conditions where listeners attach after connection completes
- Auth token passed via socket.auth during initialization for backend authentication

### API Layer & Error Handling (Step 2B.1-2)

**Files created:**

- `frontend/src/api/conversation.api.ts` - REST endpoints for conversations list and details
- `frontend/src/api/message.api.ts` - REST endpoint for message history with cursor-based pagination
- `frontend/src/utils/apiError.util.ts` - Centralized Axios error normalization (replaces repetitive catch blocks)

**Modified files:**

- `frontend/src/types/chat.type.ts` - Promoted shared types (User, ResponseType, ConversationsResponse, Messages, PaginationMeta)

**Implementation:**

- Separate response types for list vs detail endpoints (ConversationsResponse has preview data, ConversationsDetail has full member arrays)
- apiError.util provides consistent error format across all API calls with backend/network/unknown error categorization
- Axios params object handles optional query parameters (before, limit) cleanly without manual string building

### State Management - Conversation Context (Step 2B.3)

**Files created:**

- `frontend/src/contexts/conversationContext.tsx` - Manages conversation list, active selection, loading states
- `frontend/src/hooks/useConversation.tsx` - Consumer hook

**Implementation:**

- Fetches conversation list on mount, caches in local state
- selectConversation(id) updates activeConversationId, triggering message fetch via ChatPage orchestration
- No direct coupling to MessageContext - separation maintained via component-level coordination

### State Management - Message Context (Step 2B.3 + Step 5)

**Files created:**

- `frontend/src/contexts/messageContext.ts` - Message context definition (Vite Fast Refresh split)
- `frontend/src/contexts/messageProvider.tsx` - Message state management and socket operations
- `frontend/src/hooks/useMessage.tsx` - Consumer hook

**Implementation:**

- messagesByConversation stored as Map for O(1) lookups per conversation ID
- Cache guard prevents redundant fetches (important for React Strict Mode double-mount and useEffect loops)
- sendMessage implements optimistic updates: temp message (negative ID) added immediately, replaced with real message on ack callback
- Pure helper functions (addMessageToMap, removeMessageFromMap, replaceMessageInMap) maintain immutability and chronological order
- Socket access via useSocket hook, user data via useAuth for sender information
- useCallback + useMemo for stable references preventing infinite loops

### UI Components - Chat Layout (Steps 3-4)

**Files created:**

- `frontend/src/pages/chat/ChatPage.tsx` - Provider wrapper and orchestration layer (useEffect coordinates conversation selection message fetch)
- `frontend/src/components/chat/ConversationListPanel.tsx` - Left panel displaying conversation list with selection handler
- `frontend/src/components/chat/ConversationItem.tsx` - Individual conversation row (reusable presentational component)
- `frontend/src/components/chat/ChatWindow.tsx` - Right panel container with empty state and active chat display
- `frontend/src/components/chat/MessageList.tsx` - Scrollable message container, fetches from messagesByConversation Map
- `frontend/src/components/chat/MessageItem.tsx` - Individual message bubble with conditional styling (own messages right-aligned primary color, others left-aligned muted)

**Modified files:**

- `frontend/src/main.tsx` - Added /chat route under HomePage children
- `frontend/src/components/layout/SideBar.tsx` - Added Chat navigation link with MessageCircle icon

**Implementation:**

- Two-panel grid layout (300px conversation list | flex-1 chat window)
- ChatPageContent coordinates contexts: watches activeConversationId, calls fetchMessages when changes
- MessageList computes isOwnMessage by comparing senderId with current user ID, passes to MessageItem
- Empty states handled at each level (no conversations, no active selection, no messages)

### Send Message Feature (Step 5)

**Files created:**

- `frontend/src/components/chat/ChatInput.tsx` - Controlled textarea with Enter key submit (Shift+Enter for newline)

**Modified files:**

- `frontend/src/contexts/messageProvider.tsx` - Added sendMessage action with socket emit and ack callback handling

**Implementation:**

- Optimistic UI: temp message appears immediately before server confirmation
- Socket emit with acknowledgment callback: on success replaces temp ID with real message, on error removes temp message
- Validation prevents empty messages (trim whitespace), button disabled during send
- Form onSubmit prevents default behavior, clears input on successful send
- Guard checks socket connected and user authenticated before attempting send

## Issues & Solutions

### 1. Socket Connection Race Condition & Lifecycle Management P CRITICAL

**Issue:**
Multi-faceted problem that caused "Socket is not connected" errors when attempting to send messages immediately after page load, despite backend logs confirming successful connections. The issue manifested in several ways:

- `socket.connected` reported false when sendMessage was called
- React Strict Mode double-mount was destroying and recreating socket instances
- Backend showed connect/disconnect cycles but frontend never registered connected state
- Singleton instance was being reset to null, breaking the singleton pattern
- Event listeners were missing the initial connect event

**Root Causes:**

1. Event listeners attached in second useEffect AFTER socket.connect() already fired in first useEffect (localhost connections are near-instant)
2. SocketProvider cleanup function called disconnectSocket() on every unmount, including Strict Mode development remounts
3. disconnectSocket() set `socketInstance = null`, breaking the singleton pattern and forcing recreation
4. New socket instance created by getSocket() after cleanup, but old socket still had queued events

**Solution (Multi-part fix):**

Part 1 - Initial Connection Check:
Added state sync check in listener useEffect to catch already-connected sockets before attaching listeners. This handles cases where connection completes before listeners are ready.

Part 2 - Remove Aggressive Cleanup:
Removed disconnectSocket() call from SocketProvider useEffect cleanup. Socket now persists across component remounts. Logout still triggers disconnect via the else branch when user becomes null, maintaining security.

Part 3 - Preserve Singleton Instance:
Modified disconnectSocket() to only call `socket.disconnect()` without resetting `socketInstance = null`. This preserves the singleton instance which can be reused for reconnection with new tokens.

**Why This Was Hard to Debug:**

- Socket.IO buffers emits when disconnected, so messages still reached database on page reload (false positive that "it works")
- Backend logs showed successful connections, creating confusion about where the issue originated
- React Strict Mode's double-mount in development obscured the real issue
- Multiple independent problems compounded each other (race condition + cleanup + singleton reset)

**Outcome:**
Socket connects reliably on page load, survives Strict Mode remounts, and send functionality works immediately without waiting for connection events. The fix ensures the singleton pattern works correctly while maintaining proper cleanup on logout.

### 2. Vite Fast Refresh Incompatibility

**Issue:**
Vite HMR (Hot Module Replacement) threw "Could not Fast Refresh" errors when Context and Provider were exported from the same file. This broke the development experience requiring full page reloads on every change.

**Solution:**
Split pattern applied to both SocketContext and MessageContext:

- Context definition in separate .ts file (e.g., socketContext.ts exports only the context)
- Provider component in separate .tsx file (e.g., socketProvider.tsx imports context and exports provider)
- This separation satisfies Vite's Fast Refresh requirement that files exporting components should not export non-component values

**Rationale:**
Vite Fast Refresh requires consistent component exports. Mixing Context (non-component) with Provider (component) confuses the refresh mechanism. The split pattern is a common React + Vite best practice.

### 3. useEffect Infinite Loop in Message Fetching

**Issue:**
ChatPageContent's useEffect had `fetchMessages` in dependency array, but fetchMessages was recreated on every MessageProvider render because it wasn't memoized. This caused infinite fetch loops.

**Solution:**
Wrapped fetchMessages in useCallback with appropriate dependencies, added cache guard to skip fetches if conversation messages already exist in Map. Context value wrapped in useMemo to provide stable object reference to consumers.

**Additional Benefit:**
Cache guard also prevents redundant fetches during React Strict Mode's double-mount in development, improving performance and reducing unnecessary network calls.

### 4. Minor Issues (Grouped)

- Import path corrections when files were split (Context vs Provider)
- Component prop destructuring syntax (function params must destructure object)
- Type mismatches between API response shapes and local type definitions (resolved by logging actual responses and adjusting types)
- Missing onChange handler on ChatInput textarea (input appeared non-functional)
- Form submit preventDefault not called (caused page refreshes)
- Button disabled logic incomplete (missing empty input check)

## Design Decisions

### 1. Split Context Architecture (ConversationContext + MessageContext)

**Decision:** Separate state management into domain-specific contexts rather than a single ChatContext.

**Implementation:**

- ConversationContext manages: conversation list, activeConversationId, loading/error for conversations
- MessageContext manages: messagesByConversation Map, message loading/error, send/fetch operations
- ChatPageContent acts as orchestration layer with useEffect watching activeConversationId and triggering fetchMessages

**Rationale:**
Avoids "god provider" anti-pattern where a single context manages too much state. When messages update, only components consuming MessageContext re-render, not the entire conversation list. Maintains clean separation of concerns - conversations are fetched once on mount, messages are fetched per-conversation on-demand.

**Benefits:**

- Optimized re-renders (isolated subscriptions)
- Easier testing (smaller contexts with focused responsibilities)
- Better scalability (can add typing indicators, online status to respective contexts without bloating a single provider)

### 2. Local-First Type Definitions

**Pattern:** Define types locally in implementation files, promote to shared types file only when multiple files need them.

**Rationale:**
Follows YAGNI (You Aren't Gonna Need It) principle. Avoids premature abstraction and reduces cognitive load. Types start where they're used, get promoted when duplication occurs.

**Example:**
SendMessageAck interface initially defined in messageProvider.tsx as it's only used there. User, Messages, ResponseType promoted to types/chat.type.ts when conversation.api.ts and message.api.ts both needed them.

### 3. Socket Singleton with Persistent Connection

**Pattern:** Single Socket.IO instance across entire app lifecycle, no recreation except on logout/login.

**Implementation:**

- `autoConnect: false` option prevents automatic connection, giving manual lifecycle control
- Module-level variable holds singleton instance
- getSocket() returns existing or creates new, never resets to null
- initializeSocket() sets auth token and calls connect()
- disconnectSocket() only disconnects, preserves instance for potential reconnection

**Rationale:**
Multiple socket instances create connection overhead and complicate state synchronization. Singleton ensures all parts of app use the same connection. Persisting instance across remounts handles React development mode behaviors gracefully.

**Benefits:**

- Reliable connection state (no orphaned instances)
- Survives React Strict Mode double-mount
- Lower memory overhead (one connection, not multiple)
- Simpler debugging (single socket ID in browser DevTools)

### 4. Optimistic UI for Send Message

**Pattern:** Display user's message immediately with temporary ID, replace with real message on server acknowledgment.

**Implementation:**

- Generate negative ID using `-Date.now()` for temp messages (avoids collision with real positive IDs)
- Add temp message to local state immediately (instant UI feedback)
- Socket emit with ack callback: on success, replace temp message with real message from server; on error, remove temp message
- replaceMessageInMap uses Array.map to preserve chronological order (not filter + append which would move message to end)

**Rationale:**
Network latency creates perceived lag if UI waits for server response. Optimistic updates provide instant feedback, improving UX. Ack callback ensures eventual consistency - user sees their message immediately but it's reconciled with server truth.

**Benefits:**

- Responsive UX (no waiting for network round-trip)
- Clear error handling (message disappears if send fails, can be retried)
- Maintains message order (map preserves position, append would break chronology)

### 5. Feature-First, No-Placeholder Approach

**Decision:** Only implement features needed for current step. Comment out or omit code for future steps instead of creating placeholder functions or TODOs scattered in implementation.

**Implementation:**

- MessageContext has loadOlderMessages commented out (Step 8 feature)
- Pagination state commented out (not needed until Step 8)
- No stub implementations that do nothing

**Rationale:**
Placeholders add noise, create false sense of completeness, and risk becoming stale (implementation may differ from placeholder signature). Commenting keeps the roadmap visible without cluttering active code. ESLint won't complain about unused variables.

**Benefits:**

- Cleaner code (only what's actively used)
- Easier to understand current state (no "is this implemented or just a stub?" confusion)
- Flexible future implementation (not locked into placeholder signatures)
- Clear handoff notes (commented sections show what's coming next)

### 6. Cache Guard Pattern for Fetch Operations

**Pattern:** Check if data already exists in state before fetching from API.

**Implementation:**
fetchMessages checks `messagesByConversation.has(conversationId)` and returns early if true, skipping the API call entirely.

**Rationale:**
Prevents redundant fetches caused by useEffect re-runs (dependency changes, Strict Mode, component remounts). Particularly important with useCallback dependencies - even with proper memoization, some re-renders are unavoidable.

**Benefits:**

- Reduced network traffic (no duplicate requests)
- Faster perceived performance (instant data from cache)
- Handles React development quirks (Strict Mode double-mount doesn't cause double fetch)
- Simple implementation (single conditional check)

## Next Steps

### Step 6: Real-Time Updates (newMessage listener)

**Backend already implemented:** Server broadcasts `newMessage` event to all conversation members when a message is sent.

**Frontend implementation needed:**

- Add `socket.on("newMessage", callback)` listener in MessageProvider
- Callback appends message to appropriate conversation in messagesByConversation Map
- Update ConversationListPanel to reflect last message changes

**Verification status:** Two-tab test confirmed receiver does not get updates without page reload. Receiver's DevTools WS Messages tab should show newMessage events arriving (verify backend broadcast works), but UI doesn't update because listener not implemented yet.

### Steps 7-10: Remaining Chat Features

**Step 7:** Typing indicators (typing:start/stop emit, userTyping listener, typingByConversation state)

**Step 8:** Infinite scroll pagination (detect scroll near top, fetch older messages with cursor)

**Step 9:** Group features (create group, add member, leave group socket events)

**Step 10:** Polish & error handling (reconnection UI, retry failed sends, empty states, skeleton loaders)

## Note for AI (ALWAYS COPY-PASTE THIS SECTION TO THE END OF THIS FILE)

1. File name in markdown follows the format "phase{number}-{side}-{step}-{feature}"
2. All sections are necessary
3. For bugs, group minor issues into a single point while major issues should have their own point. Issues that don't affect logic like typos, naming errors, etc. can be completely omitted. These should be in the "Issues" section, not called "bugs"
4. Do not include code snippets - only describe implementation
5. Do not include testing results - only document issues and solutions
6. THIS SECTION IS WRITTEN BY HUMAN, AI MODELS MUST ABSOLUTELY NOT EDIT IT THEMSELVES
