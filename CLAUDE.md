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
pnpm test             # Run vitest (2,142 passing, 108 need DB)
pnpm run db:push      # Drizzle generate + migrate
pnpm run db:deploy-missing  # Deploy 131 missing tables
```

## Architecture
- **Client**: `client/src/` — React 19, Tailwind 4, shadcn/ui, Wouter routing
- **Server**: `server/` — Express 4, tRPC 11, 57 routers, 116 services
- **Shared**: `shared/` — Types, constants, errors
- **Schema**: `drizzle/schema.ts` — 270 tables, Drizzle ORM
- **Tests**: `server/**/*.test.ts` — 85 files, vitest
- **Shared Intelligence**: `server/shared/` — contextualLLM, config, streaming, engine, guardrails, telemetry, events, tenant

## Database
- TiDB Cloud (MySQL-compatible), connection via `DATABASE_URL` env var
- 131 of 270 tables deployed; migration ready at `drizzle/0007_deploy_missing_tables.sql`
- IP-whitelisted to Manus infrastructure

## Intelligence Layer
- **contextualLLM**: RAG-enabled LLM wrapper with deep context injection from 40+ sources
- **Guardrails**: PII screening (SSN, CC, phone, DOB) + injection detection on every LLM call
- **5-Layer Config**: platform → organization → manager → professional → user (deep merge)
- **Graduated Autonomy**: DB-backed via `agent_autonomy_levels`, write-through cache, default fallback
- **ReAct Loop**: Multi-turn tool calling with trace logging in `reasoning_traces`
- **Improvement Engine**: Signal detection on 6h schedule, anti-regression checks
- **SSE Streaming**: POST `/api/chat/stream` with token/done/error events
- **Memory Engine**: DB-backed with 6 categories, episodic summaries, context injection
- **Event Bus**: Typed events (prompt.scored, compliance.flagged, goal.completed)
- **OpenTelemetry**: GenAI semantic conventions, OTLP export when configured
- **MCP Server**: 6 financial tools at `/mcp/sse` and `/mcp/call`

## Security (Audit v4 Applied + Hardened)
- Session: 24h expiry, sameSite=lax, httpOnly cookies
- Security headers: CSP with per-request nonces (no unsafe-inline), HSTS, X-Frame-Options
- Rate limiting: 100 req/15min global, 5/15min auth, 20/15min sensitive tRPC
- Body limit: 5MB default
- CORS: ALLOWED_ORIGINS required in production (fails fast if missing)
- Encryption: AES-256-GCM, production guard on missing keys
- RBAC: org-role checks via `userOrganizationRoles` table
- Audit: SHA-256 hash chain logging, DSAR data export
- Guardrails: PII + injection screening on all LLM I/O
- Multi-tenant: tenantId in tRPC context via AsyncLocalStorage

## Production Infrastructure
- **Docker**: Multi-stage Dockerfile (Alpine, non-root user, HEALTHCHECK)
- **CI/CD**: GitHub Actions (type check + test + Docker build)
- **Health Probes**: GET `/health` (liveness) + GET `/ready` (readiness w/ DB check)
- **Error Tracking**: Sentry (optional, dynamic import, no build dep)
- **Observability**: Pino structured JSON logging + OpenTelemetry (optional)

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
