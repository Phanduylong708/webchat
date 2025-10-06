# Phase 2: Authentication System - Backend Implementation

**Status:** ✅ COMPLETED
**Approach:** Manual Registration + Passport.js for Login & Protected Routes
**Duration:** ~4 hours (including learning Passport, testing)

---

## Architecture Overview

**Authentication Flow:**
- Register: Manual validation → Service layer → Prisma (create user)
- Login: Passport-local verify credentials → Generate JWT → Return token
- Protected Routes: Passport-JWT extract & verify token → Attach user to req.user

**Key Decisions:**
- Stateless JWT authentication (NO sessions, NO serialize/deserialize)
- Login with identifier field (accepts email OR username)
- JWT payload: minimal (`sub: userId` only)
- JWT stored client-side in localStorage
- Logout: client-side only (remove token from storage, no backend endpoint)
- Security: Generic error messages to avoid user enumeration
- Password always excluded from API responses

---

## Implementation Summary

### ✅ STEP 1-3: Foundation Setup (from previous session)
- Express server with JSON & CORS middleware
- Prisma Client singleton with lazy connection
- Global error handling middleware

### ✅ STEP 4: User Registration (Manual Approach)

**Endpoint:** `POST /api/auth/register`

**Design Decision:** Registration kept MANUAL (not using Passport) because Passport is designed for authentication, not user creation. Registration is business logic, not authentication.

**Implementation:**
- Created utility modules: hash.util.js (bcryptjs), response.util.js (standardized responses)
- Service layer: register() function with duplicate check (OR query for email/username)
- Controller: Manual validation (email format, password length, required fields)
- Password hashed before database storage
- Response excludes password field

**Files:** auth.service.js, auth.controller.js, auth.routes.js, hash.util.js, response.util.js

### ✅ STEP 5: User Login (Passport-local + JWT)

**Endpoint:** `POST /api/auth/login`

**Packages Installed:** passport, passport-local, passport-jwt, jsonwebtoken

**Implementation:**

**JWT Utilities:**
- Created jwt.util.js with generateToken() and verifyToken() functions
- Environment variables: JWT_SECRET, JWT_EXPIRES_IN (configured as 1 day)
- JWT payload contains only `sub: userId` (minimal for security)

**Passport Configuration:**
- Created passport.config.js with multiple strategies
- Local strategy for login with custom usernameField: "identifier"
- Strategy verifies credentials using findUserByIdentifier() service function
- Generic error message "Invalid credentials" for both wrong password and user not found
- Password removed from user object before calling done()

**Service Layer:**
- Added findUserByIdentifier() function
- Prisma query with OR condition (email OR username)
- Selects password field (needed for comparison) unlike register response

**Login Route:**
- Custom callback pattern with passport.authenticate()
- Generates JWT after successful authentication
- Response format: `{ user, token }`

**Files:** jwt.util.js, passport.config.js, updated auth.service.js and auth.routes.js

### ✅ STEP 6: Protected Routes (Passport-JWT)

**Endpoint:** `GET /api/auth/me` (test endpoint)

**Implementation:**

**Passport JWT Strategy:**
- Extracts JWT from Authorization header using Bearer schema
- Verifies token signature with JWT_SECRET
- Decodes payload and extracts userId from `sub` claim
- Queries user from database (without password field)
- Attaches user object to req.user for route handlers
- Returns done(null, false) if user not found (token valid but user deleted)

**Passport Initialization:**
- Added passport.initialize() middleware to server.js
- NO session middleware (stateless approach)
- NO serialize/deserialize functions (not needed for JWT)

**Protected Route Pattern:**
- Use passport.authenticate('jwt', { session: false }) as middleware
- Route handlers access authenticated user via req.user
- Automatic 401 response if token missing or invalid

**Files:** Updated passport.config.js, auth.routes.js, server.js

### ✅ STEP 7: Testing & Verification

**Test Cases Completed:**
- Register: Success (201), Duplicate email/username (409), Validation errors (400)
- Login: Success (200 + user + token), Invalid credentials (401), Missing fields (400)
- Protected route: Valid JWT (200 + user data), No token (401), Invalid token (401)

---

## Files Structure

**Created:**
- src/shared/config/passport.config.js - Passport strategies configuration
- src/shared/utils/jwt.util.js - JWT generation and verification
- src/shared/utils/hash.util.js - Password hashing utilities
- src/shared/utils/response.util.js - Standardized response builders

**Updated:**
- src/api/services/auth.service.js - register(), findUserByIdentifier()
- src/api/controllers/auth.controller.js - registerController
- src/api/routes/auth.routes.js - /register, /login, /me routes
- src/server.js - Passport initialization
- .env - JWT_SECRET, JWT_EXPIRES_IN
- package.json - Passport packages

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | Public | Create new user (email, username, password) |
| POST | /api/auth/login | Public | Authenticate and receive JWT token |
| GET | /api/auth/me | Protected | Get current authenticated user info |

---

## Next Phase

**Frontend Implementation** - See docs/roadmap.md Phase 2 Frontend Deliverables