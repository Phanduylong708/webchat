# Phase 2: Authentication System - Frontend Implementation

**Status:** ⏳ PENDING
**Approach:** Feature-by-feature + Bottom-up (Hybrid)
**Estimated Duration:** TBD

---

## Architecture Overview

**Authentication Flow:**
- Register: Form validation → API call → Success message → Redirect to login
- Login: Form validation → API call → Store JWT in localStorage → Update AuthContext → Redirect to dashboard
- Protected Routes: Check AuthContext → If not authenticated → Redirect to login
- Auto-login: On app load → Check localStorage for JWT → Call /me API → Update AuthContext
- Logout: Clear JWT from localStorage → Clear AuthContext → Redirect to login

**Key Decisions:**
- React Context for auth state management (no Redux/Zustand)
- JWT stored in localStorage (matches backend design)
- Axios for HTTP calls with interceptors for token attachment
- React Router v7 for routing and protected routes
- TypeScript for type safety (learning by doing)
- ShadCN UI components for forms and UI elements
- Bottom-up within each feature (Types → Utils → API → Context → Pages)

---

## Implementation Summary

### ⏳ STEP 1: Foundation Setup

**TypeScript Types:**
- User interface (id, email, username, createdAt, etc.)
- API request/response types (LoginRequest, RegisterRequest, AuthResponse)
- Context state types (AuthState, AuthContextType)

**Utilities:**
- localStorage helpers (saveToken, getToken, removeToken)
- Axios base configuration (base URL, headers)

**Files:** types/user.types.ts, types/api.types.ts, types/auth.types.ts, utils/localStorage.util.ts, lib/axios.config.ts

### ⏳ STEP 2: API Service Layer

**API Functions:**
- registerUser(email, username, password) → POST /api/auth/register
- loginUser(identifier, password) → POST /api/auth/login
- getCurrentUser() → GET /api/auth/me (with JWT header)

**Error Handling:**
- Axios interceptors for request (attach JWT) and response (handle errors)
- Type-safe response parsing

**Files:** api/auth.api.ts

### ⏳ STEP 3: Auth Context & State Management

**AuthContext:**
- State: user (User | null), loading (boolean), error (string | null)
- Actions: login(identifier, password), register(email, username, password), logout(), checkAuth()
- Provider wraps entire app in App.tsx

**Logic:**
- login: Call API → Save token → Set user state
- register: Call API → Show success → Navigate to login
- logout: Remove token → Clear user state
- checkAuth: Get token → Call /me API → Set user (for auto-login)

**Files:** contexts/AuthContext.tsx, hooks/useAuth.ts

### ⏳ STEP 4: Login Feature (UI)

**Login Page:**
- Form with identifier (email/username) and password fields
- ShadCN components: Card, Input, Button, Label
- Form validation (required fields, password length)
- Error display from AuthContext
- Link to Register page
- Submit → useAuth().login()

**Routing:**
- Setup React Router in App.tsx
- Route: /login → LoginPage

**Files:** pages/LoginPage.tsx, App.tsx (router setup)

### ⏳ STEP 5: Register Feature (UI)

**Register Page:**
- Form with email, username, password fields
- Form validation (email format, password ≥ 6 chars, required fields)
- Error display from AuthContext
- Success message → Redirect to /login
- Link to Login page
- Submit → useAuth().register()

**Routing:**
- Route: /register → RegisterPage

**Files:** pages/RegisterPage.tsx

### ⏳ STEP 6: Protected Routes & Auto-login

**Protected Route Wrapper:**
- Component that checks if user is authenticated
- If not → Redirect to /login
- If yes → Render children

**Auto-login Logic:**
- On app mount → checkAuth() in AuthContext
- Read token from localStorage → Call /me API
- If valid → Set user state
- If invalid → Remove token

**Dashboard Page:**
- Simple page to test protected routes
- Display user info (username, email)
- Logout button

**Routing:**
- Route: / → Protected → DashboardPage
- Route: /login → Public
- Route: /register → Public

**Files:** components/ProtectedRoute.tsx, pages/DashboardPage.tsx, updated App.tsx

### ⏳ STEP 7: Testing & Verification

**Manual Test Cases:**
- Register: Valid data (success), Duplicate email/username (error), Validation errors
- Login: Valid credentials (success + redirect), Invalid credentials (error), Missing fields
- Protected routes: Access without login (redirect to /login), Access with login (success)
- Auto-login: Refresh page with valid token (stay logged in), Invalid/no token (stay logged out)
- Logout: Clear state, clear localStorage, redirect to /login

---

## Files Structure

**To be Created:**
- src/types/user.types.ts - User interface
- src/types/api.types.ts - API request/response types
- src/types/auth.types.ts - Auth context types
- src/utils/localStorage.util.ts - localStorage helpers
- src/lib/axios.config.ts - Axios instance configuration
- src/api/auth.api.ts - Auth API functions
- src/contexts/AuthContext.tsx - Auth context provider
- src/hooks/useAuth.ts - Auth context consumer hook
- src/pages/LoginPage.tsx - Login page component
- src/pages/RegisterPage.tsx - Register page component
- src/pages/DashboardPage.tsx - Protected dashboard page
- src/components/ProtectedRoute.tsx - Protected route wrapper

**To be Updated:**
- src/App.tsx - Router setup, AuthProvider, routes
- src/main.tsx - Wrap with BrowserRouter (if needed)

---

## Routes

| Path | Component | Auth | Description |
|------|-----------|------|-------------|
| /login | LoginPage | Public | User login form |
| /register | RegisterPage | Public | User registration form |
| / | DashboardPage | Protected | Main app dashboard (test page) |

---

## Next Phase

**Phase 3: Friend System** - See docs/roadmap.md Phase 3 Deliverables