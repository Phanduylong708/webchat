# Frontend Structure

```
frontend/
├── src/
│   ├── api/
│   │   └── auth.api.ts
│   │
│   ├── components/
│   │   ├── ui/ (Shadcn components no need to read)
│   │   │   ├── button.tsx
│   │   │   ├── field.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   └── separator.tsx
│   │   └── ProtectedRoute.tsx
│   │
│   ├── contexts/
│   │   └── authContext.tsx
│   │
│   ├── hooks/
│   │   └── useAuth.tsx
│   │
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── LoginPage.tsx
│   │   └── SignUp.tsx
│   │
│   ├── types/
│   │   └── auth.type.ts
│   │
│   ├── utils/
│   │   └── localStorage.util.ts
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
