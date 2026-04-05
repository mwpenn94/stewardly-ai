# @platform/core — Extraction Manifest

> **Future-State & Synthesis Pass** — Stewardly-AI Recursive Optimization
> Generated: 2026-04-01

## Purpose

This manifest documents the shared server/_core modules that are now **identical or near-identical across all 4 platform projects** (Stewardly, AEGIS, Atlas, Sovereign). These modules are candidates for extraction into a shared `@platform/core` package when Sprint S4 (Intelligence Extraction) begins.

## Shared Modules — Ready for Extraction

| Module | Stewardly | AEGIS | Atlas | Sovereign | Extraction Ready |
|--------|-----------|-------|-------|-----------|-----------------|
| `requestId.ts` | Yes | Yes | Yes | Yes | **Yes** — UUID validation, injection rejection, X-Request-Id header |
| `rateLimiter.ts` | Yes | Yes | Yes | Yes | **Partial** — config differs per project (window, max, sensitive patterns) |
| `logger.ts` | Yes | Yes | Yes | Yes | **Yes** — Pino with LOG_LEVEL env, operation scoping, stdout guard |
| `envValidation.ts` | Yes | Yes | Yes | Yes | **Yes** — identical pattern, only REQUIRED_IN_PRODUCTION list differs |
| `coerceNumericFields.ts` | Yes | Yes | Yes | Yes | **Yes** — identical implementation across all 4 |

## Extraction Strategy (12-Month Projection)

### Phase 1: Shared Package (Month 1-3)
- Create `@stewardly/platform-core` npm workspace package
- Move `requestId`, `logger`, `coerceNumericFields` first (zero config variance)
- `envValidation` takes a config object: `validateEnv({ required: [...], recommended: [...] })`
- `rateLimiter` takes a config object: `createLimiters({ general: { max: 100 }, auth: { max: 5 }, sensitive: { patterns: [...] } })`

### Phase 2: Security Hardening (Month 3-6)
- Shared security test suite that all 4 projects import
- CSP directive builder with per-project overrides
- Centralized Helmet config factory

### Phase 3: Intelligence Integration (Month 6-12)
- `contextualLLM` middleware wrapper (S4 insertion points already marked in all 4 index.ts)
- Shared tRPC middleware for cross-project intelligence routing
- Unified audit logging with compliance export

## Re-Entry Triggers

The recursive optimization loop should re-open when any of these conditions are met:

1. **New feature deployment** — any new router, service, or middleware added to any project
2. **Dependency major version bump** — especially Express, Helmet, Pino, or express-rate-limit
3. **Security audit findings** — external penetration test or vulnerability scan results
4. **Production incident** — any P0/P1 incident that reveals a gap in the security or observability stack
5. **S4 Sprint kickoff** — when @platform/intelligence extraction begins, re-run Landscape pass on all 4
6. **Regulatory change** — SOC2, GDPR, or industry-specific compliance requirement changes
