# Phase 4A: Chat System - Backend Implementation

**Status:** Not Started ⏳
**Approach:** Socket.IO for real-time + REST for data retrieval
**Estimated Duration:** ~6-8 hours

---

## Architecture Overview

### Key Architectural Decisions

**1. Socket.IO Structure:**

- Organized by feature in `sockets/` folder
- Handlers: `chat.handler.js` (messages, typing), `status.handler.js` (online/offline)
- Middleware: JWT authentication at handshake

**2. Communication Pattern:**

- **WRITE:** Socket.IO events (`sendMessage`, `typing:start/stop`)
- **READ:** REST APIs (message history, conversations list)
- **Persistency:** Database = source of truth; REST = snapshot; Socket.IO = incremental updates

**3. Authentication:**

- Client sends JWT via `auth` option on Socket.IO connection
- Server uses `io.use()` middleware to verify token at handshake
- Reuse `verifyToken()`
- Fetch user from DB → attach to `socket.user`

**4. Conversation Flow:**

- **Lazy creation:** Auto-create 1-1 conversation on first message
- **Transaction safety:** Prisma transaction wraps conversation creation + message save
- **Group chat:** Explicit creation via REST API (`POST /api/conversations/group`)

**5. Room Strategy:**

- **One room per conversation:** `conversation_{id}`
- User joins all conversation rooms on connection
- Broadcast via `io.to(room).emit(...)` (efficient, supports multi-tab)

**6. Online Status:**

- Track via Socket.IO `connection` and `disconnect` events
- Built-in Engine.IO heartbeat (no custom ping/pong needed)
- Update `isOnline` and `lastSeen` fields in User model

**7. Group Chat Scope (Phase 4A):**

- Create group (title, initial members)
- Send/receive messages in group
- Add member to existing group (admin only)
- Leave group (any member)
- **Deferred:** Remove member (kick), update group title, permission system

**8. Bottom-Up Approach:**

- Simple to complex, no placeholder files
- Complete each step fully before moving to next
- Don't jump to other files mid-implementation

---

## Implementation Plan

### STEP 1: Socket.IO Setup & Integration

**Goal:** Integrate Socket.IO with existing Express server and create folder structure.

**Installation:**

```bash
npm install socket.io
```

**Server Integration (`server.js`):**

- Import `http` module and wrap Express app
- Create Socket.IO instance attached to HTTP server
- Import and initialize socket handlers
- Ensure error middleware runs after Socket.IO setup

**Files to Create:**

- `src/sockets/index.js` - Socket.IO setup and handler registration
- `src/sockets/middlewares/auth.middleware.js` - JWT handshake authentication
- `src/sockets/handlers/chat.handler.js` - Placeholder (implement in STEP 5)
- `src/sockets/handlers/status.handler.js` - Placeholder (implement in STEP 2)

**Socket.IO Authentication Middleware:**

- Extract token from `socket.handshake.auth.token`
- Verify token using `verifyToken()` from jwt.util.js
- If invalid → call `next(new Error("Unauthorized"))`
- If valid → fetch user from DB (id, username, email)
- Attach user to `socket.user` for handlers to reuse
- Call `next()` to allow connection

**Files Updated:**

- `src/server.js` - Integrate Socket.IO with Express

---

### STEP 2: Online Status Tracking

**Goal:** Track user online/offline status via Socket.IO connection events.

**Implementation (`status.handler.js`):**

**User Room Strategy:**

- Each user joins personal room `user_{userId}` on connection
- Socket.IO automatically handles multi-tab (multiple sockets join same room)
- Broadcast to friends via `io.to(`user\_${friendId}`).emit(...)`
- Check if fully offline: query `io.sockets.adapter.rooms.get(`user\_${userId}`)` - if undefined, all tabs closed
- Update DB status (isOnline/lastSeen) only when user fully offline (no sockets remain)

**`connection` event:**

- Get `userId` from `socket.user.id`
- Join socket to personal room: `user_{userId}`
- Check room size: if first socket (new connection) → update `isOnline = true` in DB
- Fetch user's friends list (reuse `getFriends(userId)` service)
- Broadcast `friendOnline` to each friend via `io.to(`user\_${friendId}`).emit(...)`
- Join user to all conversation rooms (fetch from DB)

**`disconnect` event:**

- Get `userId` from `socket.user.id`
- Check if user still has other sockets: query `io.sockets.adapter.rooms.get(`user\_${userId}`)`
- If room undefined (all tabs closed) → user fully offline:
  - Update User: `isOnline = false`, `lastSeen = now()`
  - Fetch user's friends list
  - Broadcast `friendOffline` to each friend via `io.to(`user\_${friendId}`).emit(...)`
