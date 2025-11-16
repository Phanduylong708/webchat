# Phase 4B Implementation Plan - Chat & Real-time Messaging

## IMPORTANT NOTE

This plan is a **guideline, not a bible**. During implementation:

- Be flexible and adaptive
- If you find a better approach - take it
- If something doesn't make sense - change it
- Think "out of the box" - don't be rigidly bound by this plan
- Iterate based on real challenges and insights you discover

---

## Phase 4B Overview

**Goal:** Implement real-time chat system with Socket.IO, supporting 1-1 and group conversations, typing indicators, message history.

**Approach:** Feature-first + bottom-up hybrid

- Each step builds a complete, testable feature
- Early steps provide solid foundation for later ones
- Each step has clear verification criteria

**Architecture Pattern:** Mirror existing codebase

- Context + custom hooks for state management
- Separate API layer (REST) vs real-time layer (Socket.IO)
- Presentational vs smart components pattern

---

## Steps 1-10: Sequential Breakdown

### Step 1: Socket Infrastructure (DONE)

**Purpose:** Establish singleton Socket.IO connection with lifecycle management

**Key concepts:**

- Socket as singleton (one connection per session)
- Connect when authenticated, disconnect on logout
- Separate config file (like axios.config.ts)
- SocketProvider wraps app after AuthProvider

**What to verify:**

- Socket connects on app load (auth ready)
- Socket disconnects on logout
- Browser DevTools shows active connection
- Reconnection handlers working

**Files to create/modify:**

- `lib/socket.client.ts` - Factory functions
- `contexts/SocketProvider.tsx` - Lifecycle management
- `App.tsx` - Integration

**No code snippet** - design yourself based on axios.config pattern you already have

---

### Step 2: Type Definitions (Chat Domain) (DONE)

**Purpose:** Define all TypeScript interfaces following existing pattern

**Pattern (follow auth.type.ts style):**

- Separate interfaces for domain models, requests, state, and context type
- ContextType interface extends State interface
- Export all at end of file

**Key types to define in `types/chat.type.ts`:**

- Domain models: `Conversation`, `Message`, `UserProfile`
- Request payloads: `CreateGroupRequest`, `AddMemberRequest`, etc.
- State shape: `ChatState` (conversations, messages, loading, error, etc.)
- Context type: `ChatContextType extends ChatState` (+ all actions)
- Pagination metadata: `PaginationMeta`
- Socket event payloads: `SendMessagePayload`, `NewMessagePayload`, `UserTypingPayload`, etc.

**What to verify:**

- File compiles without errors
- Interfaces match backend schema (from api-reference.md)
- Consistent naming (no "ChatState" and "ChatContextState" mixed)
- All exported types listed at end

---

### Step 2B: ChatContext Foundation (DONE)

**Purpose:** Set up state management for conversations and messages

**State structure needed:**

- `conversations`: List of user's conversations (private + group)
- `messagesByConversation`: Map for O(1) lookups per conversation
- `activeConversationId`: Currently selected conversation
- `pagination`: Map tracking cursor + hasMore per conversation (for scroll history)
- `typingByConversation`: Map of Set<userId> typing in each conversation
- `loadingConversations`: boolean
- `loadingMessages`: boolean
- `error`: string | null

**Core actions:**

- `fetchConversations()` - REST GET /conversations on mount
- `selectConversation(id)` - Switch active conversation, fetch history if needed
- `sendMessage()` - Emit socket, handle optimistic + ack
- `startTyping()`, `stopTyping()` - Typing state management
- `addMember()`, `leaveGroup()` - Group mutations

**What to verify:**

- Conversations loaded and logged correctly
- State shape matches design
- No TypeScript errors

**Files to create/modify:**

- `api/conversation.api.ts` - REST calls for conversations
- `api/message.api.ts` - REST calls for messages
- `contexts/chatContext.tsx` - Provider + state logic
- `hooks/useChat.tsx` - Consumer hook

---

### Step 3: UI Skeleton (DONE)

**Purpose:** Create basic layout and routing for chat

**Layout structure:**

- Route `/chat/:conversationId?` (optional conversationId param)
- Two panels: ConversationListPanel (left) + ChatWindow (right)
- Reuse existing shell (SideBar | LeftPanel | MainContent grid)

**Components needed (presentational first):**

- `ConversationItem` - Single conversation row
- `ChatWindow` - Main chat area container
- `ChatHeader` - Shows title, members, actions (stub for now)
- `MessageList` - Messages container (stub)
- `MessageItem` - Individual message bubble (stub)
- `ChatInput` - Text input area (stub)
- `TypingIndicator` - Shows typing status (stub)

**What to verify:**

- Route loads without errors
- Two panels visible with correct layout
- Conversations list populates from state
- Empty state shows when no conversation selected

**Files to create/modify:**

- `pages/chat/ChatPage.tsx` - Main page/provider wrapper
- `components/chat/` folder structure
- `main.tsx` - Add route
- Sidebar nav - Add "Chats" link

