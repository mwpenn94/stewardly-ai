# Plan Deliverable 12 — Preservation Protocol

## 1. Purpose

For each item in `audit/09-preservation-inventory.md`, this document specifies the operational protocol ensuring it survives the AFK run intact per v2.0.3 §1.3.

## 2. Protocol Structure

Each preservation item follows this protocol:

| Field | Description |
|-------|-------------|
| Modification Rules | When (if ever) the item gets modified, with what justification |
| Reference Update Protocol | How new references are added without breaking existing ones |
| Validation Gates | Specific validation step confirming the item works post-absorption |
| Rollback Path | Recovery procedure if absorption breaks the item |
| Customer-Facing Impact | Whether absorption requires user re-action |

## 3. Environment Variables (35 total)

### Modification Rules
- Environment variables are NEVER removed during absorption
- New variables may be added additively
- Existing variable names are immutable; values may be rotated through Settings → Secrets

### Reference Update Protocol
- All new code referencing env vars imports from `server/_core/env.ts`
- New substrate services declare their env requirements in their module header comments
- No env var is referenced by raw `process.env` outside of `_core/env.ts`

### Validation Gates
- Post-absorption: `pnpm test` includes env validation test confirming all 35 vars are accessible
- Deployment health check verifies critical vars (DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY)

### Rollback Path
- Environment variables are managed through Manus Settings → Secrets
- Rollback: restore from checkpoint; env vars persist independently of code

### Customer-Facing Impact
- None. Environment variables are platform-internal.

## 4. Third-Party Integrations

### 4.1 GoHighLevel (GHL)
- **Modification Rules**: Webhook handler at `/webhooks/ghl` is additive-only; new event types may be added
- **Validation Gates**: GHL polling test confirms connection; webhook signature verification test passes
- **Rollback Path**: Restore `server/integrations/ghl.ts` from checkpoint
- **Customer-Facing Impact**: None if webhook URL unchanged

### 4.2 Plaid
- **Modification Rules**: Plaid link flow is additive-only; new account types may be supported
- **Validation Gates**: Plaid sandbox connection test passes
- **Rollback Path**: Restore plaid router from checkpoint
- **Customer-Facing Impact**: None; existing linked accounts remain functional

### 4.3 SnapTrade
- **Modification Rules**: Portfolio sync is additive-only
- **Validation Gates**: SnapTrade API health check passes
- **Rollback Path**: Restore snaptrade service from checkpoint
- **Customer-Facing Impact**: None; existing brokerage connections persist

### 4.4 Stripe
- **Modification Rules**: New products/prices may be added; existing ones are immutable
- **Validation Gates**: Stripe webhook test event returns `{verified: true}`; checkout session creation succeeds
- **Rollback Path**: Restore stripe directory from checkpoint; Stripe Dashboard retains product state
- **Customer-Facing Impact**: None for existing subscribers

### 4.5 Deepgram
- **Modification Rules**: Voice transcription service is additive-only
- **Validation Gates**: Deepgram health check passes
- **Rollback Path**: Restore voice service from checkpoint
- **Customer-Facing Impact**: None

### 4.6 LinkedIn OAuth
- **Modification Rules**: OAuth flow is immutable; scopes may be extended
- **Validation Gates**: OAuth callback test passes
- **Rollback Path**: Restore OAuth config from checkpoint
- **Customer-Facing Impact**: None; existing sessions persist

### 4.7 Google OAuth
- **Modification Rules**: OAuth flow is immutable
- **Validation Gates**: Google OAuth callback test passes
- **Rollback Path**: Restore OAuth config from checkpoint
- **Customer-Facing Impact**: None

## 5. Database Schema

### Modification Rules
- Tables are NEVER dropped during absorption
- Columns are NEVER removed; deprecated columns are marked with comments
- New tables and columns are added via migration SQL
- Schema changes are always additive

### Validation Gates
- Post-migration: all existing queries continue to return expected results
- Drizzle schema matches actual database state

### Rollback Path
- Database data is NOT recoverable (per webdev_limitations)
- Schema rollback: reverse migration SQL prepared for each forward migration
- Data preservation: critical data exported before destructive operations (if any)

### Customer-Facing Impact
- None for additive changes
- If column semantics change: data migration script ensures continuity

## 6. Existing Routes and URLs

### Modification Rules
- No existing route is removed
- Routes may be reorganized with redirects from old paths
- New routes are added additively

### Validation Gates
- Route registry test confirms all documented routes resolve
- E2E tests exercise critical paths

### Rollback Path
- Restore App.tsx and router files from checkpoint

### Customer-Facing Impact
- None if redirects are in place for reorganized routes

## 7. User Data

### Modification Rules
- User accounts, memories, audit logs, document vault contents, configured integrations are NEVER deleted
- Data format changes include migration scripts
- New data fields are added with sensible defaults

### Validation Gates
- User authentication test passes
- Memory retrieval test returns existing data
- Document vault access test passes

### Rollback Path
- Code rollback from checkpoint; data persists in database

### Customer-Facing Impact
- None. Existing data remains accessible without migration steps.

## 8. Test Fixtures and Seeded Data

### Modification Rules
- Existing test fixtures are not modified
- New fixtures are added alongside existing ones
- Seed scripts are additive

### Validation Gates
- `pnpm test` passes with existing fixtures
- Seed script runs without errors

### Rollback Path
- Restore test files from checkpoint

### Customer-Facing Impact
- None (test-only)

## 9. Documentation

### Modification Rules
- Existing docs are updated in-place, not replaced
- New docs are added alongside existing ones
- Changelog entries are appended

### Validation Gates
- All internal links resolve
- README reflects current state

### Rollback Path
- Restore docs from checkpoint

### Customer-Facing Impact
- None (documentation is informational)

## 10. Summary

Total preservation items: 35 env vars + 7 integrations + 1 schema + all routes + all user data + all test fixtures + all docs = comprehensive preservation coverage.

**Key principle**: Additive-where-possible. When modification is unavoidable, it triggers hard escalation (§VIII.3.9) for user authorization.
