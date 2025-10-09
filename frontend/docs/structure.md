# Frontend Structure

```
frontend/
├── src/
│   ├── api/
│   │   # API service layer - Axios calls to backend
│   │   # Example: auth.api.ts, friends.api.ts, chat.api.ts
│   │
│   ├── components/
│   │   ├── ui/           # ShadCN components (auto-generated)
│   │   └── ...           # Custom reusable components
│   │
│   ├── contexts/
│   │   # React Context for global state
│   │   # Example: AuthContext.tsx, SocketContext.tsx
│   │
│   ├── hooks/
│   │   # Custom React hooks
│   │   # Example: useAuth.ts, useLocalStorage.ts
│   │
│   ├── pages/
│   │   # Page components (route destinations)
│   │   # Example: LoginPage.tsx, RegisterPage.tsx, DashboardPage.tsx
│   │
│   ├── types/
│   │   # TypeScript interfaces and types
│   │   # Example: auth.types.ts, user.types.ts, api.types.ts
│   │
│   ├── utils/
│   │   # Helper/utility functions
│   │   # Example: localStorage.util.ts, validation.util.ts
│   │
│   ├── lib/
│   │   ├── utils.ts      # ShadCN cn() helper
│   │   └── ...           # Library configurations
│   │
│   ├── assets/           # Static files (images, icons)
│   ├── App.tsx           # Root component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles (Tailwind)
│
├── docs/
│   ├── structure.md
│   └── phase2/
│       └── plan.md
│
├── public/               # Public static files
├── components.json       # ShadCN configuration
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```
