# Frontend Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── auth.api.ts
│   │   └── friend.api.ts
│   │
│   ├── components/
│   │   ├── ui/ (ShadCN components - no need to read)
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── field.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   └── separator.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── SideBar.tsx
│   │   │   ├── FriendListPanel.tsx
│   │   │   └── MainContentPanel.tsx
│   │   │
│   │   ├── friends/
│   │   │   ├── AddFriendDialog.tsx
│   │   │   ├── RemoveFriendDialog.tsx
│   │   │   ├── FriendProfile.tsx
│   │   │   └── EmptyState.tsx
│   │   │
│   │   └── ProtectedRoute.tsx
│   │
│   ├── contexts/
│   │   ├── authContext.tsx
│   │   └── friendContext.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.tsx
│   │   └── useFriend.tsx
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── SignUp.tsx
│   │   │
│   │   └── home/
│   │       ├── HomePage.tsx
│   │       └── FriendsPage.tsx
│   │
│   ├── types/
│   │   ├── auth.type.ts
│   │   └── friend.type.ts
│   │
│   ├── utils/
│   │   ├── localStorage.util.ts
│   │   └── date.util.ts
│   │
│   ├── lib/
│   │   ├── axios.config.ts
│   │   └── utils.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── docs/
│   ├── structure.md
│   ├── phase2/
│   │   └── plan.md
│   └── phase3/
│       └── plan.md
│
├── public/               # Public static files
├── components.json       # ShadCN configuration
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```
