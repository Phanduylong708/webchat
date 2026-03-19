# Webchat

Webchat is a real-time chat application with private and group conversations, native WebRTC calling, and a collaborative whiteboard.

The repository is split into two independent packages:

- `frontend/` - React client
- `backend/` - REST API and Socket.IO server

## Features

- JWT-based authentication
- User search and friend management
- Private and group conversations
- Real-time messaging with typing indicators
- Message reply, edit, delete, and pin
- Avatar upload and chat media upload
- Native WebRTC calling
- Collaborative whiteboard during calls

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- TanStack Query
- Socket.IO client
- Fabric.js
- Zustand

### Backend

- Node.js v22.19.0
- Express 5
- Prisma ORM
- PostgreSQL
- Socket.IO
- Passport.js with JWT
- Redis
- Cloudinary

## Project Structure

```text
.
├── backend/
│   ├── prisma/
│   ├── scripts/
│   └── src/
│       ├── api/
│       ├── shared/
│       ├── sockets/
│       ├── test/
│       └── server.js
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── contexts/
│       ├── hooks/
│       ├── lib/
│       ├── pages/
│       ├── stores/
│       ├── test/
│       ├── types/
│       └── utils/
```

## Prerequisites

Before running Webchat locally, make sure you have:

- Node.js v22.19.0
- npm
- PostgreSQL
- Redis (optional for local development)
- Cloudinary account (required for avatar and media uploads)

Redis is not required for the app to start locally, but some caching and rate-limiting behavior may be reduced without it.

## Getting Started

### 1. Install dependencies

From the repository root, install dependencies in both packages:

```bash
npm install --prefix backend
```

```bash
npm install --prefix frontend
```

### 2. Configure environment variables

Create local `.env` files from the example files:

- `backend/.env.example` -> `backend/.env`
- `frontend/.env.example` -> `frontend/.env`

Backend variables include:

- `DATABASE_URL`
- `PORT`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `REDIS_HOST`
- `REDIS_PORT`

Frontend variables include:

- `VITE_API_BASE_URL`
- `VITE_SOCKET_URL`
- `VITE_ICE`

`VITE_ICE` must be a valid JSON string for the browser's `RTCConfiguration`.

Minimal local example:

```env
VITE_ICE={"iceServers":[{"urls":"stun:stun.l.google.com:19302"}]}
```

If you need TURN support for testing or restrictive networks, add one or more TURN servers to the same JSON value.

### 3. Start services

Start PostgreSQL before running the backend.

Redis is optional in local development, but recommended.

### 4. Prepare the database

From `backend/`:

```bash
npm run db:migrate
```

If needed, generate the Prisma client:

```bash
npm run db:generate
```

### 5. Run the backend

From `backend/`:

```bash
npm run dev
```

The backend runs on `PORT`, or `3000` by default.

### 6. Run the frontend

From `frontend/`:

```bash
npm run dev
```

## Available Scripts

### Backend

Run these from `backend/`:

- `npm run dev` - start the backend with Nodemon
- `npm start` - start the backend with Node
- `npm run db:migrate` - run Prisma migrations in development
- `npm run db:generate` - generate Prisma client
- `npm run db:deploy` - apply pending migrations in non-development environments
- `npm run db:studio` - open Prisma Studio
- `npm run db:reset` - reset the database and reapply migrations
- `npm run lint` - run ESLint
- `npm run lint:fix` - run ESLint with autofix
- `npm test` - run Jest tests
- `npm run test:watch` - run tests in watch mode
- `npm run test:coverage` - run tests with coverage

### Frontend

Run these from `frontend/`:

- `npm run dev` - start the Vite dev server
- `npm run build` - type-check and build the app
- `npm run preview` - preview the production build
- `npm run lint` - run ESLint
- `npm run type-check` - run TypeScript checks
- `npm test` - run Vitest
