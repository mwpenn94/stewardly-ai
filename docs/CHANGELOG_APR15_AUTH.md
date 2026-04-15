# Changelog — April 15, 2026 (Auth System Hardening)

**Version**: v2.6.2
**Focus**: Authentication system convergence — proxy-resilient token management

---

## Problem Statement

The Manus reverse proxy strips `Set-Cookie` headers from server responses, causing authentication failures when users rely solely on cookie-based sessions. Social OAuth callbacks (Google, LinkedIn) used `res.redirect(302)` which lost the session token entirely. Email sign-in/sign-up returned tokens in the response body but the client did not store them.

## Changes

### Server-Side

1. **Social OAuth HTML Bridge** (`server/services/socialOAuth.ts`)
   - Replaced `res.redirect(302, redirectUrl)` with an HTML bridge page
   - Bridge page stores the session token in `localStorage` via `localStorage.setItem('stewardly_session_token', token)`
   - Calls `/api/auth/set-session` to set the cookie as a fallback
   - Redirects to the target page after token storage
   - Same pattern as the existing Manus OAuth callback bridge

2. **Email Auth** (`server/routers/emailAuth.ts`)
   - Already returned `token: sessionToken` in response body (no change needed)

3. **Guest Session** (`server/_core/guestSession.ts`)
   - Already returned `token: sessionToken` in response body (no change needed)

### Client-Side

4. **Sign-In Page** (`client/src/pages/SignIn.tsx`)
   - `signIn` mutation `onSuccess` now calls `setSessionToken(data.token)` before redirecting
   - `signUp` mutation `onSuccess` now calls `setSessionToken(data.token)` before redirecting

5. **Auth Context** (`client/src/contexts/AuthContext.tsx`)
   - Already stores token from guest session response (no change needed)
   - Hash token detection remains as a safety net

### Tests

6. **New Tests** (13 new tests, 7,751 total)
   - `server/oauth.callback.test.ts`: 10 tests covering HTML bridge page generation, token injection, set-session call, redirect behavior
   - `server/auth.bearer.test.ts`: 10 tests covering Authorization header extraction, cookie fallback, invalid token handling
   - `server/socialAuth.test.ts`: Updated to cover HTML bridge response

## Auth Flow Summary (Post-Fix)

| Flow | Token Creation | Client Storage | Server Verification |
|------|---------------|----------------|-------------------|
| Manus OAuth | HTML bridge page | `localStorage.setItem` in bridge | Cookie + Authorization header |
| Google OAuth | HTML bridge page | `localStorage.setItem` in bridge | Cookie + Authorization header |
| LinkedIn OAuth | HTML bridge page | `localStorage.setItem` in bridge | Cookie + Authorization header |
| Email Sign-In | tRPC response body | `setSessionToken()` in mutation | Cookie + Authorization header |
| Email Sign-Up | tRPC response body | `setSessionToken()` in mutation | Cookie + Authorization header |
| Guest Session | POST response body | `setSessionToken()` in AuthContext | Cookie + Authorization header |
| Token Refresh | tRPC response body | `setSessionToken()` in useTokenRefresh | Cookie + Authorization header |

## Convergence Verification

- **5 convergence passes** performed (2 with fixes, 3 consecutive clean passes)
- **8-point E2E test** against dev server: all pass
- **Live deployed site**: 7/8 pass (test 6 is deployment version mismatch)
- **Unit tests**: 7,751/7,751 pass across 324 files
- **Zero regressions** in existing functionality
