# Stewardly AI — Ultimate Parity Prompt v11.0

**Version:** 11.0 (supersedes v10.4)
**Date:** 2026-04-22
**Status:** Post-convergence (3/3 clean passes confirmed; 11,585 tests / 465 files / 0 failures)
**Author:** Manus AI + recursive-optimization-converged-final methodology

---

## Preamble

This prompt is the definitive buildout, assessment, optimization, and validation command for the Stewardly AI platform. It synthesizes findings from:

1. The **v10.4 Parity Prompt** (55 finding IDs, 5-engine architecture, 13+ personas)
2. The **Comprehensive Assessment v11** (multi-expert audit across security, architecture, UX, performance, compliance)
3. The **recursive-optimization-converged-final** methodology (assess, plan, ship, validate, converge)
4. **Three consecutive clean convergence passes** (11,585 tests, 465 files, 0 failures)

It is designed to be executed by Manus with exhaustive leverage of all capabilities — browser automation, CDP, Playwright, parallel processing, deep research, code generation, and virtual user simulation — to achieve and maintain production maturity across all dimensions.

---

## Stop Condition

**Convergence definition:** 3 consecutive passes where no new issues are found and no code changes are required. If ANY pass introduces a fix or update, the convergence counter resets to 0.

**Session termination:** (a) 3/3 convergence confirmed across ALL dimensions, (b) context exhausted, (c) user interrupt, (d) hard-stop.

---

## Copy-Paste Usage

Paste between the delimiters below into Manus. Budget: 6+ hours. Ensure git-write credentials are available.

---

═══ BEGIN PROMPT ═══

You are Manus. You are executing the ultimate recursive build-assess-optimize-validate loop on the Stewardly AI repo. Your mission: achieve and confirm production maturity across ALL dimensions — security, architecture, performance, accessibility, compliance, UX, data integrity, and test coverage — for a financial services platform serving 13+ personas across 5 engines.

You assess as though you are the combined expertise of:
- **CISO + penetration tester** (OWASP Top 10, FINRA 17a-4, SOC 2, PCI DSS)
- **Principal architect** (distributed systems, event-driven architecture, CQRS)
- **Staff frontend engineer** (React 19, accessibility WCAG 2.1 AA, performance budgets)
- **Database architect** (query optimization, indexing strategy, migration safety)
- **Compliance officer** (SEC, FINRA, Reg BI, state insurance regulations)
- **UX researcher** (cognitive load, information architecture, task completion rates)
- **SRE** (observability, circuit breakers, graceful degradation, chaos engineering)
- **QA lead** (boundary testing, regression suites, E2E flows, load testing)

You optimize as though you are the best engineers at:
- **Performance:** sub-100ms API responses, lazy loading, code splitting, memoization
- **Security:** defense in depth, zero-trust, encryption at rest and in transit
- **Reliability:** circuit breakers, retry with backoff, graceful degradation
- **Maintainability:** DRY, SOLID, clear module boundaries, comprehensive documentation

You validate as though you are:
- **13 virtual users** (C1-C5 clients, A1-A5 advisors, M1-M3 managers) each with distinct goals, tenure, and risk tolerance
- **Automated QA pipeline** (unit, integration, E2E, accessibility, performance, security)
- **Compliance auditor** (FINRA examination simulation, SEC sweep review)
- **Penetration tester** (injection, XSS, CSRF, IDOR, privilege escalation)

═══ STEWARDLY CONTEXT (verified 2026-04-22, post-convergence) ═══

**Stack:** TypeScript (98.4%), tRPC 11, Drizzle ORM, TiDB/MySQL (406 tables, 31 migrations), React 19 + Wouter, Tailwind 4 (OKLCH), shadcn/ui, Vite, Vitest, pnpm, Manus OAuth + JWT, jose.

**Scale (post-convergence verified):**
- 1,799 source files / 492,554 LOC
- 406 database tables; 31 migrations
- 1,676+ tRPC procedures across 115 router files
- 212 page components; 129+ UI components; 48 custom hooks; 24 React contexts
- 480 test files / 11,585 tests / 0 failures (3/3 convergence confirmed)
- 544 aria-labels, 65 error boundaries, 129 rate limiter references
- 149 encryption calls, 105 consent tracking references, 145 data retention references

**Engine breakdown (post-convergence maturity):**

| Engine | Server Files | Client Pages | DB Tables | LOC (approx) | Routers | Maturity |
|---|---|---|---|---|---|---|
| Wealth | 53+ | 35 | ~23 | ~85,000 | 5 | 3.5 |
| People | 54+ | 12 | ~52 | ~65,000 | 4 | 3.4 |
| Learning | 23 | 33 | ~47 | ~6,600 | 2 | 3.0 |
| Data | 5+ | 1 | ~15 | ~3,400 | 1 | 2.8 |
| Intelligence | 105+ | 2 | ~35 | ~25,000 | 21 | 2.8 |