---

---

### Step 4: Basic Message Display (DONE)

**Purpose:** Load and display message history when conversation selected

**Key interactions:**

- Click conversation in list - fetch that conversation's message history
- Display messages with sender name, timestamp, content
- Show loading state while fetching
- Cache messages in `messagesByConversation`

**Pagination metadata to track:**

- `nextCursor` - ID of oldest message for next fetch
- `hasMore` - Whether more messages exist before current batch

**What to verify:**

- Click a conversation - messages appear in right panel
- Messages show correct content, sender, timestamp
- Loading state appears while fetching
- Can scroll through loaded messages

**Files to create/modify:**

- `api/message.api.ts` - Add REST call for history
- Extend `chatContext.tsx` - `selectConversation()` action
- `components/chat/MessageList.tsx` - Display messages
- `components/chat/MessageItem.tsx` - Individual message styling
- `components/chat/ChatWindow.tsx` - Assemble layout

---

### Step 5: Send Message (DONE)

**Purpose:** Enable sending messages with optimistic UI updates

**Key pattern:**

- User types + presses Enter
- Message added to UI immediately with temp ID (optimistic)
- Emit socket `sendMessage` with ack callback
- On ack success: Replace temp ID with real ID, keep message in list
- On ack error: Show toast error, optionally allow retry

**UI feedback:**

- Input clears after send
- Message appears immediately in list (before server confirmation)
- Basic error toast if send fails

**What to verify:**

- Message appears immediately when sent
- DevTools shows socket emit
- After server ack - message status updates
- Error handling works (retry option shown)

**Files to create/modify:**

- `components/chat/ChatInput.tsx` - Input + send logic, Enter key handler
- Extend `chatContext.tsx` - `sendMessage()` action with ack callback
- Extend `MessageItem.tsx` - Basic message bubble display

---

### Step 6: Real-time Updates (DONE)

**Purpose:** Receive messages from other users in real-time

**Key pattern:**

