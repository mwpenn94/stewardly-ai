# Prompt v5 — Key Execution Notes

## Termination Conditions
1. User explicitly says "stop" / "pause" / "done" / "enough"
2. All 8 phases converged at ≥8 AND post-convergence Cycle 2 (≥10 or 9-capped) complete AND 3 consecutive full-sweep passes show zero improvement opportunities → emit CONVERGED_FINAL.md
3. External blocker with no workaround after 3 attempts → log to BLOCKED_ON.md, skip, continue other work
4. 1-hour wall-clock stall with zero score improvement despite ≥6 distinct novel approaches → emit STALLED.md

## Key Differences from v4
- Phase 4 is now **Unified AI Surface** (consolidates Agent + Code Chat + AI Chat into ONE surface with mode switching)
- Phase 5 is now **Command Center Integration** (stewardly-command-center repo)
- Phase 6 is now **Data Integrations** (including Empower/EveryDollar PFM)
- Phase 7 is now **Holistic Optimization** (cross-surface audit)
- Phase 8 requires **Playwright E2E** with 10 personas × 3 viewports = 30 test runs
- **Rule 15**: Unified sharing/permission system across ALL surfaces
- **Rule 13**: Every pass ships Playwright E2E test additions
- **Forbidden**: Building 3 separate AI surfaces, hardcoding defaults, ignoring multitenancy

## Current State Assessment
- 8,389+ tests passing (15 new in Pass 56)
- 30 integration providers (9 keyless)
- Passes 1-56 completed
- Phase scores: P1=8.5, P2=8.8, P3=8.6, P4=8.4, P5=8.9, P6=8.5, P7=8.6, P8=8.8
- Post-convergence Cycle 1 in progress

## Pass 56 Deliverables
1. IMF DataMapper pipeline (keyless) — World GDP, inflation, current account for 6 economies + world
2. ExchangeRate-API pipeline (keyless) — 15 USD pairs, 3 EUR crosses, DXY proxy index
3. UnifiedAI.tsx — consolidated Chat/CodeChat/AgentManager into /ai route with mode switching
4. EmailCampaign.tsx — full campaign management page with AI content generation
5. Cron jobs, seed data, rate profiles, freshness registry all updated

## Immediate Queue
1. Continue recursive optimization passes
2. Phase 5 Command Center integration from stewardly-command-center repo
3. Playwright E2E infrastructure setup
4. Side-by-side comparisons vs Manus, Claude Code, Claude.ai
5. Continue toward convergence Cycle 2 (all ≥9 or 10)
