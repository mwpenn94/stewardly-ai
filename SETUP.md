# Stewardly (WealthBridge AI) — Full Setup Guide

This document contains everything needed to deploy and run the Stewardly codebase identically from a fresh upload.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Environment Variables](#environment-variables)
4. [Database Setup](#database-setup)
5. [Project Structure](#project-structure)
6. [Architecture Overview](#architecture-overview)
7. [Running in Production](#running-in-production)
8. [Third-Party Integrations](#third-party-integrations)
9. [Testing](#testing)
10. [Manus Platform Dependencies](#manus-platform-dependencies)

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 22.x+ | Tested on 22.13.0 |
| pnpm | 10.4.1+ | Package manager (specified in `packageManager` field) |
| MySQL / TiDB | 8.0+ / any | TiDB Serverless recommended for production |
| Git | 2.x+ | For version control |

---

## Quick Start

```bash
# 1. Clone or extract the project
cd /path/to/wealthbridge-ai

# 2. Install dependencies
pnpm install

# 3. Copy environment file and fill in values
cp env-reference.txt .env
# Edit .env with your actual values (see Environment Variables section)

# 4. Set up the database (see Database Setup section)
# Run all migration SQL files in order against your MySQL database

# 5. Start development server
pnpm dev
# Server starts on http://localhost:3000

# 6. Run tests
pnpm test
```

---

## Environment Variables

All environment variables are documented in `env-reference.txt`. Copy it to `.env` in the project root.

### Required Variables (App Will Not Start Without These)

| Variable | Purpose | How to Obtain |
|---|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string | Your database provider |
| `JWT_SECRET` | Signs session cookies | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `VITE_APP_ID` | Manus OAuth app ID | Manus developer dashboard |
| `OAUTH_SERVER_URL` | Manus OAuth backend URL | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal | `https://id.manus.im` |
| `OWNER_OPEN_ID` | Owner's Manus OpenID | Your Manus account |
| `BUILT_IN_FORGE_API_URL` | Manus Forge API URL | Manus platform |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge API key (server) | Manus platform |
| `VITE_FRONTEND_FORGE_API_URL` | Manus Forge API URL (frontend) | Manus platform |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus Forge API key (frontend) | Manus platform |
| `INTEGRATION_ENCRYPTION_KEY` | Encrypts stored credentials | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### Optional Variables (Enable Additional Features)

| Variable | Feature | Provider |
|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google social login | [Google Cloud Console](https://console.cloud.google.com/) |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn social login | [LinkedIn Developer Portal](https://developer.linkedin.com/) |
| `SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CONSUMER_KEY` | Brokerage account linking | [SnapTrade](https://snaptrade.com/) |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | Bank account linking | [Plaid](https://plaid.com/) |
| `FRED_API_KEY` | Federal Reserve economic data | [FRED API](https://fred.stlouisfed.org/docs/api/api_key.html) |
| `DAILY_API_KEY` | Video meetings | [Daily.co](https://daily.co/) |
| `DEEPGRAM_API_KEY` | Speech-to-text | [Deepgram](https://deepgram.com/) |
| `VITE_APP_TITLE` | Custom app title | Set to any string (default: "Stewardly") |
| `VITE_APP_LOGO` | Custom logo URL | CDN URL to your logo image |
| `VITE_ANALYTICS_ENDPOINT` / `VITE_ANALYTICS_WEBSITE_ID` | Analytics tracking | Your analytics provider |
| `OWNER_NAME` | Owner display name | Your name |

---

## Database Setup

The application uses **MySQL 8.0+** or **TiDB Serverless**. The schema is defined in `drizzle/schema.ts` and migrations are in `drizzle/*.sql`.

### Fresh Database Setup

Run the migration files **in order** against your database:

```bash
# Option A: Using mysql CLI
mysql -u root -p wealthbridge < drizzle/0000_clammy_blackheart.sql
mysql -u root -p wealthbridge < drizzle/0001_groovy_kat_farrell.sql
mysql -u root -p wealthbridge < drizzle/0002_majestic_killmonger.sql
mysql -u root -p wealthbridge < drizzle/0003_unique_thaddeus_ross.sql
mysql -u root -p wealthbridge < drizzle/0004_secret_night_thrasher.sql
mysql -u root -p wealthbridge < drizzle/0005_cute_selene.sql
mysql -u root -p wealthbridge < drizzle/0006_omniscient_lady_ursula.sql
mysql -u root -p wealthbridge < drizzle/0006_multitenant_manyToMany.sql
mysql -u root -p wealthbridge < drizzle/0007_deploy_missing_tables.sql

# Then apply the post-migration column addition:
mysql -u root -p wealthbridge -e "ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS customShortcuts JSON;"
```

**Important:** Migration `0007_deploy_missing_tables.sql` uses `CREATE TABLE IF NOT EXISTS` for all 131 tables, so it is safe to run even if earlier migrations partially created some tables. It is the most comprehensive single migration.

### Shortcut: If Starting Fresh

You can skip migrations 0000-0006 and just run:

```bash
mysql -u root -p wealthbridge < drizzle/0007_deploy_missing_tables.sql
mysql -u root -p wealthbridge -e "ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS customShortcuts JSON;"
```

This creates all 131 tables with the correct schema.

### TiDB Serverless Connection

When using TiDB Serverless, your `DATABASE_URL` should include SSL:

```
mysql://user:password@gateway.tidbcloud.com:4000/wealthbridge?ssl={"rejectUnauthorized":true}
```

---

## Project Structure

```
wealthbridge-ai/
├── client/                    # Frontend (React 19 + Tailwind 4)
│   ├── public/                # Static files (favicon, robots.txt only)
│   ├── src/
│   │   ├── components/        # Reusable UI components + shadcn/ui
│   │   │   ├── ui/            # shadcn/ui primitives (60+ components)
│   │   │   ├── chat/          # Chat-specific components
│   │   │   ├── AppShell.tsx   # Main layout with sidebar navigation
│   │   │   ├── CommandPalette.tsx  # Global Ctrl+K command palette
│   │   │   ├── KeyboardShortcuts.tsx  # "?" shortcut overlay
│   │   │   └── WhatsNewModal.tsx  # Changelog modal
│   │   ├── contexts/          # React contexts (Theme, Notifications)
│   │   ├── hooks/             # Custom hooks (15+ hooks)
│   │   ├── lib/               # Utilities (tRPC client, route prefetch)
│   │   ├── pages/             # Page components (40+ pages)
│   │   │   └── settings/      # Settings sub-tabs
│   │   ├── App.tsx            # Routes & layout
│   │   ├── main.tsx           # Providers
│   │   └── index.css          # Global styles & theme
│   └── index.html             # HTML entry point
├── server/                    # Backend (Express 4 + tRPC 11)
│   ├── _core/                 # Framework plumbing (DO NOT EDIT)
│   │   ├── index.ts           # Server entry point
│   │   ├── env.ts             # Environment variable access
│   │   ├── llm.ts             # LLM integration helper
│   │   ├── oauth.ts           # Manus OAuth handler
│   │   ├── notification.ts    # Owner notification helper
│   │   ├── imageGeneration.ts # Image generation helper
│   │   ├── voiceTranscription.ts  # Whisper transcription
│   │   ├── map.ts             # Google Maps proxy
│   │   ├── dataApi.ts         # Manus Data API client
│   │   └── ...
│   ├── routers/               # Feature-specific tRPC routers
│   │   ├── aiLayers.ts        # 5-layer AI context system
│   │   ├── organizations.ts   # Multi-tenant org management
│   │   └── ...
│   ├── services/              # Business logic services (80+ files)
│   ├── routers.ts             # Main tRPC router (merges all sub-routers)
│   ├── db.ts                  # Database query helpers
│   ├── storage.ts             # S3 storage helpers
│   └── *.test.ts              # Vitest test files (70 files, 1987 tests)
├── drizzle/                   # Database schema & migrations
│   ├── schema.ts              # Drizzle ORM schema (131 tables)
│   └── *.sql                  # Migration files
├── shared/                    # Shared types & constants
├── scripts/                   # Utility scripts
├── patches/                   # pnpm patches (wouter)
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript config
├── vite.config.ts             # Vite config (dev server, build)
├── vitest.config.ts           # Vitest config
└── todo.md                    # Feature tracking
```

---

## Architecture Overview

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, Wouter (routing), Framer Motion |
| State | TanStack React Query via tRPC hooks |
| API | tRPC 11 with Superjson serialization |
| Backend | Express 4, Node.js 22 |
| Database | MySQL 8 / TiDB via Drizzle ORM |
| Auth | Manus OAuth + Google/LinkedIn social login |
| Storage | S3 via Manus Forge API |
| AI | LLM via Manus Forge API (OpenAI-compatible) |
| Real-time | Socket.IO for WebSocket notifications |

### Key Architectural Patterns

**5-Layer AI Context System:** Platform > Organization > Firm > Professional > User. Each layer adds context to AI responses.

**Multi-Tenant:** Organizations > Firms > Users hierarchy with role-based access (user, advisor, manager, admin).

**tRPC End-to-End Types:** Procedures defined in `server/routers.ts`, consumed via `trpc.*` hooks in React. No REST endpoints or manual type definitions needed.

---

## Running in Production

```bash
# Build
pnpm build

# Start production server
pnpm start
```

The build step:
1. Vite builds the frontend to `dist/public/`
2. esbuild bundles the server to `dist/index.js`

The production server serves both the API and the static frontend from a single Express process.

---

## Third-Party Integrations

### Manus Platform (Required)

The app is built on the Manus platform and requires:
- **Manus OAuth** for authentication
- **Manus Forge API** for LLM, storage, notifications, and data APIs
- **Manus Maps Proxy** for Google Maps (no API key needed)

Without the Manus platform, you would need to replace:
- `server/_core/oauth.ts` with your own auth provider
- `server/_core/llm.ts` with direct OpenAI/Anthropic calls
- `server/storage.ts` with direct S3 calls
- `server/_core/map.ts` with your own Google Maps API key
- `server/_core/notification.ts` with your own notification service

### Optional Integrations

| Integration | Files | Purpose |
|---|---|---|
| SnapTrade | `server/services/snapTrade.ts` | Brokerage account linking |
| Plaid | `server/services/plaidProduction.ts` | Bank account linking |
| FRED API | `server/services/governmentDataPipelines.ts` | Economic data |
| Daily.co | Meeting features | Video conferencing |
| Deepgram | Voice features | Speech-to-text |

---

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test -- server/serverShortcutsRecentToast.test.ts

# Run with verbose output
pnpm test -- --reporter=verbose

# Type check
pnpm check
```

Current test coverage: **1,987 tests across 70 files**, all passing.

---

## Manus Platform Dependencies

This application was built and deployed on the Manus WebDev platform. The following are platform-specific:

| Component | Manus-Specific | Replacement Needed |
|---|---|---|
| `server/_core/` directory | Yes | Replace OAuth, LLM, storage, maps, notifications |
| `vite-plugin-manus-runtime` | Yes | Remove from vite.config.ts |
| `@builder.io/vite-plugin-jsx-loc` | Yes | Remove from vite.config.ts |
| S3 storage proxy | Yes | Use direct AWS S3 SDK |
| LLM proxy | Yes | Use OpenAI/Anthropic SDK directly |
| Maps proxy | Yes | Add Google Maps API key |
| Domain hosting | Yes | Deploy to Vercel/Railway/etc. |

### Self-Hosting Without Manus

To run outside the Manus platform:

1. Replace `server/_core/oauth.ts` with your own auth (e.g., Lucia, NextAuth)
2. Replace `server/_core/llm.ts` — use OpenAI SDK directly with your API key
3. Replace `server/storage.ts` — use `@aws-sdk/client-s3` directly with your bucket
4. Remove `vite-plugin-manus-runtime` and `@builder.io/vite-plugin-jsx-loc` from `vite.config.ts`
5. Replace `server/_core/map.ts` — add `GOOGLE_MAPS_API_KEY` env var
6. Replace `server/_core/notification.ts` — use SendGrid, Twilio, etc.
7. Set `DATABASE_URL` to your own MySQL instance
8. Generate your own `JWT_SECRET` and `INTEGRATION_ENCRYPTION_KEY`
