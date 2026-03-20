# Professionals Route Bug — Root Cause Analysis

## Problem:
When a user navigates to /professionals (especially via direct URL or from the deployed site), the page fires `professionals.list` and `professionals.myRelationships` queries immediately. Both use `protectedProcedure`. If the guest session hasn't been provisioned yet (race condition), these calls fail with UNAUTHORIZED (10001), and the tRPC error propagates causing the page to show errors or trigger an auth redirect loop.

## Evidence:
- Network logs show `professionals.list` and `professionals.myRelationships` returning UNAUTHORIZED errors
- The `auth.me` in the same batch succeeds (returns user data)
- But the session cookie may not be set yet when navigating directly to /professionals

## Fix Strategy:
1. Change `professionals.list` to use `publicProcedure` — browsing the directory should be public
2. Make `professionals.myRelationships` query conditional on user being authenticated in the frontend
3. Make `professionals.match` use `publicProcedure` for basic matching, only use protectedProcedure for personalized tier 1/2 matching
4. Add `retry: 1` and error handling in the frontend to gracefully handle transient auth failures
5. Ensure the ProfessionalDirectory page doesn't crash on UNAUTHORIZED — show empty state instead
