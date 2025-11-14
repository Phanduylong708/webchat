---
title: phase4b-frontend-steps6-8-realtime-typing-pagination
type: note
permalink: webchat-phase4b-frontend-steps6-8-realtime-typing-pagination
---

# Phase 4B Frontend - Real-time Features (Steps 6-8)

## Plan Overview

Implemented Steps 6-8 of Phase 4B: Real-time Updates, Typing Indicators, and Infinite Scroll Pagination. The approach focused on integrating Socket.IO event listeners for real-time features while maintaining separation of concerns across contexts. Main deliverables: Bi-directional real-time messaging, live online status tracking, typing awareness, and cursor-based message history loading with silent UX.

Key architectural decisions: Preserved split-context architecture by distributing Socket.IO listeners across appropriate providers (MessageProvider for messages, ConversationProvider for metadata/status/typing). Used library-based pagination with silent loading to avoid UI flicker. Implemented per-conversation loading state with Set data structure to prevent race conditions.

## Completed

### Real-Time Message Updates (Step 6.1)

**Modified files:**
- `frontend/src/contexts/messageProvider.tsx` - Added newMessage listener in useEffect

**Implementation:**
- Socket listener attached in MessageProvider useEffect with socket dependency
- Handler receives full message payload from backend with all fields (id, conversationId, content, sender, createdAt)
- Reuses existing addMessageToMap pure helper to maintain immutability
- Backend already excludes sender from broadcast, so no duplicate message issue for sender
- Guard clause checks socket exists before attaching listener
- Cleanup function removes listener on unmount or socket change

### Conversation List Updates (Step 6.2)

**Modified files:**
- `frontend/src/contexts/conversationProvider.tsx` - Added newMessage listener for lastMessage updates

**Implementation:**
- Separate newMessage listener in ConversationProvider handles conversation metadata updates
- Transforms message payload to lastMessage structure (id, content, createdAt, sender)
- Updates matching conversation's lastMessage field via immutable map
- Sorts conversations by lastMessage createdAt descending (newest first) using localeCompare
- Guard returns early if conversation not found in list (edge case for lazy-created 1-1 chats)
- Split listener approach maintains clean separation: MessageProvider handles message list, ConversationProvider handles conversation metadata

### Online Status Tracking (Step 6.3)

**Modified files:**
- `frontend/src/contexts/conversationProvider.tsx` - Added onlineUsers state and friendOnline/friendOffline listeners
- `frontend/src/types/chat.type.ts` - Added onlineUsers to ConversationContextValue
- `frontend/src/components/chat/ConversationItem.tsx` - Added online status display logic
- `frontend/src/components/chat/ChatWindow.tsx` - Added online status in header

**Implementation:**
- State structure: Set<number> storing user IDs of online friends
- Immutable Set updates: clone Set, add/delete userId, return new Set
- friendOnline event adds userId to Set
- friendOffline event removes userId from Set
- ConversationItem checks onlineUsers.has(otherUser.id) only for PRIVATE type conversations
- ChatWindow header displays online status for active private conversation
- Backend emits events on connection/disconnection with multi-tab support

**Known limitation (deferred to Step 10):**
- Initial snapshot missing: tab opened after friends already online won't see online status until those friends reconnect
- Backend only emits events on state change, no initial online users list provided
- Requires either REST endpoint for initial snapshot or backend emit initial state after connect
- Does not block core functionality, acceptable for demo scale

### Typing Indicators (Step 7)

**Files created:**
- `frontend/src/components/chat/TypingIndicator.tsx` - Displays typing status text

**Modified files:**
- `frontend/src/contexts/conversationProvider.tsx` - Added typingByConversation state, userTyping listener, updateTypingMap helper
- `frontend/src/components/chat/ChatInput.tsx` - Added typing event emissions with debounce logic
- `frontend/src/components/chat/MessageList.tsx` - Integrated TypingIndicator component
- `frontend/src/types/chat.type.ts` - Added typingByConversation to ConversationContextValue

**Implementation:**

**State structure refactor:**
- Initial approach used Map<conversationId, Set<userId>> but lacked username for display
- Refactored to Map<conversationId, Map<userId, username>> to store both ID and username
- Backend userTyping payload already includes username field, eliminating need to fetch from conversation members
- updateTypingMap pure helper handles immutable nested Map updates (clone outer Map, clone inner Map, set/delete, return)

**Listener logic:**
- userTyping event payload: userId, username, conversationId, isTyping boolean
- isTyping true: add userId->username to inner Map
- isTyping false: delete userId from inner Map
- Empty inner Maps remain in outer Map (acceptable, no memory concern at demo scale)

