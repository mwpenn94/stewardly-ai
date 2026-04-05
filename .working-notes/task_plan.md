# Security Audit & Spec Compliance — Task Plan

## Goal
Comprehensive codebase audit covering two dimensions:
1. **Security audit** — identify and remediate vulnerabilities across the full stack
2. **Spec compliance** — compare the codebase against PLATFORM_GUIDE_v15.md and INTEGRATION_PIPELINE_SPEC.md, fix gaps

## Scope
- 483 TypeScript files, 53 tRPC router modules, 104 services, 63 test files
- Full-stack: React 19 frontend, Express + tRPC backend, MySQL/Drizzle ORM
- Sensitive domain: financial advisory platform handling PII, investment data, compliance

## Phases

### Phase 1: Critical Security Fixes
- S1: Unauthenticated guest data migration endpoint (`guestSession.ts`)
- S2: XSS via unsanitized `dangerouslySetInnerHTML` (`EmailCampaigns.tsx`)
- S3: WebSocket CORS `origin: "*"` allowing any site to connect (`websocketNotifications.ts`)

### Phase 2: High Severity Security Fixes
- S4: Security headers defined but never applied as middleware
- S5: CSP allows `unsafe-eval` and `unsafe-inline`
- S6: Hardcoded encryption key fallback in production
- S7: Cookie `sameSite: "none"` on a financial platform
- S8: 1-year session duration for authenticated users

### Phase 3: Medium Severity Fixes
- S9: No application-level rate limiting on API
- S10: 50MB body size limit enabling DoS
- S11: No explicit CORS middleware for HTTP
- S12: Incomplete RBAC — 8+ TODO stubs in routers.ts with `if (true) { throw }`
- S13: Unsafe `JSON.parse` without try-catch in encryption service

### Phase 4: Spec Compliance Gaps
- G1: Hash chain audit logging (spec requires tamper-evident logging)
- G2: DSAR fulfillment pipeline (only returns metadata, no actual data export)
- G3: Role elevation auto-revoke (table exists, no scheduled revocation)
- G4: Spec "remaining work" section lists MFA/CSP as unimplemented but they exist

### Phase 5: Low Severity Improvements
- L1: Silent env var defaults mask misconfiguration in production
- L2: No `.env.example` documenting required variables
- L3: Cookie domain scoping logic commented out
- L4: Spec accuracy update

## Key Questions Answered During Audit

| Question | Answer |
|----------|--------|
| Does the User type have `organizationId`? | No — org membership is in `userOrganizationRoles` join table. Users have `affiliateOrgId` for primary org. |
| What is the messages table called? | `messages` (not `conversationMessages`) |
| What does `getAccessibleDocuments` accept? | `string[]` of visibility levels, not a user ID |
| Are security headers applied anywhere? | No — defined in `getCSPHeaders()` but only exposed as admin API query |
| Is rate limiting implemented? | Utility exists in `mfaService.ts` but never wired as middleware |
| How many pre-existing TS errors? | ~30 errors in `deepContextAssembler.ts`, `emailCampaign.ts`, `multiModal.ts`, etc. — all pre-existing |
| How many pre-existing test failures? | 111 failures, all "Database not available" (no DB in CI) |

## Errors Encountered During Implementation

| Error | Cause | Resolution |
|-------|-------|------------|
| `Property 'organizationId' does not exist on type User` | Used `organizationId` but User schema uses `affiliateOrgId` | Changed all references to `ctx.user.affiliateOrgId` |
| `Property 'conversationMessages' does not exist` | Used wrong table name in DSAR export | Changed to `messages` |
| `Argument of type 'number' is not assignable to 'string[]'` | `getAccessibleDocuments` takes visibility levels, not user ID | Passed `["private", "professional", "management"]` arrays |
| `import crypto` placed mid-file in db.ts | Added inline import inside function section | Moved to top-level imports |

---

## Round 2: Environment & Database Audit (March 26, 2026)

### Goal
Audit the live environment variables, database configuration, and Manus runtime artifacts for security issues and schema drift.

### Phases

#### Phase R2-1: Credential Exposure Audit
- Audit `.manus/db/` directory (175 JSON query log files)
- Check for credentials, connection strings, passwords in committed files
- Verify `.gitignore` coverage

#### Phase R2-2: Database Schema Drift
- Compare 262 Drizzle schema tables vs live TiDB Cloud instance
- Identify undeployed tables and missing columns
- Assess impact on audit v4 features (hash chain, DSAR, role elevation)

#### Phase R2-3: Environment Variable Audit
- Verify env var loading pattern (dotenv, env.ts)
- Check for hardcoded connection strings
- Assess database connection security (TLS, pooling)

### Key Questions Answered

| Question | Answer |
|----------|--------|
| Are DB credentials committed to git? | YES — 175 files in `.manus/db/` contain TiDB Cloud host, port, username, database name in plaintext |
| Is `.manus/db/` in `.gitignore`? | NO — it was NOT gitignored; all 175 files are tracked in git history |
| How many Drizzle tables are deployed? | 131 of 262 (exactly 50%) |
| Do the audit v4 features work in prod? | NO — `role_elevations`, `consent_tracking`, audit `entryHash`/`previousHash` columns are not deployed |
| Are credentials hardcoded in source? | NO — only in `.manus/db/` query logs; source code uses env vars correctly |
| Is TLS used for DB connection? | Likely enforced by TiDB Cloud, but not explicit in connection commands |

### Errors / Issues Found

| Issue | Severity | Resolution |
|-------|----------|------------|
| 175 DB query log files with credentials tracked in git | CRITICAL | Added `.manus/db/` to `.gitignore`, removed from git index |
| 131 Drizzle tables not deployed to live DB | HIGH | Documented in `db-schema-drift.md`; needs `pnpm run db:push` |
| Audit v4 hash chain columns not in live DB | MEDIUM | Will be deployed with `db:push` |
| `role_elevations` table not deployed (auto-revoke target) | MEDIUM | Will be deployed with `db:push` |
| `consent_tracking` table not deployed (DSAR target) | MEDIUM | Will be deployed with `db:push` |