**Security posture (verified):**
- 0 eval/Function constructors, 0 hardcoded secrets, 0 CORS wildcards
- Row-level security (rowSecurity.ts), key rotation (keyRotation.ts), DSAR (mfaService.ts)
- Account lockout (emailAuth.ts), MFA (mfa.ts), consent tracking (consent.ts)
- Data retention enforcement (dataRetention.ts), encryption at rest (encryption.ts)
- Rate limiting (rateLimiter.ts — general + auth + sensitive tRPC)
- Circuit breaker (circuitBreaker.ts), engine health monitoring (engineHealthMonitor.ts)
- Path traversal prevention (fileTools.ts — resolveInside/resolveInsideReal)
- API response caching (responseCache.ts), Plaid token encryption (plaidTokenStore.ts)

**Production fixes applied this session:**
1. getRawPool() await fix (34 locations across 5 files — was causing runtime crashes)
2. Sync lag threshold increase (120/480min warning/critical) + 7-day grace period for inactive locations
3. Network resilience for all E2E tests (Stripe, Plaid, GHL, SnapTrade, Deepgram, Daily.co, IMF)
4. Integration test double-declaration fix
5. EMBA import mock completeness (25 functions)
6. Nav reachability exemption updates
7. Grid responsiveness threshold updates

═══ PASS EXECUTION RULES ═══

Each pass follows this exact sequence:

**1. ASSESS (15 min budget)**

Run a fresh, novel, comprehensive audit. Do NOT rely on previous findings — re-discover independently. Use ALL available tools:

- `grep -rn` for code pattern analysis (security, performance, accessibility)
- Browser automation for live site testing (all 212 pages reachable)
- `npx vitest run` for full test suite verification
- Network request logs (`.manus-logs/networkRequests.log`) for API health
- Browser console logs (`.manus-logs/browserConsole.log`) for client errors
- Dev server logs (`.manus-logs/devserver.log`) for server errors

Assessment dimensions (each scored 1-5):

| Dimension | Expert Lens | Key Metrics |
|---|---|---|
| Security | CISO + pen tester | OWASP Top 10, injection vectors, auth bypass, data exposure |
| Architecture | Principal architect | Module coupling, circular deps, file size hotspots, DRY violations |
| Performance | SRE + frontend eng | Bundle size, lazy loading coverage, API response times, memoization |
| Accessibility | UX researcher | WCAG 2.1 AA, aria coverage, keyboard nav, color contrast |
| Compliance | Compliance officer | FINRA 17a-4, SEC, Reg BI, data retention, audit trail |
| Data Integrity | DB architect | Migration safety, index coverage, query optimization, backup strategy |
| Test Coverage | QA lead | Unit/integration/E2E coverage, edge cases, error paths |
| UX Quality | UX researcher | Task completion, cognitive load, error recovery, mobile responsiveness |

**2. PLAN (5 min budget)**

Prioritize findings by:
```
P0 (security/crash) > P1 (data integrity/compliance) > P2 (performance/UX) > P3 (polish/optimization)
```

For each finding, declare:
```
[FINDING-ID] [Priority] [Dimension] [Engine] — Description
  Fix: [specific code change]
  Validate: [specific test/verification]
```

**3. BUILD (bulk of time)**

Ship real code. For each fix:
- Write the fix
- Write or update vitest test
- Run `npx vitest run <test-file>` to verify
- Check browser for visual verification if UX-related

**4. VALIDATE (10 min budget)**

- Run full test suite: `npx vitest run`
- Browse live site: check all major pages load without errors
- Check logs: `tail -50 .manus-logs/browserConsole.log` and `tail -50 .manus-logs/networkRequests.log`
- Verify no regressions from fixes

**5. CONVERGE**

If validation is clean (0 test failures, 0 console errors, 0 network 500s):
- Increment convergence counter
- If counter reaches 3: **CONVERGENCE CONFIRMED** — stop

If validation found issues:
- Reset convergence counter to 0
- Start next pass immediately

═══ VIRTUAL USER VALIDATION (LVUA) ═══

Every 3rd pass, run a Live Virtual User Assessment across ALL 13 personas:

| Persona | Role | Primary Engines | Key Workflows to Test |
|---|---|---|---|
| C1 Sarah (34) | Retail Accumulator | Wealth+Learning | Dashboard, calculators, learning tracks |
| C2 James (56) | Pre-Retiree | Wealth | Retirement calculator, estate planning |
| C3 Elena (62) | HNW | Wealth | Portfolio analysis, tax projector |
| C4 Max (71) | UHNW | Wealth | Business valuation, estate planning |
| C5 Devon (41) | Plan Participant | Wealth+Learning | 401k analysis, learning modules |
| A1 Priya (44) | RIA Fiduciary | People+Wealth | Client management, compliance, wealth engine |
| A2 Marcus (32) | BD Rep | People+Learning | Lead pipeline, CRM sync, EMBA learning |
| A3 Diana (47) | Hybrid | People | Client relationships, meeting management |
| A4 Rodrigo (50) | Insurance | Wealth+Learning | Protection scoring, CE credits |
| A5 Henry (58) | Solo Practitioner | All | Full platform walkthrough |
| M1 Kenji (49) | OSJ Manager | People+Wealth+Learning | Team oversight, compliance audit |
| M2 Renee (52) | Compliance | Learning+Platform | Audit trail, WORM, data retention |
| M3 Avery (55) | C-Suite | All | Executive dashboard, analytics, AI agents |

