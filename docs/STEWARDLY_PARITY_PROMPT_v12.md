# Stewardly AI — Ultimate Parity Prompt v12.0

**Version:** 12.0 (supersedes v11.0 and v10.4)
**Date:** 2026-04-22
**Status:** Post-convergence (3/3 clean passes confirmed; 11,621 tests / 468 files / 0 failures)
**Author:** Manus AI + recursive-optimization-converged-final methodology
**Assessment Tiers:** Automated (Pass 1) + Expert Manual Review (Pass 2) + Adversarial Testing (Pass 3)

---

## Preamble

This prompt is the definitive buildout, assessment, optimization, and validation command for the Stewardly AI platform. It synthesizes findings from:

1. The **v10.4 Parity Prompt** (55 finding IDs, 5-engine architecture, 13+ personas)
2. The **Comprehensive Assessment v11** (multi-expert audit across security, architecture, UX, performance, compliance)
3. The **Comprehensive Assessment v12** (3-tier assessment: automated + expert manual + adversarial)
4. The **recursive-optimization-converged-final** methodology (assess, plan, ship, validate, converge)
5. **Three consecutive clean convergence passes** (11,621 tests, 468 files, 0 failures)
6. **Expert manual review** of all 13 engine pages (Playwright + browser automation)
7. **Adversarial testing** (XSS payloads, SQL injection, network resilience, race conditions, privilege escalation)
8. **Mobile responsiveness testing** (375px, 768px, 1024px viewports across all engines)
9. **Privacy flow walkthrough** (consent banner, DSAR export, data retention, PII redaction)

It is designed to be executed by Manus with exhaustive leverage of ALL capabilities — browser automation, CDP, Playwright, parallel processing, deep research, code generation, and virtual user simulation — to achieve and maintain production maturity across all dimensions.

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

═══ THREE-TIER ASSESSMENT METHODOLOGY ═══

Each pass MUST execute ALL THREE tiers. Do NOT skip tiers.

**TIER 1 — Automated Baseline (the "known checks")**
Scripted grep/lint/test analysis that catches regressions and pattern violations. Fast, deterministic, repeatable.

**TIER 2 — Expert Manual Review (the "never-before-tested" dimensions)**
Browse the live site. Test actual engine functionality. Assess from BOTH user perspectives:
- **Principles-first users** (want to understand WHY before HOW): Does the engine explain methodology, show formulas, cite sources, provide educational context?
- **Applications-first users** (want to DO things immediately): Can they get results in 1-2 clicks? Are defaults smart? Is the workflow intuitive without reading docs?
- **Engine capability/utility within its focus:** Does each engine actually deliver meaningful value, or is it just a shell with forms?

**TIER 3 — Adversarial Testing (the "break it" scenarios)**
Edge cases, stress scenarios, race conditions, malicious inputs, broken network, concurrent users — things no automated check catches.

═══ EXPERT PANELS ═══

You assess as though you are the combined expertise of:

**Panel A — Security & Compliance (CISO + Pen Tester + Compliance Officer)**
- OWASP Top 10, FINRA 17a-4, SOC 2, PCI DSS
- SEC, FINRA, Reg BI, state insurance regulations
- Injection vectors, auth bypass, data exposure, privilege escalation
- WORM audit trail, data retention, consent tracking

**Panel B — Architecture & Performance (Principal Architect + SRE + DB Architect)**
- Distributed systems, event-driven architecture, CQRS
- Sub-100ms API responses, lazy loading, code splitting, memoization
- Query optimization, indexing strategy, migration safety
- Circuit breakers, retry with backoff, graceful degradation

**Panel C — Frontend & UX (Staff Frontend Engineer + UX Researcher)**
- React 19, accessibility WCAG 2.1 AA, performance budgets
- Cognitive load, information architecture, task completion rates
- Mobile-first responsive design, touch targets, text readability
- Micro-interactions, empty states, error recovery, loading states

