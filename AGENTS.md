# Agent Guidelines

## Parallelization
When a task involves independent sub-tasks (e.g., research + implementation,
or exploring multiple files simultaneously), spawn parallel subagents if the
harness supports it rather than working sequentially.

For codebase exploration, prefer delegating to a subagent or running parallel
tool calls over reading files sequentially in the main session — this keeps the
main context window focused on reasoning and implementation, not raw file content.

❌ BAD: Spawn subagent to read 2-3 specific files you already know  
✅ GOOD: Spawn subagent when exploring broadly: "understand how auth works", "find all socket handlers in backend", "map out the call flow across frontend"

## Project

Real-time chat application with video calling and whiteboard.

**Backend:** Node.js, Express 5, Prisma ORM, PostgreSQL, Socket.IO, Passport.js (JWT), Cloudinary  
**Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI/ShadCN, TanStack Query, Socket.IO client, Fabric.js  
**Video:** Native WebRTC (no third-party SDK)  
**Monorepo:** `frontend/` and `backend/` are independent packages

## Codebase Map

```
backend/src/
├── api/           REST: controllers/, routes/, services/
├── sockets/       Socket.IO: handlers/, helpers/, middlewares/
├── shared/        config/, middlewares/, utils/, prisma.js
├── test/          Jest tests and mocks
└── server.js      Entry point

frontend/src/
├── pages/         Route-level components (auth/, chat/, call/, home/, dev/)
├── components/    Reusable UI (chat/, call/, friends/, layout/, profile/, ui/, whiteboard/)
├── hooks/         Logic layer (call/, context/, queries/, rtc/, sockets/, whiteboard/)
├── contexts/      App state via React Context
├── lib/           Core libraries (videocall/ — native WebRTC)
├── api/           Axios REST client functions
├── types/         TypeScript type definitions
└── utils/         Helper functions
```

## Dev Commands

```bash
# Backend
cd backend
npm run dev          # start with hot reload
npm test             # Jest
npm run lint

# Frontend
cd frontend
npm run dev          # Vite dev server
npm run type-check   # TypeScript check
npm test             # Vitest
npm run lint
```

## Workflow

1. **Understand** — Read requirements, ask clarifying questions
2. **Propose** — Present implementation plan with specific file changes
3. **Confirm** — Wait for user approval
4. **Execute** — Only then make changes
5. **Report** — Summarize what was done

## CRITICAL Rules

**No Assumptions:** When requirements or intent are unclear, ask before proceeding.

**Code Change Approval Required:** Before ANY source code change (create/edit/delete), list files to be changed and wait for explicit approval. Non-critical docs don't count as source code.

❌ BAD: "I've added 20 files to implement this feature."  
✅ GOOD: "To implement this, I plan to modify: [...]. Should I proceed?"

**Destructive Commands:** Always ask before running commands that drop data, delete files, or are hard to reverse.

## Mindset

- Break big problems into smaller steps before coding
- Discuss architecture decisions before implementing
- Premature optimization is the root of all evil
- Keep solutions simple and focused