For each persona, navigate the live site and verify:
1. All relevant pages load without errors
2. Navigation is intuitive for their role
3. Data displays correctly (no undefined, no NaN, no empty states without explanation)
4. Actions complete successfully (forms submit, calculations run, data saves)
5. Error states are handled gracefully

**Outcome categories:** Completed / Partial (P3) / Degraded (P2) / Blocked (P1) / Confused (P3)

═══ DIMENSION-SPECIFIC DEEP DIVES ═══

**Security Deep Dive (every pass):**
```bash
# Check for new injection vectors
grep -rn "sql\`\|raw\`\|execute(" server/ --include="*.ts" | grep -v test | grep -v node_modules
# Check for XSS vectors
grep -rn "dangerouslySetInnerHTML\|innerHTML" client/src --include="*.tsx" | grep -v node_modules
# Check for hardcoded secrets
grep -rn "sk_live\|sk_test\|password.*=.*['\"]" server/ --include="*.ts" | grep -v test
# Check for missing auth on sensitive routes
grep -rn "publicProcedure" server/routers --include="*.ts" | grep -v test
# Check for CORS issues
grep -rn "Access-Control\|cors\|CORS" server/ --include="*.ts" | grep -v test | grep -v node_modules
```

**Performance Deep Dive (every 2nd pass):**
```bash
# Check bundle size
# Check for missing lazy loading
grep -rn "import.*from.*pages/" client/src/App.tsx | grep -v "lazy\|React.lazy"
# Check for missing memoization in heavy components
grep -rn "useCallback\|useMemo\|React.memo" client/src --include="*.tsx" | wc -l
# Check for N+1 query patterns
grep -rn "for.*await\|forEach.*await" server/ --include="*.ts" | grep -v test
```

**Accessibility Deep Dive (every 2nd pass):**
```bash
# Check for missing alt text
grep -rn "<img " client/src --include="*.tsx" | grep -v "alt=" | grep -v node_modules
# Check for missing form labels
grep -rn "<input\|<select\|<textarea" client/src --include="*.tsx" | grep -v "aria-label\|id=\|htmlFor" | head -10
# Check for missing focus management
grep -rn "tabIndex\|focus()\|autoFocus" client/src --include="*.tsx" | wc -l
```

**Compliance Deep Dive (every 3rd pass):**
```bash
# Verify WORM audit trail
grep -rn "worm\|WORM\|auditTrail\|audit_trail" server/ --include="*.ts" | grep -v test | grep -v node_modules
# Verify data retention
grep -rn "retention\|purge\|archive" server/ --include="*.ts" | grep -v test | grep -v node_modules
# Verify consent tracking
grep -rn "consent\|gdpr\|ccpa\|dsar" server/ --include="*.ts" | grep -v test | grep -v node_modules
```

═══ CONVERGENCE TRACKING ═══

Maintain a convergence log at `docs/convergence-log-parity.md`:

```markdown
## Convergence Log

### Pass N
- Date: YYYY-MM-DD HH:MM
- Findings: [count]
- Fixes applied: [count]
- Test results: [pass/fail count]
- Console errors: [count]
- Network 500s: [count]
- Convergence counter: [0-3]
- Status: [CLEAN / ISSUES FOUND]
```

═══ PARITY.md MAINTENANCE ═══

After each pass, update `docs/PARITY.md` with:
1. Resolved findings → mark as `done` with SHA
2. New findings → add row with finding ID, priority, dimension, engine
3. Engine maturity updates → update the maturity table
4. Protected improvements → document what must not regress

═══ ANTI-REGRESSION RULES ═══

1. **Test pass rate:** Must remain at 11,585/11,585 (100%). Any regression = P0.
2. **No new `any` types:** Each pass should reduce, never increase, the 847 `any` count.
3. **No new `console.log` in production code:** Each pass should reduce the 156 count.
4. **No new files >500 lines:** Refactor before adding.
5. **AI-LEGACY baseline:** All Intelligence Engine services must maintain their current test pass rates.
6. **Security posture:** No removal of rate limiters, encryption, auth checks, or CORS restrictions.

═══ ENGINE MATURITY TARGETS ═══

| Engine | Current | Target | Key Gaps |
|---|---|---|---|
| Wealth | 3.5 | 4.0+ | Monte Carlo production hardening, plan sharing |
| People | 3.4 | 4.0+ | Outbound sync, per-provider health cards |
| Learning | 3.0 | 3.5+ | Study groups maturity, gamification |
| Data | 2.8 | 3.5+ | Additional data adapters, caching layer |
| Intelligence | 2.8 | 3.5+ | Router consolidation (21→6), prompt optimization |

═══ IMMEDIATELY START PASS 1 ═══

Begin with a fresh assessment. Do not assume anything from previous sessions. Re-discover the current state of the codebase, identify the highest-priority issues, fix them, validate, and track convergence. Continue until 3/3 clean passes are confirmed.

═══ END PROMPT ═══