**Emit logic in ChatInput:**
- useRef stores typingTimeoutRef and isCurrentlyTypingRef flag
- onChange handler: clear existing timeout, emit typing:start if not already typing, set 2.5s timeout to emit typing:stop
- Only emit typing:start once per typing session, subsequent keystrokes reset timeout
- Submit and blur handlers emit typing:stop and clear timeout
- Pattern prevents spam emits while maintaining responsive indicator

**Display logic:**
- TypingIndicator receives conversationId prop
- Extracts usernames from typingByConversation Map using Array.from(map.values())
- Conditional rendering: 1 user shows "Username is typing...", multiple users show "User1, User2 are typing..."
- No need to filter current user - backend excludes sender in broadcast (same pattern as newMessage)
- Positioned in MessageList below messages, styled with small italic muted text

### Infinite Scroll Pagination (Step 8)

**Library installed:**
- react-infinite-scroll-component - handles scroll detection and trigger logic

**Modified files:**
- `frontend/src/contexts/messageProvider.tsx` - Added pagination state, loadOlderMessages action
- `frontend/src/components/chat/MessageList.tsx` - Wrapped messages with InfiniteScroll component
- `frontend/src/types/chat.type.ts` - Added pagination and loadingOlderByConversation to MessageState
- `frontend/src/api/message.api.ts` - Updated to pass limit parameter (10 messages for testing)

**Implementation:**

**Pagination state:**
- Structure: Map<conversationId, {nextCursor: number | null, hasMore: boolean}>
- Updated in both fetchMessages (initial load) and loadOlderMessages (pagination) with meta from API response
- Cursor-based pagination using message ID as cursor (backend design)

**loadOlderMessages action:**
- useCallback wrapped with loadingOlderByConversation dependency
- Guard checks: currentMessages exists, currentMessages not empty, hasMore true, nextCursor exists, not already loading
- Fetch with cursor: getMessages(conversationId, paginationInfo.nextCursor, 10)
- Prepend messages: [...data.messages, ...existing] to maintain chronological order (older messages first)
- Update both messagesByConversation and pagination state
- Try-catch-finally pattern with setLoadingOlderByConversation in finally block

**Loading state refactor:**
- Initial approach used boolean loadingMessages for both initial fetch and pagination
- Bug: boolean global state caused all conversations to block when one was loading
- Refactored to Set<number> storing conversationIds currently loading older messages
- Guard checks Set.has(conversationId), set start adds conversationId to Set, finally removes conversationId from Set
- Prevents race conditions and cross-conversation interference

**InfiniteScroll integration:**
- Outer div with id="scrollableDiv" and flex-col-reverse for chat behavior
- InfiniteScroll props: dataLength (messages.length), next (loadOlderMessages callback), hasMore (from pagination info), inverse (true for bottom-up scroll)
- loader prop set to null for silent loading (avoids UI flicker discussed below)
- scrollableTarget="scrollableDiv" links to scrollable container

**Silent loading approach:**
- Initial implementation showed loader spinner when loading older messages
- UX issues: loader caused flicker on fast networks, blocked view of messages during load on slow networks
- Switched to silent loading: no visible loader, messages append smoothly in background
- Pattern matches production apps like Telegram/WhatsApp
- Only initial fetch shows loading skeleton, pagination is invisible to user

## Issues & Solutions

### 1. Initial Online Status Snapshot Missing

**Issue:**
Tab opened after friends already online does not show online status until those friends disconnect and reconnect. Backend only emits friendOnline/friendOffline events on state changes, no initial snapshot provided on connection.

**Solution:**
Deferred to Step 10 Polish. Does not block core functionality. Potential solutions documented:
- Add REST endpoint GET /api/users/online-friends to fetch on mount
- Backend emit initialOnlineUsers event after connect with array of currently online friend IDs
- Add isOnline field to REST conversations response (requires backend schema change)

**Impact:**
Acceptable for graduation project scope. Users can refresh page as workaround. Real-time updates work correctly after initial connection.

### 2. Typing State Structure Redesign

**Issue:**
Initial design used Map<conversationId, Set<userId>> which stored only user IDs. TypingIndicator component needed usernames to display "Username is typing..." but had no way to resolve IDs to usernames without fetching conversation details or maintaining separate lookup.

**Solution:**
Redesigned state to Map<conversationId, Map<userId, username>>. Backend userTyping payload already includes username field alongside userId, eliminating need for additional data fetching. Updated updateTypingMap helper to work with nested Map structure instead of Set.

**Benefits:**
- No additional API calls needed
- Simpler component logic in TypingIndicator
- Direct access to displayable data
- Maintains immutability with pure helper function

### 3. Pagination Loader UI Flicker

**Issue:**
InfiniteScroll library's loader prop caused poor UX in two scenarios:
- Fast networks: Loader appeared and disappeared rapidly causing flicker effect
- Slow networks: Loader completely blocked view of existing messages during load
- Loader showed on initial conversation open even before user scrolled (library aggressive trigger)

