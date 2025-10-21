# Phase 3: Friend System - Frontend Implementation

**Status:** COMPLETED
**Approach:** Feature-by-feature + Bottom-up (Hybrid)

**Sub-phases:**

- **Phase 3A:** Layout Foundation - Three-column structure
- **Phase 3B:** Friend System Features - Add/View/Remove friends

---

## Architecture Overview

**Implemented Structure: Nested Routing with Layout Wrapper**

- **HomePage** - Layout wrapper with persistent SideBar (Col 1) + `<Outlet />` for child routes
- **FriendsPage** - Child route with 2-column layout (FriendListPanel + MainContentPanel)
- Routing: `/` → `/friends` (index redirect)

**Visual Layout:**

```
+--------+---------------+--------------------+
| Col 1  |    Col 2      |       Col 3        |
| SideBar| FriendList    | FriendProfile      |
|        |               | or EmptyState      |
| [F][C] | [Friends +]   |                    |
|        | [Search...]   | [Avatar]           |
|        | Friend Item   | Username           |
|        | Friend Item   | Status             |
| [User] |               | [Send] [Remove]    |
+--------+---------------+--------------------+
HomePage: grid-cols-[minmax(56px,80px)_1fr]
FriendsPage: grid-cols-[300px_1fr]
```

**Friend System Flow:**

- **View:** GET /api/friends -> Display list
- **Add:** Modal -> Username -> Search -> Add -> Refresh
- **Select:** Click friend -> Show profile
- **Remove:** Confirmation -> DELETE -> Refresh

**Key Implementation Decisions:**

- **Nested routing architecture** - HomePage as layout wrapper, child routes control content
- **ID-based friend selection** - Store `selectedFriendId` internally, expose computed `selectedFriend` object
- **Scoped error handling** - Dialogs use local error state, context error only for fetch operations
- **Reusable RemoveFriendDialog** - Accepts trigger prop, used by both FriendItem and FriendProfile
- Friend Context for state management with `useMemo` for computed values
- Modal pattern for Add/Remove (focused actions)
- Username-based adding with backend search API
- Search box placeholder only (no logic this phase)
- Send Message button disabled (Phase 4 preview)
- Bottom-up implementation approach

---

## Phase 3A: Layout Foundation

### [STEP 1] Layout Structure with Nested Routing

**Goal:** Create layout wrapper with nested routing for child pages

**Components:**

- `HomePage.tsx` - Layout wrapper with SideBar + Outlet (grid: `grid-cols-[minmax(56px,80px)_1fr]`)
- `FriendsPage.tsx` - Child route with 2-column grid (grid: `grid-cols-[300px_1fr]`)
- `SideBar.tsx` - Col 1 (persistent nav icons)
- `FriendListPanel.tsx` - Col 2 (friends list with mock data)
- `MainContentPanel.tsx` - Col 3 (generic container)

**SideBar:**

- Logo (top)
- Friends link - active with useLocation detection
- Chats disabled placeholder
- User block (bottom) - avatar, username, logout

**Routing:**

- main.tsx: Nested route structure with index redirect to `/friends`
- FriendsPage renders when `/friends` route active

### [STEP 2] Navigation State

**Implementation:** useLocation hook from react-router-dom

**Logic:**

- Detect current route with `location.pathname`
- Conditional className for active state highlighting
- Friends link active when pathname === "/friends"
- Chats remains disabled placeholder

### [STEP 3] Responsive & Polish

**Status:** DEFERRED to later phase

**Planned:**

- Mobile: Responsive sidebar and panel widths
- Tablet: Adjusted column sizing
- Desktop: Current implementation sufficient

**Completed Polish:** Hover states, transitions, spacing with CSS variables

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

interface FriendState {
  friends: Friend[];
  selectedFriendId: number | null; // Internal state
  loading: boolean;
  error: string | null;
}

