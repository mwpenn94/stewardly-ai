# Prompt V4 Key Notes

## Critical Changes from Previous Prompt
1. **Phase 4 is now CONSOLIDATED** — Agent + Code Chat + AI Chat → ONE unified surface with mode switching
2. **Phase 5 is now Command Center** — incorporate stewardly-command-center repo
3. **Rule 15 — Granular Sharing & Permissions** — per-item sharing, bulk sharing, omission/redaction, permission levels (view/comment/edit/admin), share inheritance, feature-level access control, progressive disclosure as permission
4. **Termination Conditions** — stop only on: user stop, platform limit, merge-gate block, or 1-hour active stall (≥6 novel approaches attempted)
5. **Scoring** — never score 8+ on first assessment; score by weakest sub-feature on common path

## Phase Order
1. UI/UX Foundation + Progressive Disclosure + Stability
2. Learning / Training / Onboarding / Custom Workflows
3. Holistic Income / Wealth Engine
4. Unified AI Surface (Agent + Code + Chat consolidated)
5. Command Center Integration (GHL/Dripify/LinkedIn/SMS-iT)
6. Data Integrations / Pipelines
7. Holistic Optimization + Best-vs-Comparables
8. Documentation + Test Suite + User Guide

## Key Requirements
- Pull mwpenn94/emba_modules and mwpenn94/stewardly-command-center
- Extract WealthBridgeLibraryv11_QA.zip (81 files)
- AUM upline override: p² + p − 1/3 = 0 → 26.375% default
- 10 persona E2E tests × 3 viewports = 30 Playwright runs
- Progressive disclosure Levels 1-4 across all surfaces
- Tier 0 Instant surfaces for every engine (<200ms)
- Feature-level access control enforced at API + UI + AI
- Sharing UI consistent across ALL surfaces

## Current State (from previous passes)
- 42 passes completed, convergence achieved multiple times
- Phase scores: 1=8.5, 2=8.8, 3=8.6, 4=8.4, 5=8.9, 6=8.5, 7=8.6, 8=8.8
- 8,366 tests passing
- 30 integration providers (9 keyless: SEC EDGAR, FINRA, Treasury Fiscal, GLEIF, World Bank, OpenFIGI, CoinGecko, IMF, ExchangeRate-API)
- OpenClaw upgraded to ReAct loop
- 5 new keyless integrations added (Pass 56: +IMF DataMapper, +ExchangeRate-API)

## Immediate Actions
1. Pull the 3 repos (stewardly-ai, emba_modules, stewardly-command-center)
2. Extract WealthBridgeLibraryv11_QA.zip
3. Re-assess Phase 1 with new criteria (including Rule 15 sharing UI)
4. Start fixing lowest-scoring criterion
