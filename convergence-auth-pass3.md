# Convergence Pass 3 — Fresh Auth System Audit

## Audit Checklist

### A. Token Lifecycle (Creation → Storage → Transmission → Verification → Refresh → Expiry)

1. [ ] Token creation: All auth flows create JWT with correct expiry
2. [ ] Token storage: All flows store token in localStorage via setSessionToken()
3. [ ] Token transmission: All client requests send Authorization: Bearer header
4. [ ] Token verification: Server checks both cookies and Authorization header
5. [ ] Token refresh: Silent refresh works before expiry, stores new token
6. [ ] Token expiry: Expired tokens are cleared, user gets re-provisioned as guest

### B. Auth Flows (OAuth, Email, Social, Guest)

7. [ ] Manus OAuth callback: HTML bridge → localStorage → redirect
8. [ ] Google Social OAuth callback: HTML bridge → localStorage → redirect
9. [ ] LinkedIn Social OAuth callback: HTML bridge → localStorage → redirect
10. [ ] Email signIn: tRPC returns token → client stores in localStorage
11. [ ] Email signUp: tRPC returns token → client stores in localStorage
12. [ ] Guest provisioning: POST /api/auth/guest-session → token in body → localStorage
13. [ ] Guest→Authenticated upgrade: migrate-guest checks Authorization header

### C. Edge Cases

14. [ ] Token expiry during active session: useTokenRefresh handles it
15. [ ] Safari Private Browsing: sessionStorage/memory fallback
16. [ ] Cross-tab sync: storage event listener updates memory cache
17. [ ] Multiple rapid auth.me calls: retry logic doesn't cause loops
18. [ ] UNAUTHORIZED error handling: No redirect loop, graceful toast
19. [ ] Welcome-back toast: Shows after OAuth sign-in for non-guest users

### D. Security

20. [ ] Token not exposed in URL (except fragment, which isn't sent to server)
21. [ ] set-session endpoint validates token before setting cookie
22. [ ] No token leakage in logs or error messages
23. [ ] CORS/credentials handled correctly

## Findings

(To be filled during audit)

## Result

- [ ] CLEAN PASS (no issues found)
- [ ] FIXES NEEDED (counter reset)
