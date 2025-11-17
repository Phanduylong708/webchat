# Development Roadmap

## Current Status

**Phase:** Phase 5: Video Calling (NOT STARTED)
**Focus:** Prepare for 1-1 WebRTC/PeerJS integration now that chat system is complete
**Started:** 2025-10-20 (Phase 4 completed on 2025-11-17)
**Status:** Phase 4 (Chat System) COMPLETED — moving to Phase 5 planning

---

## Phase 1: Foundation

**Status:** DONE
**Focus:** Project setup, planning, database design

**Deliverables:**

- Monorepo structure (frontend/ and backend/)
- Core documentation (PRD, ROADMAP, ARCHITECTURE)
- Database schema design with Prisma
- Development environment setup (Node, React, PostgreSQL)
- Git repository initialization

---

## Phase 2: Authentication

**Status:** COMPLETED
**Focus:** User authentication with JWT (stateless)

**Backend Deliverables (COMPLETED):**

- User registration API (email, username, password)
- User login API (identifier: email OR username)
- Passport.js integration (passport-local + passport-jwt)
- JWT token generation and verification
- Protected routes middleware
- Password hashing (bcryptjs)

**Frontend Deliverables (COMPLETED):**

- Auth pages (LoginPage, SignUpPage with ShadCN UI)
- Auth state management (React Context + useAuth hook)
- Protected route wrapper (ProtectedRoute component)
- JWT storage (localStorage with axios interceptors)
- Auto-login functionality (checkAuth on app mount)
- Logout functionality (client-side with redirect)

---

## Phase 3: Friend System

**Status:** COMPLETED
**Focus:** Friend management functionality

**Backend Deliverables (COMPLETED):**

- Add friend API (POST /api/friends - auto-accept)
- Get friends list API (GET /api/friends)
- Remove friend API (DELETE /api/friends/:friendId)
- Search user API (GET /api/users/search?username=...)
- Friend service layer with business logic validation
- Friendship model with normalized IDs (userId1 < userId2)
- All endpoints protected with JWT authentication

**Frontend Deliverables (COMPLETED):**

- Nested routing architecture (HomePage wrapper + FriendsPage child route)
- Three-column layout (SideBar, FriendListPanel, MainContentPanel)
- Friend Context with ID-based selection and computed selectedFriend
- Add friend dialog with username search
- Remove friend confirmation dialog (reusable component)
- Friend profile display with status (online/last seen)
- Friends list with real-time data from backend APIs
- Error handling with scoped local states in dialogs
- Empty states and loading states

---

## Phase 4: Chat System

**Status:** COMPLETED
**Focus:** Real-time messaging (1-1 and group chat)

**Phase 4A - Backend (COMPLETED):**

**Socket.IO Infrastructure:**

- Socket.IO server integration with Express
- JWT authentication at WebSocket handshake
- Connection/disconnection handling with multi-tab support
- Room-based architecture (user rooms + conversation rooms)

**REST API Endpoints:**

- GET /api/conversations - List user's conversations with last message preview
- GET /api/conversations/:id - Get conversation details with members
- POST /api/conversations/group - Create group (minimum 3 members)
- POST /api/conversations/:id/members - Add member to group (creator only)
- DELETE /api/conversations/:id/leave - Leave group conversation
- GET /api/messages/:conversationId - Cursor-based message history pagination

**Socket.IO Events:**

- Status tracking: friendOnline, friendOffline (with multi-device handling)
- Messaging: sendMessage (with lazy 1-1 creation), newMessage broadcast
- Typing indicators: typing:start, typing:stop, userTyping
- Group management: memberAdded, addedToConversation, memberLeft

**Key Features:**

- Lazy-create 1-1 conversations on first message
- Cursor-based pagination for message history (efficient for large datasets)
- Multi-tab support (online status only when all tabs closed)
- Real-time socket room management (auto-join on add, auto-leave on removal)

**Documentation:**

- OpenAPI 3.0 specification (openapi.yaml) for all REST endpoints
- Frontend integration guide (pending completion)

**Phase 4B - Frontend (COMPLETED):**

- Conversation layout (sidebar + conversation list panel moved under layout components)
- ChatWindow header with online badge, system banner, AddMemberDialog, LeaveGroupDialog
- Message list with optimistic send & cursor pagination (InfiniteScroll)
- Socket hooks (`useConversationSockets`, `useMessageSockets`) to keep context providers lean
- Typing indicators + online status synced via Socket.IO
- Group management UI: create group dialog, add-member dialog with filtering, leave-group workflow
- Loading/error states standardized across panels
- Documentation updates for API side-effects and known limitations

---

## Phase 5: Video Calling

**Status:** Not Started  
**Focus:** WebRTC-based 1-1 video calling

**Deliverables:**

- WebRTC learning and prototyping
- WebRtc server setup
- Call signaling with Socket.IO
- Initiate call functionality
- Accept/reject call functionality
- Video and audio streaming
- Call controls (mute, camera toggle, end call)
- Call UI components

---

## Phase 6: Media Upload & Polish

**Status:** Not Started  
**Focus:** Media sharing and final improvements

**Deliverables:**

- Cloud storage integration (Cloudinary)
- Image upload and preview
- Video/file upload support
- Media display in chat
- UI/UX improvements and polish
- Bug fixes and testing
- Code cleanup and documentation
- Deployment preparation

---

## Phase 7: Deployment & Final

**Status:** Not Started  
**Focus:** Deploy and finalize project

**Deliverables:**

- Frontend deployment (Vercel)
- Backend deployment (Render)
- Database hosting setup
- Final testing on production
- README.md completion
- Presentation preparation

---

## Notes

- Timeline is flexible and will be adjusted based on progress
- Each phase builds upon the previous one
- Update "Current Status" section when moving between phases
- Detailed tasks for each phase will be tracked separately
