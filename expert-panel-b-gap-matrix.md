# Expert Panel B — Second-Pass Gap Matrix

## Assessment Summary
After Panel A optimization, the People + Data engine has 7 new services (1,904 lines), 8 new DB tables, 19 router procedures, and 57 E2E tests passing. The cadence library is 100% aligned (7/7 cadences from cadence_library.json). All 9 prompt library prompts are covered except 2.

## Remaining Gaps (Priority-Ordered)

### GAP-B1: Weekly Summary Generation (PROMPT 8) — HIGH
- **What:** The claude_api_prompt_library defines PROMPT 8 (WEEKLY_SUMMARY_GENERATION) covering headline metrics, pipeline coverage, funnel-by-funnel updates, compliance health, variances, action items, and next week focus.
- **Current state:** No weekly summary service exists.
- **Fix:** Create `server/services/weeklySummaryGeneration.ts` with LLM-powered summary generation and wire to router.

### GAP-B2: Cadence Variant Creation (PROMPT 9) — HIGH
- **What:** The prompt library defines PROMPT 9 (CADENCE_VARIANT_CREATION) for creating geography/compliance variants of existing cadences.
- **Current state:** The NM variant is hardcoded in cadenceEngine.ts but no dynamic variant creation service exists.
- **Fix:** Create `server/services/cadenceVariantCreation.ts` with LLM-powered variant generation and wire to router.

### GAP-B3: Funnel-by-Funnel Metrics (v10 spec) — HIGH
- **What:** The v10 execution prompt specifies funnel-by-funnel tracking (recruit funnel, HNW funnel, COI funnel, B2B funnel, dormant re-engagement funnel) with CAC/ROI/LTV per funnel.
- **Current state:** Lead source performance exists but not funnel-level aggregation.
- **Fix:** Create `server/services/funnelMetrics.ts` with per-funnel CAC/ROI/LTV calculations.

### GAP-B4: Error Handling Hardening — MODERATE
- **What:** complianceAudit.ts and patternTransition.ts have 0 try/catch blocks.
- **Fix:** Add defensive error handling to all synchronous service functions.

### GAP-B5: Frontend Cadence Management UI — DEFERRED (not blocking convergence)
- **What:** No frontend pages consume the cadenceEngine router yet. The OutreachAutomation page exists but uses placeholder data.
- **Status:** Backend services are complete and tested. Frontend wiring is a separate feature scope.
- **Decision:** DEFER — backend convergence is the current target.

## Convergence Status
- Prompts 1-7: COVERED
- Prompt 8 (Weekly Summary): MISSING → GAP-B1
- Prompt 9 (Cadence Variant): MISSING → GAP-B2
- Funnel metrics: MISSING → GAP-B3
- Error handling: WEAK → GAP-B4
- Frontend: DEFERRED (not blocking)