- If room still exists → do nothing (user still online in another tab)

**Events Emitted:**

- `friendOnline` → { userId, username } (to friends when first socket connects)
- `friendOffline` → { userId, lastSeen } (to friends when last socket disconnects)

**Files:**

- `src/sockets/handlers/status.handler.js` (new)

---

### STEP 3: Conversation APIs (REST)

**Goal:** Provide REST endpoints for fetching conversations and managing group chats.

**Endpoints:**

#### 3.1. Get User's Conversations

**Endpoint:** `GET /api/conversations`

**Response:**

```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": 1,
        "type": "PRIVATE",
        "title": null,
        "otherUser": { "id": 5, "username": "friend", "avatar": null },
        "lastMessage": {
          "id": 42,
          "content": "Hello!",
          "createdAt": "2025-01-20T..."
        }
      },
      {
        "id": 2,
        "type": "GROUP",
        "title": "Team Chat",
        "memberCount": 5,
        "lastMessage": {
          "id": 99,
          "content": "See you later",
          "createdAt": "2025-01-20T..."
        },
        "previewMembers": [
          { "id": 5, "username": "friend", "avatar": null },
          { "id": 7, "username": "alex", "avatar": "..." }
        ]
      }
    ]
  }
}
```

**Service:** `getConversations(userId)`

- Query ConversationMember where `userId = currentUser`
- Include: Conversation, latest Message, other members (for PRIVATE: map otherUser; for GROUP: count members)
- Sort by latest message timestamp

**Notes:**

- `otherUser` contains **static fields only**: id, username, avatar
- **No `isOnline` or `lastSeen`** in REST response (real-time data)
- Online status updates via Socket.IO `friendOnline`/`friendOffline` events
- Frontend merges REST snapshot + Socket.IO events for full state

#### 3.2. Get Conversation Details

**Endpoint:** `GET /api/conversations/:id`

**Validation:**

- User must be a member of the conversation (403 if not)

**Response:**

```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": 1,
      "type": "PRIVATE",
      "title": null,
      "creatorId": 3,
      "members": [
        { "id": 3, "username": "user1", "avatar": null },
        { "id": 5, "username": "user2", "avatar": null }
      ]
    }
  }
}
```

**Service:** `getConversationDetails(conversationId, userId)`

- Verify user is member (throw 403 if not)
- Fetch Conversation with members
- Return conversation + members list

**Notes:**

- Members contain **static fields only**: id, username, avatar
- No online status in REST response (updated via Socket.IO events)

#### 3.3. Create Group Conversation

**Endpoint:** `POST /api/conversations/group`

**Request:**

```json
{
  "title": "Team Chat",
  "memberIds": [5, 8, 12]
}
```

**Validation:**

- title required, min 1 character (400)
- memberIds must be array of valid integers (400)
- All memberIds must exist (404)
- memberIds should not include current user (auto-added)

**Response:**

```json
{
  "success": true,
  "message": "Group created successfully",
  "data": {
    "conversation": {
      "id": 2,
      "type": "GROUP",
      "title": "Team Chat",
      "creatorId": 3,
      "members": [...]
    }
  }
}
```

**Service:** `createGroupConversation(userId, title, memberIds)`

- Validate: title not empty, memberIds array valid
- Normalize memberIds: deduplicate (uniq) to avoid Prisma unique constraint error; empty array allowed (creator-only group)
- Check all memberIds exist in User table (404 if any not found)
- **No friend check** - Phase 4A does not enforce friend-only invite (keep scope minimal)
- Create Conversation (type: GROUP, creatorId: currentUser) + ConversationMember for creator + all memberIds (in transaction)
- After transaction: join creator socket to `conversation_{id}` room + emit `conversationCreated` to each member's personal room (`user_{memberId}`)
- Return conversation with members (static fields: id, username, avatar only - no email/password)

#### 3.4. Add Member to Group

**Endpoint:** `POST /api/conversations/:id/members`

**Request:**

```json
{
  "userId": 15
}
```

**Validation:**

- Conversation must be GROUP type (400)
- Current user must be admin (creatorId check) (403)
- userId must exist (404)
- User not already a member (409)

**Response:**
```json
{
  "success": true,
  "message": "Member added successfully",
  "data": {
    "conversationId": 2,
    "member": { "id": 15, "username": "newuser", "avatar": null }
  }
}
```

