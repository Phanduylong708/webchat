# Phase 3: Friend System - Frontend Implementation

**Status:** PENDING
**Approach:** Feature-by-feature + Bottom-up (Hybrid)

**Sub-phases:**

- **Phase 3A:** Layout Foundation - Three-column structure
- **Phase 3B:** Friend System Features - Add/View/Remove friends

---

## Architecture Overview

**Three-Column Layout:**

```
+--------+---------------+--------------------+
| Col 1  |    Col 2      |       Col 3        |
| Nav    | FriendList    | FriendProfile      |
|        |               | or EmptyState      |
| [F][C] | [Friends +]   |                    |
|        | [Search...]   | [Avatar]           |
|        | Friend Item   | Username           |
|        | Friend Item   | Status             |
| [User] |               | [Send] [Remove]    |
+--------+---------------+--------------------+
```

**Friend System Flow:**

- **View:** GET /api/friends -> Display list
- **Add:** Modal -> Username -> Search -> Add -> Refresh
- **Select:** Click friend -> Show profile
- **Remove:** Confirmation -> DELETE -> Refresh

**Key Decisions:**

- Three-column layout for scalability (future: Chats, Groups)
- Friend Context for state management
- Modal pattern for Add/Remove (focused actions)
- Username-based adding (requires new backend search API)
- Search box placeholder only (no logic this phase)
- Send Message button disabled (Phase 4 preview)
- Bottom up approach for each sub-phase
- THE PLAN DO NOT PRESENT THE FINAL DECISION, DURING IMPLEMENTATION DIFFERENT CHOICE CAN BE MAKE IF THE CHOICE IS SUPPOSEDLY BETTER THAN THE PLAN DECISION.

---

## Phase 3A: Layout Foundation

### [STEP 1] HomePage Restructure

**Goal:** Transform HomePage to three-column layout

**Components:**

- `HomePage.tsx` - Grid container
- `NavigationBar.tsx` - Col 1 (nav icons)
- `FriendListPanel.tsx` - Col 2 (placeholder)
- `MainContentPanel.tsx` - Col 3 (empty state)

**NavigationBar:**

- Logo (top)
- Friends icon - active default
- Chats icon - disabled, tooltip "Coming soon"
- User block (bottom) - avatar, username, logout

**Styling:**

- Grid: `grid-cols-[80px_300px_1fr]`, `h-screen`
- Col 1: `bg-gray-900`, Col 2: `bg-gray-100`, Col 3: `bg-white`

### [STEP 2] Navigation State

**State:** `type NavItem = 'friends' | 'chats'`

**Logic:**

- Friends active by default
- Chats disabled
- Pass activeNav to panels

### [STEP 3] Responsive & Polish

**Responsive:**

- Mobile: 40px nav width
- Tablet: 250px list width
- Desktop: 80px | 300px | remaining

**Polish:** Hover states, transitions, spacing

---

## Phase 3B: Friend System Features

### [STEP 1] Backend - Search User API

**Endpoint:** `GET /api/users/search?username=<string>`

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 5,
      "username": "john",
      "avatar": "...",
      "isOnline": true,
      "lastSeen": null
    }
  }
}
```

**Files:**

- New: `backend/src/api/services/user.service.js`
- New: `backend/src/api/controllers/user.controller.js`
- New: `backend/src/api/routes/user.routes.js`
- Updated: `backend/src/server.js`

### [STEP 2] Frontend Types

**File:** `src/types/friend.type.ts`

```typescript
interface Friend {
  id: number;
  username: string;
  avatar: string | null;
  isOnline: boolean;
  lastSeen: Date | null;
}

interface FriendContextType {
  friends: Friend[];
  selectedFriend: Friend | null;
  loading: boolean;
  error: string | null;
  fetchFriends: () => Promise<void>;
  addFriend: (username: string) => Promise<void>;
  removeFriend: (friendId: number) => Promise<void>;
  selectFriend: (friend: Friend | null) => void;
}
```

### [STEP 3] Friend API Layer

**File:** `src/api/friend.api.ts`

```typescript
async function getFriends(): Promise<Friend[]>;
async function addFriendById(friendId: number): Promise<Friend>;
async function removeFriendById(friendId: number): Promise<void>;
async function searchUserByUsername(username: string): Promise<Friend>;
```

**Error Handling:** Similar to auth.api.ts (404, 409, 400 cases)

### [STEP 4] Friend Context

**Files:** `src/contexts/friendContext.tsx`, `src/hooks/useFriend.tsx`

**Logic:**

- `addFriend(username)`: Search user -> Add by ID -> Refresh
- `removeFriend(id)`: Delete -> Refresh
- `selectFriend(friend)`: Set state

### [STEP 5] FriendList Component

**File:** `src/components/layout/FriendListPanel.tsx`, `src/components/friends/FriendItem.tsx`

**Structure:**

- Header: Title + [+] button
- Search input (disabled placeholder)
- Friend items: Avatar, username, status (online/last seen)
- Empty state: Message + CTA button

### [STEP 6] AddFriendDialog

**File:** `src/components/friends/AddFriendDialog.tsx`

**Modal:** Username input -> Add button -> Success/Error handling

**Errors:** User not found (404), Already friends (409), Can't add self (400)

**Install:** `npx shadcn-ui add dialog`

### [STEP 7] FriendProfile Component

**Files:** `src/components/friends/FriendProfile.tsx`, `src/components/friends/EmptyState.tsx`

**Profile Card:**

- Avatar (large)
- Username
- Status (online/last seen)
- Send Message (disabled, tooltip)
- Remove Friend (destructive)

### [STEP 8] RemoveFriendDialog

**File:** `src/components/friends/RemoveFriendDialog.tsx`

**Confirmation:** AlertDialog -> Confirm/Cancel -> Remove action

**Install:** `npx shadcn-ui add alert-dialog`

### [STEP 9] Integration & Polish

**Integration:**

- Wrap HomePage with FriendProvider
- Call fetchFriends() on mount
- Loading states (skeletons)
- Toast notifications

**Utilities:** `src/utils/date.util.ts` - formatLastSeen()

**Install:** `npm install react-hot-toast`, `npx shadcn-ui add avatar toast`

### [STEP 10] Testing

**Phase 3A:**

- [ ] Three columns render correctly
- [ ] Navigation responds to clicks
- [ ] User profile shows and logout works
- [ ] Responsive layout

**Phase 3B:**

- [ ] Empty state when no friends
- [ ] Add friend modal works
- [ ] Search by username (success/error)
- [ ] Friend appears in list after add
- [ ] Error handling (409, 400)
- [ ] Select friend shows profile
- [ ] Status displays correctly
- [ ] Remove confirmation works
- [ ] List refreshes after actions

---

## Files Summary

**Backend (4 files):**

- New: user.service.js, user.controller.js, user.routes.js
- Updated: server.js

**Frontend (14 files):**

- New: NavigationBar, FriendListPanel, MainContentPanel (layout)
- New: friend.type.ts, friend.api.ts, friendContext.tsx, useFriend.tsx
- New: FriendItem, FriendProfile, AddFriendDialog, RemoveFriendDialog, EmptyState, date.util.ts
- Updated: HomePage.tsx, auth.type.ts (avatar field)

**ShadCN:** dialog, alert-dialog, avatar, toast

---

## Dependencies

```bash
npm install react-hot-toast
npx shadcn-ui add dialog alert-dialog avatar toast
```

---

## Next Phase

**Phase 4: Chat System** - Real-time messaging with Socket.IO
