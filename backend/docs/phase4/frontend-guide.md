# Phase 4A – Frontend Integration Guide

> TL;DR: Base URL `http://localhost:5000`. REST uses JWT Bearer headers.  
> Socket.IO connects with the same token (`auth: { token }`).  
> See `backend/docs/api-reference` for full schemas.

## 1. Quick Overview

| Area                            | What you get                                   | How to consume                             |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| Auth (Phase 2)                  | Register/Login/Me                              | Already used in existing axios flows       |
| Friends + User search (Phase 3) | List/add/remove/search friends                 | No changes                                 |
| Conversations (Phase 4A)        | List, details, create group, add member, leave | REST (axios)                               |
| Messages (Phase 4A)             | Cursor-based history                           | REST (`GET /api/messages/:conversationId`) |
| Real-time chat                  | sendMessage, typing, group membership events   | Socket.IO                                  |

## 2. Authentication recap

- Login → receive `{ token }`.
- REST: `axios.get(url, { headers: { Authorization: \`Bearer ${token}\` } })`.
- Socket.IO:

```ts
const socket = io("http://localhost:5000", { auth: { token } });
socket.on("connect_error", (err) =>
  console.error("connect_error", err.message)
);
```

Token expiry default: 1 day. Handle 401 by re-login.

## 3. REST endpoints you need

Full details in OpenAPI; table below highlights new Phase 4A routes.

| Method | Path                              | Notes                                                         |
| ------ | --------------------------------- | ------------------------------------------------------------- |
| GET    | `/api/conversations`              | Conversation list (private + group)                           |
| GET    | `/api/conversations/{id}`         | Members & metadata                                            |
| POST   | `/api/conversations/group`        | Body `{ title, memberIds[] }` (min 2 members besides creator) |
| POST   | `/api/conversations/{id}/members` | Body `{ userId }` (creator only)                              |
| DELETE | `/api/conversations/{id}/leave`   | Any group member                                              |
| GET    | `/api/messages/{conversationId}`  | Query `before` (messageId), `limit` (default 50)              |

Example (axios):

```ts
const client = axios.create({
  baseURL: "http://localhost:5000",
  headers: { Authorization: `Bearer ${token}` },
});

const { data } = await client.get(`/api/messages/${conversationId}`, {
  params: { before: cursor, limit: 30 },
});
```

## 4. Socket.IO events

### 4.1 Status (auto-emitted)

| Event           | Direction       | Payload                |
| --------------- | --------------- | ---------------------- |
| `friendOnline`  | Server → Client | `{ userId, username }` |
| `friendOffline` | Server → Client | `{ userId, lastSeen }` |

### 4.2 Chat

| Event         | Direction       | Payload                                                                     | Ack / Notes                                |
| ------------- | --------------- | --------------------------------------------------------------------------- | ------------------------------------------ |
| `sendMessage` | Client → Server | `{ conversationId?, recipientId?, content }`                                | Callback → `{ success, message?, error? }` |
| `newMessage`  | Server → Client | `{ id, conversationId, content, messageType, senderId, sender, createdAt }` | Emitted to room except sender              |

Usage:

```ts
socket.emit("sendMessage", { conversationId, content: "Hello" }, (ack) => {
  if (!ack.success) console.error(ack.error);
});

socket.on("newMessage", (msg) => addToConversation(msg));
```

Lazy private chat: omit `conversationId`, provide `recipientId`. Backend creates room, joins both users, then emits `newMessage`.

### 4.3 Typing

| Event          | Direction       | Payload                                          | Notes                         |
| -------------- | --------------- | ------------------------------------------------ | ----------------------------- |
| `typing:start` | Client → Server | `{ conversationId }`                             | Call on keydown (debounce)    |
| `typing:stop`  | Client → Server | `{ conversationId }`                             | Emit after inactivity (~2.5s) |
| `userTyping`   | Server → Client | `{ userId, username, conversationId, isTyping }` | Update UI for other members   |

### 4.4 Group membership

| Event                 | Direction       | Who receives                  | Payload                           |
| --------------------- | --------------- | ----------------------------- | --------------------------------- |
| `memberAdded`         | Server → Client | Existing conversation members | `{ conversationId, member }`      |
| `addedToConversation` | Server → Client | New member                    | `{ conversation }` (full details) |
| `memberLeft`          | Server → Client | Remaining members             | `{ conversationId, userId }`      |

When you call REST `POST /members`, backend also joins the new user's sockets to the room. When someone leaves, their sockets are removed immediately.

## 5. Integration scenarios

1. **Load conversations on app start**

   - REST `GET /api/conversations` → render list.
   - Socket handles incremental updates (`memberAdded`, `memberLeft`).

2. **Open conversation**

   - REST `GET /api/messages/:id` (no `before` → newest batch).
   - Store `nextCursor` from `meta.nextCursor`.
   - On scroll-up: call again with `before=nextCursor` until `hasMore=false`.

3. **Send message**

   - For existing room: `sendMessage({ conversationId, content })`.
   - For new DM: `sendMessage({ recipientId, content })` → use `ack.message.conversationId` for future calls.

4. **Add member**

   - REST `POST /api/conversations/{id}/members`.
   - Wait for `ack 201`; UI updates come from socket events: current members hear `memberAdded`, new member gets `addedToConversation`.

5. **Leave group**

   - REST `DELETE /api/conversations/{id}/leave`.
   - After success, remove conversation locally; `memberLeft` updates others.

6. **Typing indicator**
   - On input start: emit `typing:start`.
   - After debounce or send: emit `typing:stop`.
   - Display `userTyping` badges per conversationId.

## 6. Error handling

### REST

Standard format: `{ "success": false, "message": "..." }`

| Status | When                                         |
| ------ | -------------------------------------------- |
| 400    | Invalid body/query (e.g., missing `content`) |
| 401    | Missing/invalid JWT                          |
| 403    | Not member of conversation / not creator     |
| 404    | Conversation/user not found                  |
| 409    | Already friends / already member             |
| 500    | Unexpected server error                      |

### Socket.IO

- `sendMessage` callback returns `{ success: false, error }` on validation failures.
- `connect_error` fires when token invalid or expired.

## 7. Data model cheatsheet

| Model                 | Fields (frontend-facing)                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `UserProfile`         | `id`, `username`, `avatar`, `isOnline?`, `lastSeen?`                                             |
| `ConversationSummary` | `id`, `type`, `title`, `otherUser?`, `previewMembers?`, `memberCount?`, `lastMessage`            |
| `Conversation`        | `id`, `type`, `title`, `creatorId`, `members: UserProfile[]`                                     |
| `Message`             | `id`, `conversationId`, `content`, `messageType`, `senderId`, `sender: UserProfile`, `createdAt` |
| `PaginationMeta`      | `limit`, `nextCursor`, `hasMore`                                                                 |

Refer to api-reference for complete definitions.

## 8. Best practices

- Always merge REST snapshot (initial load) with Socket.IO events (real-time).
- On reconnect, reload conversations/messages to catch missed data.
- Debounce typing events; server does not auto-stop.
- For unread tracking, use `meta.hasMore` instead of page numbers.
- `friendOnline/friendOffline` drive live status; REST data may be stale.
- Handle `socket.disconnected` (e.g., show reconnecting indicator).

---

Questions or missing edge cases? Ping backend dev or check `backend/docs/api-reference.md` for the authoritative REST spec. Happy building!
