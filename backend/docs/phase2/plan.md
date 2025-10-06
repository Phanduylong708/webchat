⎿ Phase 2: Authentication System - Implementation Plan (REVISED with Passport.js)

    Approach: Bottom-up + Passport.js ecosystem (Learn by doing)

    ---
    STEP 1: Setup Server cơ bản ✅ DONE

    - Code src/server.js: Express app cơ bản với middlewares (json, cors)
    - Test: Start server → verify chạy được trên PORT

    STEP 2: Health Check Route ✅ DONE

    - Tạo src/api/routes/health.routes.js: Simple GET /api/health endpoint
    - Mount vào server.js
    - Test: GET /api/health → return "OK"

    STEP 3: Prisma Connection ✅ DONE

    - Tạo src/shared/prisma.js: Export Prisma Client singleton
    - Import vào server.js để test connection
    - Test: Query database (SELECT 1 hoặc count users)

    STEP 4: Register Feature (Manual - REFACTORING to Passport)

    OLD approach (manual validation):
    - ✅ Created utils (hash, response)
    - ✅ Created service, controller, routes
    - 🔄 NEED REFACTOR: Convert to Passport-local strategy

    STEP 5: Passport Setup & Refactor (CURRENT)

    Sub-step 5.1: Install Passport packages
    - Install: passport, passport-local, passport-jwt, jsonwebtoken
    - Verify package.json

    Sub-step 5.2: Create Passport configuration
    - Tạo src/shared/config/passport.config.js
    - Configure passport-local strategy (for register/login)
    - Configure passport-jwt strategy (for protected routes)
    - Initialize Passport in server.js

    Sub-step 5.3: Create JWT utilities
    - Tạo src/shared/config/jwt.config.js: JWT secret & options từ .env
    - Tạo src/shared/utils/jwt.util.js: generateToken(), verifyToken()
    - Update .env: JWT_SECRET, JWT_EXPIRES_IN

    Sub-step 5.4: Refactor Register với Passport-local
    - Update auth.routes.js: Use passport.authenticate('local-register')
    - Simplify auth.controller.js: Remove manual validation (Passport handles)
    - Update auth.service.js: Adapt for Passport callback pattern
    - Test: POST /api/auth/register
      - Success (201 + user data without password)
      - Duplicate email/username (409)
      - Validation errors (400)

    Sub-step 5.5: Implement Login với Passport-local
    - Add 'local-login' strategy in passport.config.js
    - Add login route: POST /api/auth/login with passport.authenticate()
    - Generate JWT after successful login
    - Return { user, token }
    - Test: POST /api/auth/login
      - Success (200 + user + JWT token)
      - Invalid credentials (401 generic message)
      - Missing fields (400)

    STEP 6: Protected Routes với Passport-JWT

    - Use passport.authenticate('jwt') middleware
    - Tạo test protected route: GET /api/auth/me
    - Test:
      - With valid JWT in Authorization header → 200 + user data
      - Without token → 401 Unauthorized
      - With invalid token → 401 Unauthorized

    STEP 7: Logout (Client-side)

    - Document logout strategy: Client removes JWT from localStorage
    - No backend endpoint needed (stateless JWT)
    - Token expires after JWT_EXPIRES_IN (7 days)

    STEP 8: Final Testing

    - Complete flow: Register → Login → Access protected route
    - Error handling verification
    - JWT expiry testing

    STEP 9: Documentation Update

    - Update backend/docs/structure.md với files mới
    - Update docs/roadmap.md: Phase 2 status → Completed
    - Document Passport architecture decisions

    ---
    KEY CHANGES from original plan:
    - Use Passport.js ecosystem (passport-local + passport-jwt)
    - Stateless JWT authentication (NO sessions, NO serialize/deserialize)
    - Login with email OR username (single 'identifier' field)
    - Client-side logout (remove JWT from localStorage)
    - Authorization header with Bearer schema
    - Generic error messages for security (avoid user enumeration)

    Files structure:
    - src/shared/config/passport.config.js (NEW)
    - src/shared/config/jwt.config.js (NEW)
    - src/shared/utils/jwt.util.js (NEW)
    - src/shared/utils/hash.util.js (existing, keep)
    - src/shared/utils/response.util.js (existing, keep)
    - src/api/services/auth.service.js (refactor)
    - src/api/controllers/auth.controller.js (simplify)
    - src/api/routes/auth.routes.js (use passport middlewares)
    - src/server.js (initialize Passport)

    Estimate: 3-4 giờ (với refactoring, learning Passport, testing)
    Benefit:
    - Learn Passport ecosystem (industry standard)
    - Cleaner architecture (less boilerplate)
    - Easy to add more strategies later
    - Consistent authentication pattern
