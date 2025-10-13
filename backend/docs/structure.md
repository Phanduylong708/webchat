# Backend Structure

```
backend/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   └── friend.routes.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   └── friend.controller.js
│   │   ├── services/
│   │   │   ├── auth.service.js
│   │   │   └── friend.service.js
│   │   └── middlewares/
│   ├── shared/
│   │   ├── config/
│   │   │   └── passport.config.js
│   │   ├── utils/
│   │   │   ├── hash.util.js
│   │   │   ├── jwt.util.js
│   │   │   └── response.util.js
│   │   └── prisma.js
│   └── server.js
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docs/
│   ├── structure.md
│   ├── phase2/
│   │   └── plan.md
│   └── phase3/
│       └── plan.md
├── .env
└── package.json
```

## Architecture Pattern

**Layer Structure:** Routes → Controllers → Services → Database (Prisma)

**Phase 2 (Authentication):**
- `auth.routes.js` - Auth endpoints (register, login, /me)
- `auth.controller.js` - HTTP layer (validation, parsing)
- `auth.service.js` - Business logic (user operations)

**Phase 3 (Friend System):**
- `friend.routes.js` - Friend endpoints (add, get, remove)
- `friend.controller.js` - HTTP layer (validation, parsing)
- `friend.service.js` - Business logic (friendship operations)

**Shared Resources:**
- `passport.config.js` - Passport strategies (Local, JWT)
- `hash.util.js` - Password hashing (bcryptjs)
- `jwt.util.js` - JWT token generation/verification
- `response.util.js` - Standardized API responses
- `prisma.js` - Prisma client instance
```