- Socket listener for `newMessage` event in ChatContext
- When message received: append to `messagesByConversation`
- Update "last message" in conversations list
- Handle messages for conversations not currently loaded (cache but don't fetch)

**What to verify:**

- Open 2 tabs same app
- Send from Tab A - appears optimistic in Tab A
- Tab B receives in real-time after server broadcasts
- Both tabs stay in sync

**Files to create/modify:**

- Extend `chatContext.tsx` - Socket listener setup + cleanup (newMessage, friendOnline, friendOffline)
- Add state for tracking online users
- Extend `ChatHeader.tsx` - Display online badge for private chats
- Extend `ConversationItem.tsx` - Show online indicator for recipients in 1-1 chats

---

### Step 7: Typing Indicators (DONE)

**Purpose:** Show when other users are typing

**Key interactions:**

- User focuses input - emit `typing:start` immediately
- While typing - debounce (don't spam events)
- After ~2.5s inactivity - emit `typing:stop`
- Listen to `userTyping` event - update `typingByConversation` state
- Display "User1 is typing..." or "User1, User2 are typing..."

**State pattern:**

- `typingByConversation: Map<conversationId, Set<userId>>`
- Clean up user from set when typing stops (event driven)

**What to verify:**

- Type in one tab - other tab shows typing indicator
- Indicator disappears after inactivity
- Multiple users typing shows correct format

**Files to create/modify:**

- `components/chat/TypingIndicator.tsx` - Display component
- Extend `ChatInput.tsx` - Emit typing events
- Extend `chatContext.tsx` - Typing state + listeners

---

### Step 8: Pagination (Scroll History) (DONE)

**Purpose:** Load older messages when scrolling up

**Key pattern:**

- MessageList detects scroll near top
- Check `pagination[conversationId].hasMore`
- If true and not already loading - call `loadOlderMessages(conversationId)`
- REST call with `before=cursor` parameter
- Prepend returned messages (don't append - they're older)
- Update cursor + hasMore in pagination state

**Concurrency guard:**

- Track "is fetching" flag per conversation
- Don't allow multiple concurrent fetches for same conversation

**What to verify:**

- Scroll up in message list with >50 messages
- Loading indicator appears at top
- Older messages prepend to list
- Can continue scrolling until `hasMore === false`
- No duplicates

**Files to create/modify:**

- Extend `chatContext.tsx` - `loadOlderMessages()` action
- Extend `MessageList.tsx` - Scroll detection + pagination logic

---

### Step 9: Group Features (IN PROGRESS)

**Purpose:** Handle group conversation management

**UI components:**

- `ChatHeader` - Show title, member count, avatars
  - Private chat: Avatar + online badge + hide group buttons
  - Group chat: Title + members + "Add member" + "Leave group" buttons

**Actions:**

- `addMember(conversationId, userId)` - REST POST
- `leaveGroup(conversationId)` - REST DELETE, remove from list on success

**Socket events to handle:**

- `memberAdded` - Update members list, show toast
- `memberLeft` - Remove member, if self removed delete conversation
- `addedToConversation` - Add to conversations list, show toast

**What to verify:**

- Add member dialog works, member appears in group
- Leave group removes conversation from list
- Other members see updates via socket events
- Private vs group UI differs appropriately

**Files to create/modify:**

- `components/chat/ChatHeader.tsx` - Full implementation
- Extend `chatContext.tsx` - Group actions
- Update `ConversationItem.tsx` - Icons for group/private

---

### Step 10: Enable 1-1 Chat Trigger from Friend Profile

**Purpose:** Enable "Send Message" button on FriendProfile to initiate 1-1 chats

**Key interaction:**

- In `FriendProfile.tsx`, uncomment/enable "Send Message" button (currently greyed out)
- On click: navigate to `/chat?recipientId={friendId}` (use query param) or pass recipientId via route state
- ChatContext should handle lazy private chat creation (backend creates conversation on first sendMessage with recipientId)

**Backend behavior (already implemented):**

- sendMessage with `recipientId` (no `conversationId`) -> backend creates conversation
- Response ack includes `message.conversationId` -> use for subsequent sends in same conversation

**Frontend flow:**

- Store `recipientId` from URL param or route state
- First sendMessage call uses `recipientId`, receives back `conversationId`
- Update context: store new conversation, set as active, future sends use `conversationId`
- **Limitation (TODO):** Backend currently emits only `newMessage` for the first DM; no `addedToConversation` yet. Until that’s added, frontend must optimistically insert the conversation (from ack/newMessage payload) so users see it without a full fetch.

**What to verify:**

- FriendProfile "Send Message" button visible and clickable
- Click navigates to `/chat` with recipient info preserved
- First message sends using recipientId
- Subsequent messages use created conversationId
- New 1-1 conversation appears in ConversationListPanel immediately after first send (append from ack payload or fetch), no manual refresh needed

**Files to create/modify:**

- `components/friends/FriendProfile.tsx` - Enable "Send Message" button + navigation
- Extend `chatContext.tsx` - Handle lazy creation (recipientId -> conversationId swap)
- Update routing params/state handling in ChatPage

### Step 10: Polish & Error Handling

**Purpose:** Improve UX and handle edge cases

**Error handling:**

- REST errors - user-friendly toasts (network, 404, 403, etc.)
- Socket disconnect - "Reconnecting..." banner
- Send failures - "Failed to send" with retry button
- 401 - auto-logout

**Loading states:**

- Skeleton loaders for lists
- Disable input while sending
- Gray out pending messages

**Edge cases:**

- Reconnect - reload conversations + current thread
- Token expiry - logout
- Empty states - "No conversations", "No messages"

**Performance considerations:**

- Memoize MessageItem, ConversationItem
- Debounce scroll pagination handler
- Proper cleanup of socket listeners

**What to verify:**

- Kill network - reconnection UI works
- Send with network error - retry visible
- Logout - socket cleanup proper
- No stale data after rejoin
- TypeScript strict mode passes

---

## High-Level Architecture

```
SocketProvider (singleton, root level)
   App
       AuthProvider
           ChatProvider (wrap ChatPage)
               ChatPage
                   ConversationListPanel (smart - context)
                      ConversationItem[] (presentational)
                   ChatWindow (smart - context)
                       ChatHeader (mostly presentational)
                       MessageList (smart - context + scroll)
                          MessageItem[] (presentational)
                          TypingIndicator (presentational)
                       ChatInput (smart - context + events)
```

## Key Design Decisions

1. **Normalized state** - `messagesByConversation` as Map prevents nested updates
2. **Per-conversation pagination** - Scalable for many conversations
3. **Optimistic sends** - Responsive UX, ack callback handles errors
4. **Centralized socket listeners** - In context, not scattered in components
5. **Lazy message fetch** - Only load when conversation selected
6. **Guard concurrent fetches** - Prevent race conditions on pagination
7. **Separate loading flags** - Better UX (fetch list vs fetch history independently)

## State Shape Reference

```
ChatContextState {
  conversations: Conversation[]
  messagesByConversation: Map<conversationId, Message[]>
  activeConversationId: number | null
  pagination: Map<conversationId, { cursor: string, hasMore: boolean }>
  typingByConversation: Map<conversationId, Set<userId>>
  loadingConversations: boolean
  loadingMessages: boolean
  error: string | null
}
```

## REST vs Socket.IO Usage

**REST (snapshot, initial load, mutations):**

- GET /conversations - Load user's conversations
- GET /messages/{id} - Load history with pagination
- POST /conversations/group - Create group
- POST /conversations/{id}/members - Add member
- DELETE /conversations/{id}/leave - Leave group

**Socket.IO (real-time, incremental updates):**

- sendMessage - emit + ack
- newMessage - listen (all members)
- typing:start / typing:stop - emit
- userTyping - listen
- memberAdded - listen
- memberLeft - listen
- addedToConversation - listen (new member)
- friendOnline / friendOffline - listen (status)

---
