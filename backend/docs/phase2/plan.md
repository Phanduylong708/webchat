⎿ Phase 2: Authentication System - Implementation Plan

    Approach: Top-down + Incremental (Test từng bước)

    ---
    STEP 1: Setup Server cơ bản

    - Code src/server.js: Express app cơ bản với middlewares (json,
    cors)
    - Test: Start server → verify chạy được trên PORT

    STEP 2: Health Check Route

    - Tạo src/api/routes/health.routes.js: Simple GET /api/health
    endpoint
    - Mount vào server.js
    - Test: GET /api/health → return "OK"

    STEP 3: Prisma Connection

    - Tạo src/shared/prisma.js: Export Prisma Client singleton
    - Import vào server.js để test connection
    - Test: Query database (SELECT 1 hoặc count users)

    STEP 4: Register Feature (Complete)

    - Tạo src/shared/utils/hash.util.js: hashPassword(),
    comparePassword()
    - Tạo src/shared/utils/response.util.js: Standardized responses
    - Tạo src/api/services/auth.service.js: register() function only
    - Tạo src/api/controllers/auth.controller.js: registerController
    only
    - Tạo src/api/routes/auth.routes.js: POST /api/auth/register
    - Mount auth routes vào server.js
    - Test: POST /api/auth/register với Thunder Client
      - Success case (201 Created)
      - Duplicate email (400 Bad Request)

    STEP 5: Login Feature

    - Tạo src/shared/config/jwt.config.js: JWT config từ .env
    - Update auth.service.js: Thêm login() function
    - Update auth.controller.js: Thêm loginController
    - Update auth.routes.js: Thêm POST /api/auth/login
    - Test: POST /api/auth/login
      - Success case (200 OK with token)
      - Wrong password (401)
      - User not found (404)

    STEP 6: Auth Middleware

    - Tạo src/api/middlewares/auth.middleware.js: verifyToken middleware
    - Tạo protected test route để verify middleware
    - Test: Protected route với/không có token

    STEP 7: Environment Variables

    - Update .env: Thêm JWT_SECRET, JWT_EXPIRES_IN, PORT, NODE_ENV

    STEP 8: Final Testing

    - Complete authentication flow test
    - Error handling verification

    STEP 9: Documentation Update

    - Update backend/docs/structure.md với files đã tạo
    - Update docs/roadmap.md: Phase 2 status → Completed

    ---
    Files sẽ tạo: ~9 files (tạo dần từng bước, test ngay)
    Estimate: 2-2.5 giờ (với testing & debugging)
    Benefit: Test được ngay mỗi bước, phát hiện lỗi sớm, dễ debug
