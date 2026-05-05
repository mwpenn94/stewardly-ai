# audit/09 — Preservation Inventory

**Generated:** 2026-05-05 | **Pass:** Phase 0 Audit

Per v2.0.3 §1.2, this is the comprehensive enumeration of every preservation target. Anti-skim rule: the audit enumerates, not summarizes.

---

## 1. Environment Variables (35 configured)

| Variable | Where Referenced | Deployed Value State | Modification Risk |
|----------|----------------|---------------------|-------------------|
| `DATABASE_URL` | `server/_core/`, drizzle config | Active (TiDB) | None — untouched |
| `JWT_SECRET` | `server/_core/context.ts` | Active | None — untouched |
| `VITE_APP_ID` | `client/src/const.ts` | Active | None — untouched |
| `OAUTH_SERVER_URL` | `server/_core/oauth.ts` | Active (api.manus.im) | None — untouched |
| `VITE_OAUTH_PORTAL_URL` | `client/src/const.ts` | Active | None — untouched |
| `OWNER_OPEN_ID` | Auth middleware | Active | None — untouched |
| `OWNER_NAME` | Auth middleware | Active | None — untouched |
| `BUILT_IN_FORGE_API_URL` | `server/_core/llm.ts` | Active | None — untouched |
| `BUILT_IN_FORGE_API_KEY` | `server/_core/llm.ts` | Active | None — untouched |
| `VITE_FRONTEND_FORGE_API_KEY` | Client-side AI calls | Active | None — untouched |
| `VITE_FRONTEND_FORGE_API_URL` | Client-side AI calls | Active | None — untouched |
| `GHL_API_KEY` | `server/services/ghlOutboundSync.ts`, GHL routers | Active | None — untouched |
| `GHL_LOCATION_ID` | GHL services | Active | None — untouched |
| `GHL_WEBHOOK_SECRET` | `server/routers/ghlWebhook.ts` | Active | None — untouched |
| `PLAID_CLIENT_ID` | Plaid service | Active | None — untouched |
| `PLAID_SECRET` | Plaid service | Active | None — untouched |
| `SNAPTRADE_CLIENT_ID` | SnapTrade service | Active | None — untouched |
| `SNAPTRADE_CONSUMER_KEY` | SnapTrade service | Active | None — untouched |
| `STRIPE_SECRET_KEY` | `server/stripe/billingRouter.ts` | Active (test mode) | None — untouched |
| `STRIPE_WEBHOOK_SECRET` | `server/stripe/webhookHandler.ts` | Active | None — untouched |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Client checkout | Active (test mode) | None — untouched |
| `FRED_API_KEY` | `server/services/financialData/adapters/fredAdapter.ts` | Active | None — untouched |
| `BLS_API_KEY` | `server/services/financialData/adapters/blsAdapter.ts` | Active | None — untouched |
| `BEA_API_KEY` | `server/services/financialData/adapters/beaAdapter.ts` | Active | None — untouched |
| `CENSUS_API_KEY` | `server/services/planning/censusApiClient.ts` | Active | None — untouched |
| `DAILY_API_KEY` | Daily.co video service | Active | None — untouched |
| `DEEPGRAM_API_KEY` | Deepgram transcription | Active | None — untouched |
| `RESEND_API_KEY` | Email service | Active | None — untouched |
| `LINKEDIN_CLIENT_ID` | `server/services/socialOAuth.ts` | Active | None — untouched |
| `LINKEDIN_CLIENT_SECRET` | `server/services/socialOAuth.ts` | Active | None — untouched |
| `GOOGLE_CLIENT_ID` | `server/services/socialOAuth.ts` | Active | None — untouched |
| `GOOGLE_CLIENT_SECRET` | `server/services/socialOAuth.ts` | Active | None — untouched |
| `INTEGRATION_ENCRYPTION_KEY` | Integration secret storage | Active | None — untouched |
| `ALLOWED_ORIGINS` | Express CORS middleware | Active | None — untouched |
| `VITE_ANALYTICS_ENDPOINT` | Analytics | Active | None — untouched |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics | Active | None — untouched |
| `VITE_APP_LOGO` | Brand logo URL | Active | None — untouched |
| `VITE_APP_TITLE` | App title | Active | None — untouched |

**Verification method:** After absorption, `grep -r "process.env\|import.meta.env" server/ client/src/` produces identical variable references.

---

## 2. Third-Party Integrations

### 2.1 GoHighLevel (GHL)

| Aspect | Detail |
|--------|--------|
| Webhook URL | `/api/trpc/ghlWebhook.*` (tRPC router) |
| Callback URLs | None (webhook-only inbound) |
| OAuth scopes | N/A (API key auth) |
| API key reference | `GHL_API_KEY` env var |
| Rate limits | Per GHL plan (typically 100 req/min) |
| Retry logic | `server/routers/ghlWebhook.ts` — fire-and-forget outbound |
| Outbound sync | `server/services/ghlOutboundSync.ts` — push leads to GHL |
| Events received | Contact created/updated, opportunity stage changes |

### 2.2 Plaid

| Aspect | Detail |
|--------|--------|
| Integration type | Link token + item exchange |
| API key reference | `PLAID_CLIENT_ID`, `PLAID_SECRET` |
| Client library | `react-plaid-link` (frontend) |
| Server adapter | `server/services/financialData/adapters/plaidAdapter.ts` |
| Rate limits | Per Plaid plan |

### 2.3 SnapTrade

| Aspect | Detail |
|--------|--------|
| Integration type | Brokerage connection |
| API key reference | `SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY` |
| Server service | `server/services/snapTrade.ts` |

### 2.4 Stripe

