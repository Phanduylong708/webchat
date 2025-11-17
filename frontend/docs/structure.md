# Frontend Structure

```
frontend/
└── src/
    ├── App.tsx                       (App shell: mounts providers + router)
    ├── main.tsx                      (Vite entry point)
    ├── index.css                     (global Tailwind styles)
    │
    ├── api/
    │   ├── auth.api.ts               (login/sign-up requests)
    │   ├── friend.api.ts             (friend list, add/remove)
    │   ├── conversation.api.ts       (conversations CRUD/group actions)
    │   └── message.api.ts            (message history fetch)
    │
    ├── components/
    │   ├── ProtectedRoute.tsx        (redirects unauthenticated users)
    │   ├── chat/
    │   │   ├── AddMemberDialog.tsx   (single-select friend picker)
    │   │   ├── ChatInput.tsx         (composer + typing emitter)
    │   │   ├── ChatWindow.tsx        (header + MessageList + ChatInput)
    │   │   ├── CreateGroupDialog.tsx (multi-select create group dialog)
    │   │   ├── LeaveGroupDialog.tsx  (leave confirmation + API call)
    │   │   ├── MessageItem.tsx       (bubble UI for each message)
    │   │   ├── MessageList.tsx       (infinite scroll + typing indicator)
    │   │   └── TypingIndicator.tsx   (render names currently typing)
    │   ├── friends/
    │   │   ├── AddFriendDialog.tsx
    │   │   ├── RemoveFriendDialog.tsx
    │   │   ├── FriendProfile.tsx
    │   │   └── EmptyState.tsx
    │   ├── layout/
    │   │   ├── SideBar.tsx           (route links + logout)
    │   │   ├── FriendListPanel.tsx   (friends column)
    │   │   ├── ConversationListPanel.tsx (chat conversations column)
    │   │   └── MainContentPanel.tsx  (content wrapper)
    │   └── ui/                       (ShadCN primitives)
    │       ├── alert-dialog.tsx, button.tsx, input.tsx, etc.
    │
    ├── contexts/
    │   ├── authContext.tsx / provider (AuthProvider + state)
    │   ├── friendContext.tsx          (friend list + add/remove)
    │   ├── conversationContext.ts / provider (context + exported value type)
    │   ├── messageContext.ts / provider (messages context API)
    │   ├── socketContext.ts / provider (socket instance + status)
    │   ├── conversationProvider.tsx   (fetch/select/REST logic)
    │   ├── messageProvider.tsx        (message cache + pagination)
    │   └── socketProvider.tsx         (connect/disconnect lifecycle)
    │
    ├── hooks/
    │   ├── context/
    │   │   ├── useAuth.tsx
    │   │   ├── useConversation.tsx
    │   │   ├── useFriend.tsx
    │   │   ├── useMessage.tsx
    │   │   └── useSocket.tsx
    │   └── sockets/
    │       ├── useConversationSockets.ts (all conversation socket handlers)
    │       └── useMessageSockets.ts      (message socket handler)
    │
    ├── lib/
    │   ├── axios.config.ts           (axios instance + interceptors)
    │   └── utils.ts                  (general helpers)
    │
    ├── pages/
    │   ├── auth/
    │   │   ├── LoginPage.tsx
    │   │   └── SignUp.tsx
    │   ├── chat/
    │   │   └── ChatPage.tsx          (wraps Conversation/Friend/Message providers)
    │   └── home/
    │       ├── HomePage.tsx          (layout route)
    │       └── FriendsPage.tsx       (friends dashboard)
    │
    ├── types/
    │   ├── auth.type.ts
    │   ├── chat.type.ts
    │   ├── friend.type.ts
    │   └── socket.type.ts
    │
    └── utils/
        ├── apiError.util.ts          (normalizes Axios errors)
        ├── conversation.utils.ts     (typing map + system banner helpers)
        ├── message.utils.ts          (message map add/remove/replace)
        ├── date.util.ts
        └── localStorage.util.ts
```

## File Highlights

- **ChatWindow.tsx** – orchestrates the chat view, composes header, message list, and ChatInput while injecting dialogs for group actions.
- **ConversationListPanel.tsx** – renders conversation sidebar, wiring create-group trigger and fetching conversations on mount.
- **AddMemberDialog.tsx / LeaveGroupDialog.tsx** – group management dialogs (filter friends & leave confirmation) that call context actions directly.
- **conversationProvider.tsx** – manages conversation state/REST actions and delegates socket listeners to `useConversationSockets`.
- **messageProvider.tsx** – caches per-conversation messages, handles optimistic sends/pagination, and wires `useMessageSockets`.
- **hooks/context** – safe access to each context (throws if used outside provider) for consistent imports across the app.
- **hooks/sockets** – encapsulate Socket.IO event subscriptions so providers stay lean and easier to maintain.
- **utils/conversation.utils.ts** – reusable helpers for typing indicator state and system messages when members leave.
- **utils/message.utils.ts** – immutable Map helpers for message operations shared by providers/tests.