**Solution:**
Set loader prop to null to disable library-provided loading UI. Implemented silent background loading pattern matching production chat apps. Added guard in loadOlderMessages to prevent loading if currentMessages empty (prevents initial trigger).

**Result:**
Clean UX with no visible loading indicators for pagination. Messages appear smoothly as user scrolls up. Initial conversation load still shows loading skeleton via loadingMessages state.

### 4. Concurrent Loading Race Condition

**Issue:**
Initial implementation used boolean loadingMessages state for pagination. When user scrolled up in conversation A, setting loadingMessages to true would block pagination in all other conversations. Additionally, rapid scroll events in single conversation could trigger multiple concurrent API calls before state updated.

**Root cause:**
Global boolean insufficient to track per-conversation loading state in multi-conversation context.

**Solution:**
Refactored to Set<number> storing conversationIds currently loading. Guard checks Set.has(conversationId), prevents both cross-conversation blocking and same-conversation concurrent fetches. Immutable Set updates with clone-modify-return pattern.

**Why Set over Map:**
Set simpler for boolean presence check. Map<conversationId, boolean> would be redundant - presence in Set implies true, absence implies false.

### 5. Shared Scroll Position Across Conversations

**Issue:**
MessageList uses single scrollable div with fixed id. When switching conversations, scroll position persists causing:
- Scroll position from conversation A carries to conversation B
- If A scrolled to top, B opens at top and triggers loadOlderMessages immediately
- Input draft also persists (user typing in A, switch to B, draft still visible)

**Root cause:**
ChatWindow/MessageList components reuse without unmounting when activeConversationId changes. DOM state (scroll, input value) persists across re-renders.

**Solution:**
Deferred to Step 10 Polish. Documented fix: add key={activeConversationId} prop to ChatWindow in ChatPage to force remount on conversation switch.

**Trade-offs:**
- Fix pros: Clean state per conversation, no cross-contamination, simple one-line solution
- Fix cons: Unmount/remount overhead, lost input drafts, lost scroll position if user switches and returns
- Acceptable for demo scale (not production concern)

**Why deferred:**
Debugging and validating edge cases potentially time-consuming. Core functionality works. User can refresh as workaround. Feature complexity (preserving drafts, scroll positions) exceeds graduation project scope.

## Design Decisions

### 1. Split Socket Listeners Across Contexts

**Decision:** Distribute Socket.IO event listeners across appropriate contexts rather than centralizing in SocketProvider.

**Implementation:**
- MessageProvider listens to newMessage for message list updates
- ConversationProvider listens to newMessage for lastMessage metadata, friendOnline/friendOffline for status, userTyping for typing indicators
- SocketProvider only handles connection lifecycle events (connect, disconnect, connect_error)

**Rationale:**
Follows single responsibility principle. Each provider manages state updates for its domain. Prevents SocketProvider from becoming god object. Listeners co-located with state they update improves maintainability.

**Benefits:**
- Clear ownership of event handling
- Easy to trace which context updates on which events
- Avoids prop drilling or complex state lifting
- Scales better as features added (each context manages its socket events)

### 2. Backend-Provided Usernames in Socket Events

**Decision:** Rely on backend including username in userTyping event payload rather than maintaining frontend lookup tables or fetching user details.

**Pattern:**
Backend emits: `{ userId, username, conversationId, isTyping }`
Frontend stores: `Map<conversationId, Map<userId, username>>`

**Rationale:**
Backend has authoritative user data and already includes sender info in message payloads. Consistent pattern across all socket events. Eliminates frontend data fetching complexity and cache invalidation concerns.

**Alternative considered:**
Store only userIds, fetch usernames from conversation members array. Rejected because ConversationsResponse does not include full members list (only preview), would require additional REST call for conversation details.

### 3. Silent Pagination Loading

**Decision:** No visible loader during pagination scroll, messages appear seamlessly in background.

**Implementation:**
InfiniteScroll loader prop set to null. No spinner, no loading text. User scrolls up and older messages prepend without visual feedback of loading state.

**Rationale:**
Production chat apps (Telegram, WhatsApp, Discord) use silent loading. Visible loaders cause:
- Flicker on fast networks reducing perceived performance
- Block content view on slow networks creating frustration
- Distract from reading flow

**User expectation:**
Users scrolling up expect to see older messages. Loading indicator implies wait state, contradicts expectation of smooth continuous scrolling. Silent approach feels more responsive even if actual load time identical.

### 4. Per-Conversation Loading State with Set

**Decision:** Use Set<number> to track which conversations are currently loading older messages, replacing global boolean.

