### STEP 6: Testing & Verification

**Test Scenarios:**

**Socket.IO Authentication:**

- ✅ Connect with valid JWT → success
- ✅ Connect without token → `connect_error`
- ✅ Connect with invalid token → `connect_error`

**Online Status:**

- ✅ User A connects → User B (friend) sees `friendOnline` event
- ✅ User A disconnects → User B sees `friendOffline` with lastSeen
- ✅ User opens 2 tabs → both connect, disconnect 1 tab → still online

**Conversations API:**

- ✅ GET /api/conversations → returns all user's chats (sorted by latest message)
- ✅ GET /api/conversations/:id → returns conversation details (verify membership)
- ✅ POST /api/conversations/group → creates group with members
- ✅ POST /api/conversations/:id/members → only admin can add (403 for non-admin)
- ✅ DELETE /api/conversations/:id/leave → removes user from group

**Messages API:**

- ✅ GET /api/messages/:conversationId → returns paginated history
- ✅ Non-member tries to fetch → 403

**Send Message (Socket.IO):**

- ✅ User A sends message to User B (1-1, no existing conversation) → lazy creates conversation
- ✅ User A sends message to existing 1-1 conversation → saves + broadcasts
- ✅ User A sends message to group → broadcasts to all members
- ✅ Invalid payload (empty content) → callback with error
- ✅ Sender receives ack, recipients receive `newMessage` broadcast

**Typing Indicator:**

- ✅ User A types in conversation → User B sees `userTyping` with `isTyping: true`
- ✅ User A stops typing → User B sees `isTyping: false`

**Persistency:**

- ✅ User reloads page → REST APIs rebuild full state (conversations + message history)
- ✅ New messages arrive via Socket.IO while online → real-time updates

---