| Aspect | Detail |
|--------|--------|
| Webhook URL | `/api/stripe/webhook` (Express raw body) |
| API key reference | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Client key | `VITE_STRIPE_PUBLISHABLE_KEY` |
| Products | 3 tiers (Starter/Professional/Enterprise) |
| Test mode | Active (sandbox claimed) |

### 2.5 FRED API

| Aspect | Detail |
|--------|--------|
| Integration type | REST API (economic data) |
| API key reference | `FRED_API_KEY` |
| Adapter | `server/services/financialData/adapters/fredAdapter.ts` |
| Data used | SOFR rates, economic indicators |
| Rate limits | 120 requests/minute |

### 2.6 BLS API

| Aspect | Detail |
|--------|--------|
| Integration type | REST API (labor statistics) |
| API key reference | `BLS_API_KEY` |
| Adapter | `server/services/financialData/adapters/blsAdapter.ts` |

### 2.7 BEA API

| Aspect | Detail |
|--------|--------|
| Integration type | REST API (economic analysis) |
| API key reference | `BEA_API_KEY` |
| Adapter | `server/services/financialData/adapters/beaAdapter.ts` |

### 2.8 Census API

| Aspect | Detail |
|--------|--------|
| Integration type | REST API (demographics) |
| API key reference | `CENSUS_API_KEY` |
| Client | `server/services/planning/censusApiClient.ts` |

### 2.9 Daily.co

| Aspect | Detail |
|--------|--------|
| Integration type | Video meeting rooms |
| API key reference | `DAILY_API_KEY` |

### 2.10 Deepgram

| Aspect | Detail |
|--------|--------|
| Integration type | Voice transcription |
| API key reference | `DEEPGRAM_API_KEY` |

### 2.11 Resend

| Aspect | Detail |
|--------|--------|
| Integration type | Email delivery |
| API key reference | `RESEND_API_KEY` |

### 2.12 LinkedIn OAuth

| Aspect | Detail |
|--------|--------|
| Integration type | Social login |
| API key reference | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| Service | `server/services/socialOAuth.ts` |

### 2.13 Google OAuth

| Aspect | Detail |
|--------|--------|
| Integration type | Social login |
| API key reference | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Service | `server/services/socialOAuth.ts` |

---

## 3. Documentation Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `recursive-optimization-spec.md` | Canonical optimization methodology (v8.4) | Active — defines build loop |
| `todo.md` (9,479 lines, 190 passes) | Complete pass history | Active — append-only |
| `audit/01-stewardly-ai-current-state.md` | This audit series | New — append-only |
| `audit/02-manus-next-app-current-state.md` | This audit series | New — append-only |
| `audit/03-gap-analysis.md` | This audit series | New — append-only |
| `audit/04-preservation-targets.md` | This audit series | New — append-only |
| `audit/05-substrate-primitives.md` | This audit series | New — append-only |
| `audit/06-pricing-billing-mv.md` | This audit series | New — append-only |
| `audit/07-manus-next-app-ux-language.md` | This audit series | New — append-only |
| `audit/08-compliance-regulatory.md` | This audit series | New — append-only |
| `audit/09-preservation-inventory.md` | This document | New — append-only |

---

## 4. Deployment Configuration

| Item | State |
|------|-------|
| Live URL | stewardly.manus.space |
| Hosting | Manus platform (managed) |
| Dev server port | 3000 (Express + Vite bridge) |
| Database | TiDB (MySQL-compatible, cloud) |
| Storage | S3 (platform-provided) |
| Schema version | Current (180+ tables via Drizzle) |
| Feature flags | Progressive disclosure (4 levels), role-based access (5 roles) |

---

## 5. Test Fixtures and Seeded Data

| Item | Location | Purpose | Valid After Absorption? |
|------|----------|---------|----------------------|
| 527 test files | `server/**/*.test.ts` | Unit/integration tests | Yes — tests are self-contained |
| Calculator test fixtures | `server/shared/calculators/*.test.ts` | 656 deterministic tests | Yes — pure functions |
| Learning test fixtures | `server/services/learning/*.test.ts` | SRS algorithm tests | Yes — pure functions |
| Auth logout test | `server/auth.logout.test.ts` | Reference test pattern | Yes |
| Vitest config | `vitest.config.ts` | Test runner config | Yes — may need alias additions |

---

## 6. Existing Pass-Numbered Artifacts

| Pass Range | What Was Introduced | Dependencies |
|-----------|--------------------|----|
| Pass 1–53 | Calculator dedup, UWE/BIE/HE/SCUI canonical | 656 tests |
| Pass 53–98 | Stewardship Gold theme, design system | index.css tokens |
| Pass 98–130 | PersonaSidebar5, navigation simplification | AppShell, role system |
| Pass 130–150 | Audio study, spaced repetition | Learning engine |
| Pass 150–162 | Audio study spaced repetition convergence | FSRS-5 integration |

---

## 7. Preservation Verification Checklist

After each Phase A absorption step, verify:

- [ ] All 35 environment variables still referenced and functional
- [ ] All 14 third-party integrations still operational (webhook URLs unchanged)
- [ ] All 200+ routes still resolve
- [ ] All 527 test files still pass
- [ ] All 222 client pages still render without error
- [ ] Navigation (PersonaSidebar5) still shows all existing items
- [ ] Theme tokens (Stewardship Gold) unchanged
- [ ] Keyboard shortcuts (g-chord) still functional
- [ ] Progressive disclosure levels still work
- [ ] Role-based access still enforced
- [ ] Chat streaming still functional
- [ ] Wealth Engine calculations still produce identical results
- [ ] Learning SRS still schedules correctly
- [ ] GHL webhook still receives and processes events
- [ ] Stripe webhook still processes payments
- [ ] Plaid link still connects accounts
