# Frontend Structure

```
frontend/
├── src/
│   ├── api/
│   │   # API service layer - Axios calls to backend
│   │   └── auth.api.ts
│   │
│   ├── components/
│   │   ├── ui/           # ShadCN components (auto-generated)
│   │   └── ...           # Custom reusable components
│   │
│   ├── contexts/
│   │   # React Context for global state
│   │   └── authContext.tsx
│   │
│   ├── hooks/
│   │   # Custom React hooks
│   │   └── useAuth.tsx
│   │
│   ├── pages/
│   │   # Page components (route destinations)
│   │   # Example: LoginPage.tsx, RegisterPage.tsx, DashboardPage.tsx
│   │
│   ├── types/
│   │   # TypeScript interfaces and types
│   │   └── auth.type.ts
│   │
│   ├── utils/
│   │   # Helper/utility functions
│   │   └── localStorage.util.ts
│   │
│   ├── lib/
│   │   ├── utils.ts      # ShadCN cn() helper
│   │   └── axios.config.ts
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