**Panel D — Quality & Testing (QA Lead + Virtual Users)**
- Boundary testing, regression suites, E2E flows, load testing
- 13 virtual user personas with distinct goals, tenure, and risk tolerance
- Adversarial inputs: XSS payloads, SQL injection, unicode edge cases
- Network failure simulation, race conditions, concurrent mutations

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

═══ STEWARDLY CONTEXT (verified 2026-04-22, post-convergence v12) ═══

**Stack:** TypeScript (98.4%), tRPC 11, Drizzle ORM, TiDB/MySQL (406 tables, 31 migrations), React 19 + Wouter, Tailwind 4 (OKLCH), shadcn/ui, Vite, Vitest, pnpm, Manus OAuth + JWT, jose.

**Scale (post-convergence verified):**
- 1,737 source files / 481,791 LOC
- 406 database tables; 31 migrations
- 1,676+ tRPC procedures across 119 router files
- 201 page components; 295 UI components; 48 custom hooks; 24 React contexts
- 468 test files / 11,621 tests / 0 failures (3/3 convergence confirmed)
- 544 aria-labels, 31 aria-live regions, 282 role attributes
- 41 files with rate limiting, 110 files with upload size limits
- 149 encryption calls, 105 consent tracking references, 145 data retention references

**Engine breakdown (post-convergence maturity):**

| Engine | Server Files | Client Pages | DB Tables | LOC (approx) | Routers | Maturity |
|---|---|---|---|---|---|---|
| Wealth | 53+ | 35 | ~23 | ~85,000 | 5 | 3.5 |
| People | 54+ | 12 | ~52 | ~65,000 | 4 | 3.4 |
| Learning | 23 | 33 | ~47 | ~6,600 | 2 | 3.0 |
| Data | 5+ | 1 | ~15 | ~3,400 | 1 | 2.8 |
| Intelligence | 105+ | 2 | ~35 | ~25,000 | 21 | 2.8 |

**Security posture (verified v12):**
- 0 eval/Function constructors, 0 hardcoded secrets, 0 CORS wildcards
- 1,581 protected procedures / 146 public (91.5% protected)
- 3,441 user-scoped query references (strong data isolation)
- 1,409 Zod validations on 921 mutations (153% coverage)
- 12/14 webhook files verify signatures (85.7%)
- Row-level security, key rotation, DSAR, account lockout, MFA, consent tracking
- Data retention enforcement, AES-256-GCM encryption at rest, circuit breaker
- Path traversal prevention, API response caching, Plaid token encryption

**Production fixes applied (v12 session):**
1. getRawPool() await fix (34 locations across 5 files)
2. Sync lag threshold increase (120/480min) + 7-day grace period
3. Network resilience for all E2E tests (Stripe, Plaid, GHL, SnapTrade, Deepgram, Daily.co, IMF)
4. 7 pages converted to lazy loading (Landing, SignIn, Chat, Terms, Privacy, Welcome, NotFound)
5. 10 hidden file inputs given aria-labels
6. 30 console.log converted to console.info in production server code
7. Mobile responsiveness CSS utilities added
8. EMBA import mock completeness (25 functions)

═══ PASS EXECUTION RULES ═══

Each pass follows this exact sequence across ALL THREE tiers:

**1. ASSESS — TIER 1: Automated Baseline (10 min)**

Run scripted checks. These are fast and deterministic:

```bash
# Security patterns
grep -rn "sql\`\|raw\`\|execute(" server/ --include="*.ts" | grep -v test | grep -v node_modules
grep -rn "dangerouslySetInnerHTML\|innerHTML" client/src --include="*.tsx" | grep -v node_modules
grep -rn "sk_live\|sk_test\|password.*=.*['\"]" server/ --include="*.ts" | grep -v test
grep -rn "publicProcedure" server/routers --include="*.ts" | grep -v test

# Performance patterns
grep -rn "import.*from.*pages/" client/src/App.tsx | grep -v "lazy\|React.lazy"
grep -rn "console\.log" server/ --include="*.ts" | grep -v test | grep -v node_modules | wc -l

# Accessibility patterns
grep -rn "<img " client/src --include="*.tsx" | grep -v "alt=" | grep -v node_modules | wc -l
grep -rn 'type="file"' client/src --include="*.tsx" | grep -v "aria-label" | wc -l

# Test suite
npx vitest run 2>&1 | tail -5

# Runtime logs
tail -30 .manus-logs/browserConsole.log | grep -i "error\|fail\|crash"
tail -30 .manus-logs/networkRequests.log | grep "500\|502\|503"
tail -30 .manus-logs/devserver.log | grep -i "error\|crash\|unhandled"
```

**2. ASSESS — TIER 2: Expert Manual Review (20 min)**

Browse the live site using Playwright or browser tools. For EACH of the 13 engine pages:

a) **Load test:** Does the page render without errors?
b) **Functionality test:** Do the primary actions work? (calculate, submit, navigate, search)
c) **Principles-first assessment:** Is there educational context? Methodology explanation? Source citations?
d) **Applications-first assessment:** Can a user get results in 1-2 clicks? Are defaults smart?
e) **Content quality:** Is financial terminology accurate? Are error messages helpful? Is copy consistent?
f) **Mobile responsiveness:** Test at 375px viewport — are touch targets adequate? Is text readable?
g) **Empty/loading/error states:** Are they present and informative?

Engine pages to test:
1. /wealth-engine — Calculators, financial modeling
2. /intelligence — AI insights, analysis categories
3. /integrations — 47 providers, sync status
4. /advisory — Planning hierarchies, cascading calculations
5. /products — Product catalog, carrier comparison
6. /learning — EMBA tracks, definitions, cases
7. /lead-pipeline — Lead scoring, stage management
8. /chat — AI assistant, tool calling
9. /relationships — Client management
10. /analytics — Charts, data visualization
11. /compliance — Audit trail, regulatory
12. /settings — User preferences, integrations
13. / (landing) — Onboarding, navigation

**3. ASSESS — TIER 3: Adversarial Testing (15 min)**

Test things no automated check catches:

a) **XSS payloads:** Enter `<script>alert(1)</script>`, `<img onerror=alert(1) src=x>`, `javascript:alert(1)` in all text inputs
b) **SQL injection:** Enter `'; DROP TABLE users; --`, `1 OR 1=1`, `UNION SELECT * FROM users` in search/filter fields
c) **Edge case data:** Empty strings, max-length strings (10,000 chars), negative numbers in financial calculators, NaN, Infinity, unicode characters, emoji
d) **Broken network:** What happens when API calls fail mid-flow? Do loading states persist? Are error messages helpful?
e) **Race conditions:** Rapid double-click on submit buttons. Concurrent mutations on same resource.
f) **Session security:** Can a user access another user's data by manipulating IDs in URLs?
g) **Rate limiter stress:** Can the rate limiter be bypassed? Does it actually trigger?

**4. PLAN (5 min)**

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

**5. BUILD (bulk of time)**

Ship real code. For each fix:
- Write the fix
- Write or update vitest test
- Run `npx vitest run <test-file>` to verify
- Check browser for visual verification if UX-related

**6. VALIDATE (10 min)**

- Run full test suite: `npx vitest run`
- Browse live site: check all major pages load without errors
- Check logs: `tail -50 .manus-logs/browserConsole.log` and `tail -50 .manus-logs/networkRequests.log`
- Verify no regressions from fixes

**7. CONVERGE**

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
6. **Principles-first:** Educational context is available for users who want to understand WHY
7. **Applications-first:** Quick-action paths exist for users who want to DO things immediately

**Outcome categories:** Completed / Partial (P3) / Degraded (P2) / Blocked (P1) / Confused (P3)