**Pattern:**
State as Set storing conversationIds currently loading. Guard checks Set presence. Start loading adds to Set. Finish loading removes from Set. Immutable updates with clone-modify-return.

**Rationale:**
Prevents two critical bugs:
1. Cross-conversation blocking: Conversation A loading blocks conversation B pagination
2. Same-conversation race: Rapid scroll triggers multiple concurrent fetches before state updates

Set provides O(1) presence check and clear semantics (in set = loading, not in set = idle).

**Why not Map<number, boolean>:**
Redundant. Presence in Set already represents true, absence represents false. Map would require explicit true/false values and additional memory overhead.

**Immutability pattern:**
Clone Set with `new Set(prev)`, mutate clone, return clone. Ensures React detects state change and triggers re-renders.

### 5. Cursor-Based Pagination with Message ID

**Pattern:** Backend uses message ID as cursor for pagination (before parameter). Frontend stores nextCursor from API response metadata.

**Implementation:**
- Initial fetch: `getMessages(conversationId, undefined, 10)` returns newest 10 messages
- Response meta: `{ nextCursor: 45, hasMore: true }` where 45 is oldest message ID from batch
- Next fetch: `getMessages(conversationId, 45, 10)` returns 10 messages before ID 45
- Continue until `hasMore: false`

**Benefits over offset pagination:**
- Stable cursor (message IDs don't change)
- No duplicate/missing messages if new messages arrive during pagination
- Efficient database queries (indexed ID comparison)
- Handles deletions gracefully

**Alternative considered:**
Timestamp-based cursor. Rejected because messages can have identical timestamps (same-second sends), causing ambiguity and potential duplicates.

### 6. Deferred Fixes Documentation

**Decision:** Explicitly document known issues with solutions and trade-offs rather than fixing everything immediately.

**Items deferred to Step 10:**
- Initial online status snapshot (requires backend change or additional REST endpoint)
- Shared scroll/input state (fix with key prop, trade-off is lost drafts)

**Rationale:**
Graduation project scope prioritizes core functionality over edge case polish. Time investment in debugging and testing edge cases may exceed value for demo purposes. Documenting solutions demonstrates understanding even if not implemented.

**Benefits:**
- Faster progress through main features
- Clear handoff notes for Step 10
- Demonstrates architectural thinking (knowing trade-offs)
- Avoids perfectionism blocking advancement

**Pattern for production:**
Would require implementation of deferred items. Documentation serves as technical debt register with estimated effort and impact analysis.

## Next Steps

### Step 9: Group Features

**Socket events to handle:**
- memberAdded - Update members list in conversation when user added
- addedToConversation - Add new conversation to list when current user added to group
- memberLeft - Remove member from conversation, if current user removed then delete conversation from list

**UI components needed:**
- ChatHeader enhancements - Display group title, member count, "Add member" and "Leave group" buttons
- AddMemberDialog - Search and add users to group (similar to add friend dialog pattern)
- Group-specific UI distinctions - Icons, badges, member avatars preview

**REST endpoints to integrate:**
- POST /api/conversations/group - Create group with title and member IDs
- POST /api/conversations/:id/members - Add member (creator/admin only)
- DELETE /api/conversations/:id/leave - Leave group

**Considerations:**
- ConversationItem already handles GROUP type display (shows memberCount)
- Backend enforces minimum 3 members for group creation
- Backend handles socket room management (auto-join on add, auto-leave on remove)

### Step 10: Polish & Error Handling

**Known issues to address:**
- Scroll position shared across conversations - Fix with key prop on ChatWindow
- Input draft persistence - Same fix as scroll position
- Initial online status snapshot - REST endpoint or backend initial emit
- Error toasts for failed operations - Integrate toast library
- Reconnection handling - Show banner when socket disconnects, reload data on reconnect
- Loading skeletons - Replace "Loading..." text with proper skeleton components

**Edge cases:**
- Token expiry during session - Auto-logout
- Network errors - Retry logic with exponential backoff
- Empty states - Better empty state designs with CTAs
- Concurrent operations - Race condition guards
- Scroll jump prevention - Maintain scroll position when prepending messages (if fixing scroll issue)

## Note for AI (ALWAYS COPY-PASTE THIS SECTION TO THE END OF THIS FILE)

1. File name in markdown follows the format "phase{number}-{side}-{step}-{feature}"
2. All sections are necessary
3. For bugs, group minor issues into a single point while major issues should have their own point. Issues that don't affect logic like typos, naming errors, etc. can be completely omitted. These should be in the "Issues" section, not called "bugs"
4. Do not include code snippets - only describe implementation
5. Do not include testing results - only document issues and solutions
6. THIS SECTION IS WRITTEN BY HUMAN, AI MODELS MUST ABSOLUTELY NOT EDIT IT THEMSELVES