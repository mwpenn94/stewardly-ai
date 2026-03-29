# Stewardly AI — Claude Code Instructions

## Project
Full-stack TypeScript financial advisory platform. React 19 + Express + tRPC + MySQL (TiDB Cloud) + Drizzle ORM.

## Workflow Orchestrator
Task tracking lives in `.workflow/_status.json`. Use the orchestrator CLI:

```bash
node orchestrate.js init                      # Initialize
node orchestrate.js add "task" --phase P      # Add task
node orchestrate.js start <id>                # Begin work
node orchestrate.js done <id> --note "..."    # Complete
node orchestrate.js fail <id> --note "..."    # Mark failed
node orchestrate.js block <id> --note "..."   # Mark blocked
node orchestrate.js list                      # List all
node orchestrate.js summary                   # Status overview
node orchestrate.js export > backup.json      # Backup state
node orchestrate.js import backup.json        # Restore state
node orchestrate.js log "message"             # Activity log
```

Periodically export `_status.json` to mitigate session resets.

## Key Commands
```bash
pnpm run dev          # Dev server (tsx watch)
pnpm run build        # Production build (Vite + esbuild)
pnpm run check        # TypeScript type check
pnpm test             # Run vitest (1,635 passing, 111 need DB)
pnpm run db:push      # Drizzle generate + migrate
pnpm run db:deploy-missing  # Deploy 131 missing tables
```

## Architecture
- **Client**: `client/src/` — React 19, Tailwind 4, shadcn/ui, Wouter routing
- **Server**: `server/` — Express 4, tRPC 11, 53 routers, 104 services
- **Shared**: `shared/` — Types, constants, errors
- **Schema**: `drizzle/schema.ts` — 262 tables, Drizzle ORM
- **Tests**: `server/**/*.test.ts` — 63 files, vitest

## Database
- TiDB Cloud (MySQL-compatible), connection via `DATABASE_URL` env var
- 131 of 262 tables deployed; migration ready at `drizzle/0007_deploy_missing_tables.sql`
- IP-whitelisted to Manus infrastructure

## Security (Audit v4 Applied)
- Session: 24h expiry, sameSite=lax, httpOnly cookies
- Security headers: CSP, HSTS, X-Frame-Options applied as middleware
- Rate limiting: 200 req/15min global, 20/15min auth
- Body limit: 5MB default
- CORS: restricted to ALLOWED_ORIGINS env var
- Encryption: AES-256-GCM, production guard on missing keys
- RBAC: org-role checks via `userOrganizationRoles` table
- Audit: SHA-256 hash chain logging, DSAR data export

## Sensitive Files
- `.manus/db/` — Contains DB credentials in query logs (gitignored, removed from index)
- `.env` — Never commit (gitignored)
- `server/services/encryption.ts` — Hardcoded dev fallback key, guarded in production

## Audit Documentation
- `task_plan.md` — Audit goal, phases, key questions, errors
- `findings.md` — All findings with decisions
- `progress.md` — Action log with test/build output
- `AUDIT_PROGRESS.md` — Checklist status
- `audit-action-items.md` — All items with completion status
- `db-schema-drift.md` — 131 missing tables analysis
