# WebChat API Reference (Phase 4A)

> Base URL: `http://localhost:5000`  
> Auth: JWT Bearer (`Authorization: Bearer <token>`)  
> This document lists REST endpoints + data models. Socket events are covered in `frontend-guide.md`.

---

## 1. Authentication (Phase 2)

| Method | Path                 | Description                                                               |
| ------ | -------------------- | ------------------------------------------------------------------------- |
| POST   | `/api/auth/register` | Create account. Body `{ username, email, password }`.                     |
| POST   | `/api/auth/login`    | Get JWT. Body `{ identifier, password }`. Identifier = email or username. |
| GET    | `/api/auth/me`       | Current authenticated user. Requires Bearer token.                        |

**Login response**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 2,
      "email": "user@example.com",
      "username": "user",
      "avatar": null
    },
    "token": "…JWT…"
  }
}
```

Errors: 400 invalid payload, 401 invalid credentials.

---

## 2. Friends & Users (Phase 3)

| Method | Path                               | Notes                                     |
| ------ | ---------------------------------- | ----------------------------------------- |
| GET    | `/api/friends`                     | List current friends.                     |
| POST   | `/api/friends`                     | Body `{ friendId }`. Auto-accept.         |
| DELETE | `/api/friends/{friendId}`          | Remove friend.                            |
| GET    | `/api/users/search?username=alice` | Search users by username (partial match). |

Responses follow `{ success, data, message }` pattern. Errors: 400 invalid ID, 404 user not found, 409 already friends.

---

## 3. Conversations (Phase 4A)

### 3.1 List conversations

`GET /api/conversations`

```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": 4,
        "type": "PRIVATE",
        "title": null,
        "otherUser": { "id": 6, "username": "alice", "avatar": null },
        "lastMessage": {
          "id": 15,
          "content": "Hey!",
          "createdAt": "2025-10-24T08:18:07.392Z",
          "senderId": 2,
          "sender": { "id": 2, "username": "bob", "avatar": null }
        }
      },
      {
        "id": 3,
        "type": "GROUP",
        "title": "Project Team",
        "memberCount": 4,
        "previewMembers": [
          { "id": 4, "username": "jane", "avatar": null },
          { "id": 6, "username": "alice", "avatar": null }
        ],
        "lastMessage": { ... }
      }
    ]
  },
  "message": "Conversations retrieved successfully"
}
```

### 3.2 Conversation details

`GET /api/conversations/{id}`

Response:

```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": 3,
      "type": "GROUP",
      "title": "Project Team",
      "creatorId": 2,
      "members": [
        { "id": 2, "username": "bob", "avatar": null },
        { "id": 4, "username": "jane", "avatar": null },
        { "id": 6, "username": "alice", "avatar": null }
      ]
    }
  },
  "message": "Conversation details retrieved successfully"
}
```

Errors: 403 if requester not member, 404 if conversation not found.

### 3.3 Create group

`POST /api/conversations/group`

Body:

```json
{ "title": "Team Chat", "memberIds": [4, 6] }
```

Rules: title required, `memberIds` array with at least two distinct users not including creator. Response 201 with conversation details (same structure as 3.2).

Errors: 400 invalid payload, 404 member not found.

### 3.4 Add member

`POST /api/conversations/{id}/members`

Body `{ "userId": 6 }`, creator only. Response:

```json
{
  "success": true,
  "data": {
    "conversationId": 3,
    "member": { "id": 6, "username": "alice", "avatar": null }
  },
  "message": "Member added to group conversation successfully"
}
```

Socket side-effects:

- `memberAdded` → existing members.
- `addedToConversation` → new member (contains conversation object).
- New member’s sockets auto-join conversation room.

Errors: 400/403/404/409 as applicable.

### 3.5 Leave group

`DELETE /api/conversations/{id}/leave`

Response 200 `{ success: true, message: "Left group conversation successfully" }`.

Socket side-effects:

- User’s sockets leave conversation room immediately.
- `memberLeft` broadcast to remaining members with `{ conversationId, userId }`.

Errors: 400 if private conversation, 404 not member.

---

## 4. Messages (Phase 4A)

`GET /api/messages/{conversationId}`

Query params:

- `before` (optional messageId) – load older messages `< before`.
- `limit` (optional, default 50, max 100).

Response:

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 20,
        "conversationId": 4,
        "content": "Hello",
        "messageType": "TEXT",
        "senderId": 2,
        "sender": { "id": 2, "username": "bob", "avatar": null },
        "createdAt": "2025-10-24T08:18:08.919Z"
      },
      ...
    ],
    "meta": {
      "limit": 50,
      "nextCursor": 15,
      "hasMore": true
    }
  },
  "message": "Messages retrieved successfully"
}
```

Usage:

- First load: omit `before`.
- For infinite scroll: call again with `before = meta.nextCursor` until `hasMore` false.

Errors: 403 if requester not member, 404 conversation not found.

---

## 5. Error format (REST)

All error responses follow:

```json
{ "success": false, "message": "Reason" }
```

Example:

```json
{
  "success": false,
  "message": "You are not a member of this conversation."
}
```

Common status codes:  
400 invalid payload, 401 missing/invalid token, 403 forbidden, 404 not found, 409 conflict, 500 server error.

---

## 6. Data models (summary)

| Model                 | Key fields                                                                            | Notes                                          |
| --------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `User`                | `id`, `email`, `username`, `avatar`, `isOnline`, `lastSeen`                           | `email/password` only from auth endpoints      |
| `UserProfile`         | `id`, `username`, `avatar`                                                            | Used in conversation members, messages         |
| `Friend`              | `id`, `username`, `avatar`, `isOnline`, `lastSeen`                                    | Returned by `/api/friends`                     |
| `ConversationSummary` | `id`, `type`, `title`, `otherUser?`, `memberCount?`, `previewMembers?`, `lastMessage` | For conversation list                          |
| `Conversation`        | `id`, `type`, `title`, `creatorId`, `members: UserProfile[]`                          | For details + `addedToConversation` event      |
| `Message`             | `id`, `conversationId`, `content`, `messageType`, `senderId`, `sender`, `createdAt`   | Returned by messages API + socket `newMessage` |
| `PaginationMeta`      | `limit`, `nextCursor`, `hasMore`                                                      | Cursor pagination metadata                     |

Refer to actual controller responses if you need exact field ordering.

---

For Postman/curl, add header `Authorization: Bearer <token>` to all protected routes.

---

Need more detail? Reach out to backend or check actual handlers under `backend/src/api`. This markdown is intentionally concise (~7.5k chars) for quick reference.