interface FriendContextType {
  friends: Friend[];
  selectedFriend: Friend | null; // Computed from friends + selectedFriendId
  loading: boolean;
  error: string | null;
  fetchFriends: () => Promise<void>;
  addFriend: (
    username: string
  ) => Promise<{ success: boolean; message?: string }>;
  removeFriend: (
    friendId: number
  ) => Promise<{ success: boolean; message?: string }>;
  selectFriend: (id: number | null) => void; // ID-based selection
}
```

**Key Design:**

- ID-based selection prevents stale data issues
- Return objects for scoped error handling in dialogs
- `selectedFriend` computed with useMemo

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

**Implementation:**

- Internal state: `friends`, `selectedFriendId`, `loading`, `error`
- Computed value: `selectedFriend = useMemo(() => friends.find(f => f.id === selectedFriendId) || null, [friends, selectedFriendId])`
- No useCallback (follow authContext pattern)
- No auto-fetch in useEffect (component-controlled)

**Method Logic:**

- `addFriend(username)`: Search user -> Add by ID -> Auto-select -> Refresh -> Return `{ success, message }`
- `removeFriend(id)`: Delete -> Deselect if currently selected -> Refresh -> Return `{ success, message }`
- `selectFriend(id)`: Set `selectedFriendId` state (sync)
- `fetchFriends()`: Fetch list, only set context error for fetch failures

### [STEP 5] FriendList Component

**File:** `src/components/layout/FriendListPanel.tsx` (FriendItem inline, not separate file)

**Implementation:**

- Replace mock data with `useFriend()` hook
- Call `fetchFriends()` in useEffect on mount
- Helper function `renderFriendList()` with conditional rendering:
  - Loading state: "Loading friends..."
  - Error state with retry button (only when `error && friends.length === 0`)
  - Empty state: "No friends yet. Add some!"
  - Friend list: Map over friends array
- FriendItem inline component with click handler calling `selectFriend(friend.id)`
- Header with AddFriendDialog (replaces plain button)
- Search input disabled placeholder
- formatLastSeen helper for status display

### [STEP 6] AddFriendDialog

**File:** `src/components/friends/AddFriendDialog.tsx`

**Implementation:**

- Self-contained Dialog with trigger (Plus button)
- Local states: `isOpen`, `username`, `localError`, `isSubmitting`
- Validation: Trim input, check empty before submit
- Call `addFriend(username)` from context, check `{ success, message }` return
- On success: Clear input, close dialog
- On fail: Copy `message` to `localError` for scoped display
- Error displayed in dialog only (not global context error)

**Install:** `npx shadcn-ui add dialog`

### [STEP 7] FriendProfile Component

**Files:** `src/components/friends/FriendProfile.tsx`, `src/components/friends/EmptyState.tsx`

**FriendProfile Implementation:**

- Accepts `friend` prop from parent
- ShadCN Card component structure
- Avatar (large, centered - size-24)
- Username (text-2xl, centered)
- Status: Conditional online/offline with formatLastSeen
- Send Message button (disabled, title tooltip "Coming in Phase 4")
- Remove Friend button uses RemoveFriendDialog (reusable component)
- Local error handling with `localError` state
- Integrates with context via useFriend hook

**EmptyState Implementation:**

- Simple centered message: "Select a friend to view their profile"
- Displayed when `selectedFriend === null`

### [STEP 8] RemoveFriendDialog (Reusable Component)

**File:** `src/components/friends/RemoveFriendDialog.tsx`

**Design Pattern: Reusable with Trigger Prop**

**Props:**

- `friend: Friend` - Friend to remove
- `trigger: React.ReactNode` - Custom trigger element (button/icon)
- `onRemoved?: () => void` - Optional callback after successful removal

**Implementation:**

- Internal states: `isOpen`, `isRemoving`, `localError`
- AlertDialog structure with dynamic trigger
- Confirmation message includes friend username
- Calls `removeFriend(friend.id)` from context
- On success: Calls `onRemoved()` callback (if provided), closes dialog
- On fail: Display `localError` in dialog
- Used by both FriendItem (trash icon) and FriendProfile (button)

**Benefits:** DRY principle, consistent UX, single source of truth

**Install:** `npx shadcn-ui add alert-dialog`

### [STEP 9] Integration & Polish

**Integration:**

- FriendProvider wraps FriendsPageContent (not HomePage) - Context scoped to friends route
- FriendsPageContent component uses useFriend hook - Refactor to avoid "must be used within provider" error
- FriendListPanel calls fetchFriends() in useEffect on mount
- Loading states with conditional rendering (no skeletons implemented)
- Conditional render in FriendsPage: `selectedFriend ? <FriendProfile /> : <EmptyState />`

**Utilities:**

- `src/utils/date.util.js` - formatLastSeen() helper extracted from FriendListPanel

**Deferred:**

- Toast notifications (DEFERRED - not implemented in this phase)
- Skeleton loading states (basic text loading states used instead)

**ShadCN Components Used:** dialog, alert-dialog, avatar, card

## Files Summary

**Backend (4 files):**

- New: `src/api/services/user.service.js`
- New: `src/api/controllers/user.controller.js`
- New: `src/api/routes/user.routes.js`
- Updated: `src/server.js`

**Frontend (13 files):**

**Layout Components:**

- New: `src/components/layout/SideBar.tsx` (not NavigationBar)
- New: `src/components/layout/FriendListPanel.tsx` (FriendItem inline)
- New: `src/components/layout/MainContentPanel.tsx`

**Friend Components:**

- New: `src/components/friends/FriendProfile.tsx`
- New: `src/components/friends/AddFriendDialog.tsx`
- New: `src/components/friends/RemoveFriendDialog.tsx` (reusable)
- New: `src/components/friends/EmptyState.tsx`

**Core Infrastructure:**

- New: `src/types/friend.type.ts`
- New: `src/api/friend.api.ts`
- New: `src/contexts/friendContext.tsx`
- New: `src/hooks/useFriend.tsx`
- New: `src/utils/date.util.js` (formatLastSeen helper)

**Updated:**

- `src/pages/home/HomePage.tsx` (layout wrapper with Outlet)
- `src/pages/home/FriendsPage.tsx` (provider + content split)

**ShadCN Components:** dialog, alert-dialog, avatar, card

---

## Dependencies

**ShadCN Components Installed:**

```bash
npx shadcn-ui add dialog
npx shadcn-ui add alert-dialog
npx shadcn-ui add avatar
npx shadcn-ui add card
```

**Deferred (not installed):**

- `npm install react-hot-toast` - Toast notifications deferred
- `npx shadcn-ui add toast` - Toast component deferred

---

## Next Phase

**Phase 4: Chat System** - Real-time messaging with Socket.IO
