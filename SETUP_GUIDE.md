# Stewardly (WealthBridge AI) — Full Setup Guide

**Source:** `Stewardly(WealthBridgeAI)—FullSetupGuide.md` (uploaded context)

This file is a copy of the uploaded setup guide, stored in the project for cross-task reference.
For the full content, see the original uploaded document.

---

## Quick Reference

### Prerequisites
- Node.js 22.x+, pnpm 10.4.1+, MySQL 8.0+ / TiDB

### Quick Start
```bash
pnpm install
cp env-reference.txt .env  # fill in values
# Run 0007_deploy_missing_tables.sql + ALTER TABLE for customShortcuts
pnpm dev
```

### Required Env Vars
DATABASE_URL, JWT_SECRET, VITE_APP_ID, OAUTH_SERVER_URL, VITE_OAUTH_PORTAL_URL,
OWNER_OPEN_ID, BUILT_IN_FORGE_API_URL, BUILT_IN_FORGE_API_KEY,
VITE_FRONTEND_FORGE_API_URL, VITE_FRONTEND_FORGE_API_KEY, INTEGRATION_ENCRYPTION_KEY

### Optional Env Vars
GOOGLE_CLIENT_ID/SECRET, LINKEDIN_CLIENT_ID/SECRET, SNAPTRADE_CLIENT_ID/CONSUMER_KEY,
PLAID_CLIENT_ID/SECRET, FRED_API_KEY, DAILY_API_KEY, DEEPGRAM_API_KEY,
VITE_APP_TITLE, VITE_APP_LOGO, VITE_ANALYTICS_ENDPOINT/WEBSITE_ID, OWNER_NAME

### Self-Hosting Without Manus
Replace: server/_core/oauth.ts (auth), server/_core/llm.ts (LLM), server/storage.ts (S3),
server/_core/map.ts (Maps), server/_core/notification.ts (notifications).
Remove: vite-plugin-manus-runtime, @builder.io/vite-plugin-jsx-loc from vite.config.ts.

### Current Scale
131 tables, 1,987 tests across 70 files, 80+ services, 40+ pages, 60+ shadcn/ui components.
