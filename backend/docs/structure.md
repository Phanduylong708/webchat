# Backend Structure

```
backend/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   └── auth.routes.js
│   │   ├── controllers/
│   │   │   └── auth.controller.js
│   │   ├── services/
│   │   │   └── auth.service.js
│   │   └── middlewares/
│   ├── shared/
│   │   ├── config/
│   │   ├── utils/
│   │   │   ├── hash.util.js
│   │   │   └── response.util.js
│   │   └── prisma.js
│   └── server.js
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docs/
│   ├── structure.md
│   └── phase2/
│       └── plan.md
├── .env
└── package.json
```