**Service:** `addMemberToGroup(conversationId, currentUserId, newUserId)`

- Verify conversation is GROUP, currentUser is creator (admin), newUser exists, not already member
- Create ConversationMember
- Join all new user's sockets to conversation room: `io.in(`user_${newUserId}`).socketsJoin(`conversation_${conversationId}`)`
- Emit `memberAdded` to `conversation_{id}` (notify existing members)
- Emit `addedToConversation` to `user_{newUserId}` (notify new member's devices with conversation details)
- Return conversationId + new member info (id, username, avatar only)

#### 3.5. Leave Group

**Endpoint:** `DELETE /api/conversations/:id/leave`

**Validation:**

- Conversation must be GROUP type (400)
- User must be a member (404)
- **Note:** Creator can leave - Phase 4A allows this, group remains active (no admin transfer logic)

**Response:**
```json
{
  "success": true,
  "message": "Left group successfully"
}
```

**Service:** `leaveGroup(conversationId, userId)`

- Verify conversation is GROUP, user is member
- Delete ConversationMember
- Remove all user's sockets from conversation room: `io.in(`user_${userId}`).socketsLeave(`conversation_${conversationId}`)`
- Emit `memberLeft` to `conversation_{id}` (notify remaining members with userId)
- Return success (no data payload)

**Files:**

- `src/api/services/conversation.service.js` (new)
- `src/api/controllers/conversation.controller.js` (new)
- `src/api/routes/conversation.routes.js` (new)

**Updated:**

- `src/server.js` - Register route: `app.use("/api/conversations", conversationRoutes)`

---

### STEP 4: Message History API (REST)

**Goal:** Provide paginated message history for conversations.

**Endpoint:** `GET /api/messages/:conversationId?page=1&limit=50`

**Validation:**

- User must be a member of conversation (403)
- page and limit must be positive integers (default: page=1, limit=50)

**Response:**

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 123,
        "content": "Hello!",
        "messageType": "TEXT",
        "senderId": 5,
        "sender": {
          "id": 5,
          "username": "friend",
          "avatar": null
        },
        "createdAt": "2025-01-20T10:30:00Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "hasMore": true
    }
  }
}
```

**Service:** `getMessages(conversationId, userId, page, limit)`

- Verify user is member of conversation (throw 403 if not)
- Query Messages where `conversationId = conversationId`
- Order by `createdAt DESC` (newest first)
- Paginate: `skip = (page - 1) * limit`, `take = limit`
- Include sender (id, username, avatar)
- Count total messages for `hasMore` calculation
- Return messages + pagination meta

**Files:**

- `src/api/services/message.service.js` (new)
- `src/api/controllers/message.controller.js` (new)
- `src/api/routes/message.routes.js` (new)

**Updated:**

- `src/server.js` - Register route: `app.use("/api/messages", messageRoutes)`

---

### STEP 5: Chat Socket Events (WRITE)

**Goal:** Handle real-time message sending and typing indicators via Socket.IO.

**Implementation (`chat.handler.js`):**

#### 5.1. Join Conversation Rooms on Connection

**On `connection` event:**

- Fetch all conversations user is member of (query ConversationMember)
- For each conversation: `socket.join(`conversation\_${conversationId}`)`
- This allows user to receive broadcasts for all their chats

#### 5.2. Send Message Event

**Event:** `sendMessage`

**Client Payload:**

```json
{
  "conversationId": 1,
  "content": "Hello!",
  "recipientId": 5 // Optional: only for 1-1 chat lazy creation
}
```

**Server Logic:**

**Validation:**
- If both `conversationId` and `recipientId` provided → reject with error (ambiguous payload)
- If neither provided → reject with error (must specify one)

**For PRIVATE chat (conversationId not provided, recipientId provided):**
- Use helper `findOrCreatePrivateConversation(userId, recipientId)` - returns conversationId
- Helper handles: check exist, verify recipientId exists, lazy create in transaction if needed (no friend check - Phase 4A scope)
- Proceed with conversationId

**For GROUP chat (conversationId provided):**
- Verify user is member of conversation

**Message Creation:**
- Validate content not empty (return error via callback if invalid)
- Create Message + update Conversation `updatedAt` (for sorting in 3.1 REST endpoint)
- Ensure sender joined to `conversation_{id}` room (especially for lazy-created 1-1)
- Broadcast `newMessage` to `conversation_{id}` (exclude sender with `socket.broadcast.to(...)`)
- Ack to sender: `callback({ success: true, message: fullMessageData })` with id, conversationId, content, createdAt, sender info

**Error Handling:**
- All validation/business errors return via callback: `callback({ success: false, error: "..." })`
- Do NOT throw errors (would disconnect socket)

**Broadcast Event:** `newMessage`

```json
{
  "id": 124,
  "conversationId": 1,
  "content": "Hello!",
  "messageType": "TEXT",
  "senderId": 3,
  "sender": {
    "id": 3,
    "username": "user1",
    "avatar": null
  },
  "createdAt": "2025-01-20T10:35:00Z"
}
```

#### 5.3. Typing Indicator Events

**Event:** `typing:start`

**Client Payload:**

```json
{
  "conversationId": 1
}
```

**Server Logic:**

- Verify user is member of conversation
- Broadcast `userTyping` to conversation room (exclude sender)
- Payload: `{ userId, username, conversationId, isTyping: true }`

**Event:** `typing:stop`

**Same flow, but `isTyping: false`**

**Client-side responsibility:**

- Auto-emit `typing:stop` after ~2500ms of no input

**Files:**

- `src/sockets/handlers/chat.handler.js` (new)

---

## Files Structure

**Updated:**

- `src/server.js` - Integrate Socket.IO + register new routes

**Unchanged:**

- Prisma schema (Conversation, Message, ConversationMember already exist)
- User model (isOnline, lastSeen fields already exist)
- Existing auth patterns (JWT utils, Passport config)
- Response utilities (sendSuccess, sendErrors)

---

## Socket Events Summary

| Event                 | Direction       | Payload                                              | Description                                      |
| --------------------- | --------------- | ---------------------------------------------------- | ------------------------------------------------ |
| `connection`          | Server          | -                                                    | User connects → join rooms, update status        |
| `disconnect`          | Server          | -                                                    | User disconnects → update status, notify friends |
| `friendOnline`        | Server → Client | `{ userId, username }`                               | Notify friend came online                        |
| `friendOffline`       | Server → Client | `{ userId, lastSeen }`                               | Notify friend went offline                       |
| `sendMessage`         | Client → Server | `{ conversationId?, recipientId?, content }`         | Send new message (lazy create 1-1)               |
| `newMessage`          | Server → Client | `{ id, conversationId, content, sender, createdAt }` | Broadcast new message to conversation            |
| `typing:start`        | Client → Server | `{ conversationId }`                                 | User starts typing                               |
| `typing:stop`         | Client → Server | `{ conversationId }`                                 | User stops typing                                |
| `userTyping`          | Server → Client | `{ userId, username, conversationId, isTyping }`     | Broadcast typing status                          |
| `conversationCreated` | Server → Client | `{ conversation }`                                   | Notify members of new group                      |
| `memberAdded`         | Server → Client | `{ conversationId, member }`                         | Notify group of new member                       |
| `memberLeft`          | Server → Client | `{ conversationId, userId }`                         | Notify group member left                         |

---

## REST API Summary

| Method | Endpoint                       | Auth | Description                                         |
| ------ | ------------------------------ | ---- | --------------------------------------------------- |
| GET    | /api/conversations             | JWT  | Get user's conversations (sorted by latest message) |
| GET    | /api/conversations/:id         | JWT  | Get conversation details + members                  |
| POST   | /api/conversations/group       | JWT  | Create group conversation                           |
| POST   | /api/conversations/:id/members | JWT  | Add member to group (admin only)                    |
| DELETE | /api/conversations/:id/leave   | JWT  | Leave group conversation                            |
| GET    | /api/messages/:conversationId  | JWT  | Get message history (paginated, default 50/page)    |

---

## Notes

**Architecture Principles:**

- **Hybrid communication:** Socket.IO for WRITE (send message), REST for READ (history, conversations)
- **Persistency:** Database = source of truth; REST = snapshot; Socket.IO = real-time incremental updates
- **Lazy creation:** 1-1 conversations auto-created on first message (wrapped in Prisma transaction)
- **Room-based broadcast:** One room per conversation for efficient message delivery
- **Authentication:** JWT verified once at handshake, user attached to `socket.user`
- **Bottom-up approach:** Simple to complex, no placeholders, complete each step fully before moving to next

**Reuse Existing Patterns:**

- Service/Controller/Route layers from Phase 2 & 3
- `sendSuccess()` / `sendErrors()` utilities
- Passport JWT middleware for REST endpoints
- Error handling with `next(error)` and centralized error handler
  **Next Phase:**

- **Phase 4B:** Frontend implementation (chat UI, Socket.IO client integration)