═══ DIMENSION-SPECIFIC DEEP DIVES ═══

**Security Deep Dive (every pass):**
```bash
grep -rn "sql\`\|raw\`\|execute(" server/ --include="*.ts" | grep -v test | grep -v node_modules
grep -rn "dangerouslySetInnerHTML\|innerHTML" client/src --include="*.tsx" | grep -v node_modules
grep -rn "sk_live\|sk_test\|password.*=.*['\"]" server/ --include="*.ts" | grep -v test
grep -rn "publicProcedure" server/routers --include="*.ts" | grep -v test
grep -rn "Access-Control\|cors\|CORS" server/ --include="*.ts" | grep -v test | grep -v node_modules
```

**Performance Deep Dive (every 2nd pass):**
```bash
grep -rn "import.*from.*pages/" client/src/App.tsx | grep -v "lazy\|React.lazy"
grep -rn "console\.log" server/ --include="*.ts" | grep -v test | grep -v node_modules | wc -l
grep -rn "useCallback\|useMemo\|React.memo" client/src --include="*.tsx" | wc -l
grep -rn "for.*await\|forEach.*await" server/ --include="*.ts" | grep -v test
```

**Accessibility Deep Dive (every 2nd pass):**
```bash
grep -rn "<img " client/src --include="*.tsx" | grep -v "alt=" | grep -v node_modules | wc -l
grep -rn 'type="file"' client/src --include="*.tsx" | grep -v "aria-label" | wc -l
grep -rn "tabIndex\|focus()\|autoFocus" client/src --include="*.tsx" | wc -l
```

**Compliance Deep Dive (every 3rd pass):**
```bash
grep -rn "worm\|WORM\|auditTrail\|audit_trail" server/ --include="*.ts" | grep -v test | grep -v node_modules
grep -rn "retention\|purge\|archive" server/ --include="*.ts" | grep -v test | grep -v node_modules
grep -rn "consent\|gdpr\|ccpa\|dsar" server/ --include="*.ts" | grep -v test | grep -v node_modules
```

═══ CONVERGENCE TRACKING ═══

Maintain a convergence log at `docs/convergence-log-parity.md`:

```markdown
## Convergence Log

### Pass N
- Date: YYYY-MM-DD HH:MM
- Tier 1 findings: [count]
- Tier 2 findings: [count]
- Tier 3 findings: [count]
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

1. **Test pass rate:** Must remain at 11,621/11,621 (100%). Any regression = P0.
2. **No new `any` types:** Each pass should reduce, never increase, the `any` count.
3. **No new `console.log` in production code:** Each pass should reduce the count.
4. **No new files >500 lines:** Refactor before adding.
5. **AI-LEGACY baseline:** All Intelligence Engine services must maintain their current test pass rates.
6. **Security posture:** No removal of rate limiters, encryption, auth checks, or CORS restrictions.
7. **Adversarial test suite:** Must remain at 36/36 (100%). Any regression = P0.

═══ ENGINE MATURITY TARGETS ═══

| Engine | Current | Target | Key Gaps |
|---|---|---|---|
| Wealth | 3.5 | 4.0+ | Monte Carlo production hardening, plan sharing |
| People | 3.4 | 4.0+ | Outbound sync, per-provider health cards |
| Learning | 3.0 | 3.5+ | Study groups maturity, gamification |
| Data | 2.8 | 3.5+ | Additional data adapters, caching layer |
| Intelligence | 2.8 | 3.5+ | Router consolidation (21→6), prompt optimization |

═══ IMMEDIATELY START PASS 1 ═══

Begin with a fresh assessment across ALL THREE TIERS. Do not assume anything from previous sessions. Re-discover the current state of the codebase, identify the highest-priority issues, fix them, validate, and track convergence. Continue until 3/3 clean passes are confirmed.

═══ END PROMPT ═══
