# Stewardly --- Full Setup Guide

**Updated:** April 5, 2026
**Platform:** Stewardly AI --- Digital Financial Twin

---

## Quick Start (5 minutes)

```bash
pnpm install
cp env-reference.txt .env  # fill in values
pnpm dev
```

The app will start at `http://localhost:3000/`.

---

## Required Environment Variables

These are automatically injected when running on the Manus platform. For self-hosting, set them manually:

| Variable | Purpose |
|----------|---------|  
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing secret |
| `VITE_APP_ID` | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend base URL |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL (frontend) |
| `OWNER_OPEN_ID` | Owner's OpenID |
| `BUILT_IN_FORGE_API_URL` | Manus built-in APIs (LLM, storage, data, notifications) |
| `BUILT_IN_FORGE_API_KEY` | Bearer token for Manus built-in APIs (server-side) |
| `VITE_FRONTEND_FORGE_API_URL` | Manus built-in APIs URL for frontend |
| `VITE_FRONTEND_FORGE_API_KEY` | Bearer token for frontend access to Manus built-in APIs |
| `INTEGRATION_ENCRYPTION_KEY` | Encryption key for stored credentials (generate with `openssl rand -hex 32`) |

## Optional Environment Variables

| Variable | Purpose | Priority |
|----------|---------|----------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth login | MEDIUM |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth login | MEDIUM |
| `SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CONSUMER_KEY` | Brokerage account linking | LOW |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | Bank account linking | LOW |
| `FRED_API_KEY` | Federal Reserve economic data | LOW (free) |
| `CENSUS_API_KEY` | US Census demographic data | LOW (free) |
| `DAILY_API_KEY` | Video conferencing | LOW |
| `DEEPGRAM_API_KEY` | Speech-to-text | LOW |
| `VITE_APP_TITLE` | Custom app title | LOW |
| `VITE_APP_LOGO` | Custom app logo URL | LOW |

---

## Database Setup

After starting the dev server, deploy any missing tables through the Manus Management UI Database panel, or run:

```bash
pnpm run db:deploy-missing
```

Then run the seed scripts to populate reference data (40 modules across 6 phases).

---

## Self-Hosting Without Manus

To run Stewardly outside the Manus platform, replace these framework-level files with your own implementations:

| File | What to Replace |
|------|----------------|
| `server/_core/oauth.ts` | Authentication (e.g., Passport.js, NextAuth) |
| `server/_core/llm.ts` | LLM provider (e.g., OpenAI SDK, Anthropic SDK) |
| `server/storage.ts` | File storage (e.g., AWS S3, Cloudflare R2) |
| `server/_core/map.ts` | Maps API (e.g., Google Maps API key) |
| `server/_core/notification.ts` | Notifications (e.g., SendGrid, Twilio) |

Also remove from `vite.config.ts`: `vite-plugin-manus-runtime` and `@builder.io/vite-plugin-jsx-loc`.

---

## Current Scale

```
314 tables | 204 services | 68 routers | 105 pages | 109 components
98 test files (2,440 tests) | 16 LLM models | 5 search tools
34 cron jobs | 40 seed modules | 28 navigation items
0 TypeScript errors
```

---

## For More Information

See `REMAINING_ITEMS.md` for the full step-by-step completion guide including optional integrations.

See `STEWARDLY_COMPREHENSIVE_GUIDE.md` for the full platform architecture and feature reference.
