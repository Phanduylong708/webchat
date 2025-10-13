# Phase 3: Friend System - Backend Implementation

**Status:** Completed ✅
**Approach:** RESTful API + Auto-accept friendship model
**Estimated Duration:** ~3-4 hours

---

## Architecture Overview

**Friend System Flow:**

- Add Friend: Controller parses request -> Service validates ALL business rules -> Normalize IDs -> Create Friendship -> Return friend info
- Get Friends: Query with OR condition -> Include both users -> Map to friend objects
- Remove Friend: Service validates -> Delete record -> Return success
- Online Status: Already tracked in User model (isOnline, lastSeen fields)

**Key Decisions:**

- Auto-accept (no pending/request state) - simplified for graduation project scope
- Friendship normalization: userId1 always < userId2 (prevent duplicates)
- Query optimization: Single query with OR + include both users
- Security: No email in friend data responses
- **Separation of Concerns:** Controllers = HTTP layer, Services = Business logic layer
- Protected routes: All endpoints require JWT authentication
- Bottom-up approach, simple to complex, meaning no placeholder file, don't jump to other files mid-implementation.

---

## Implementation Plan

### STEP 1: Add Friend API

**Endpoint:** `POST /api/friends`

**Request:**

```json
{ "friendId": 123 }
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Friend added successfully",
  "data": {
    "friend": {
      "id": 123,
      "username": "friend_username",
      "avatar": null,
      "isOnline": true,
      "lastSeen": null
    }
  }
}
```

**Validation Rules (in order):**

1.  Authentication required (401) - Passport JWT middleware
2.  friendId must be valid integer (400) - Controller layer
3.  Cannot add yourself (400) - Service layer
4.  User must exist (404) - Service layer
5.  Already friends check (409) - Service layer

**Implementation:**

**Service:** `addFriend(currentUserId, friendId)`

- **Responsibility:** ALL business logic validation + database operations
- Check: `if (currentUserId === friendId)` � throw error (400) "You cannot add yourself as a friend"
- Check: User exists � `findUserById(friendId)` � if not found, throw error (404) "User not found"
- Check: Already friends � find existing friendship with normalized IDs � if exists, throw error (409) "You are already friends with this user"
- Normalize: `userId1 = Math.min(currentUserId, friendId)`, `userId2 = Math.max(...)`
- Create friendship record
- Fetch and return friend user info (select: id, username, avatar, isOnline, lastSeen - NO email/password)

**Controller:** `addFriendController(req, res, next)`

- **Responsibility:** HTTP layer only - parse, basic format validation, call service, send response
- Parse `friendId` from `req.body`
- Basic validation: Check if friendId is a valid integer (400) "friendId must be a valid integer"
- Get `currentUserId` from `req.user.id` (authenticated user)
- Call `addFriend(currentUserId, friendId)` service
- Send success response with friend data
- Catch errors and forward to error handler

**Route:** Protected with Passport JWT middleware

**Files to create:**

- `src/api/services/friend.service.js` (new)
- `src/api/controllers/friend.controller.js` (new)
- `src/api/routes/friend.routes.js` (new)

---

### STEP 2: Get Friends List API

**Endpoint:** `GET /api/friends`

**Response:**

```json
{
  "success": true,
  "data": {
    "friends": [
      {
        "id": 124,
        "username": "friend_one",
        "avatar": null,
        "isOnline": false,
        "lastSeen": "2025-01-10T..."
      }
    ]
  }
}
```

**Implementation:**

**Service:** `getFriends(currentUserId)`

- Query Friendship with OR condition: `userId1 = current OR userId2 = current`
- Include both user1 and user2 relations
- Map results: return user2 if current is user1, else return user1
- Select only: id, username, avatar, isOnline, lastSeen (NO email, NO password)

**Controller:** `getFriendsController(req, res, next)`

- Get `currentUserId` from `req.user.id`
- Call `getFriends(currentUserId)` service
- Send success response with friends array

**Route:** Protected with JWT

**Query Logic:**

```javascript
const friendships = await prisma.friendship.findMany({
  where: {
    OR: [{ userId1: currentUserId }, { userId2: currentUserId }],
  },
  include: {
    user1: {
      select: {
        id: true,
        username: true,
        avatar: true,
        isOnline: true,
        lastSeen: true,
      },
    },
    user2: {
      select: {
        id: true,
        username: true,
        avatar: true,
        isOnline: true,
        lastSeen: true,
      },
    },
  },
});

const friends = friendships.map((f) =>
  f.userId1 === currentUserId ? f.user2 : f.user1
);
```

---

### STEP 3: Remove Friend API

**Endpoint:** `DELETE /api/friends/:friendId`

**Response (Success):**

```json
{
  "success": true,
  "message": "Friend removed successfully"
}
```

**Validation:**

1.  Authentication required (401)
2.  friendId must be valid integer (400) - Controller layer
3.  Friendship must exist (404) - Service layer

**Implementation:**

**Service:** `removeFriend(currentUserId, friendId)`

- Normalize IDs: `userId1 = Math.min(...)`, `userId2 = Math.max(...)`
- Find friendship with normalized IDs
- If not found, throw error (404) "Friendship not found"
- Delete friendship record
- Return success

**Controller:** `removeFriendController(req, res, next)`

- Parse `friendId` from `req.params`
- Basic validation: Check if friendId is valid integer (400)
- Get `currentUserId` from `req.user.id`
- Call `removeFriend(currentUserId, friendId)` service
- Send success response

**Route:** Protected with JWT

---

### STEP 4: Testing & Verification

**Test Cases:**

- **Add Friend:**

  -  Success (200 + friend data)
  -  Invalid friendId format (400)
  -  Add self (400)
  -  User not found (404)
  -  Already friends (409)
  -  No auth token (401)

- **Get Friends:**

  -  Empty list (new user)
  -  Multiple friends
  -  Verify no email in response
  -  Verify online status included
  -  No auth token (401)

- **Remove Friend:**
  -  Success (200)
  -  Invalid friendId (400)
  -  Not friends (404)
  -  No auth token (401)

---

## Files Structure

**Created:**

- `src/api/services/friend.service.js` - Business logic (addFriend, getFriends, removeFriend) with ALL validation
- `src/api/controllers/friend.controller.js` - HTTP layer (parse, basic format check, call service, send response)
- `src/api/routes/friend.routes.js` - Route definitions with JWT protection

**Updated:**

- `src/server.js` - Register friend routes: `app.use("/api/friends", friendRoutes)`

**Unchanged:**

- Prisma schema already has Friendship model 
- User model already has isOnline, lastSeen fields 
- Passport JWT middleware already configured 

---

## API Endpoints Summary

| Method | Endpoint               | Auth            | Description                        |
| ------ | ---------------------- | --------------- | ---------------------------------- |
| POST   | /api/friends           | Protected (JWT) | Add a new friend (auto-accept)     |
| GET    | /api/friends           | Protected (JWT) | Get list of current user's friends |
| DELETE | /api/friends/:friendId | Protected (JWT) | Remove a friend                    |

---

## Notes

- No migration needed (Friendship model already exists)
- Reuse existing patterns from auth (service/controller/route layers)
- Reuse existing utilities (response.util.js for sendSuccess/sendErrors)
- **Service layer is self-contained** - can be reused outside HTTP context
- Online status is read-only for now (Phase 4 will handle Socket.IO updates)
