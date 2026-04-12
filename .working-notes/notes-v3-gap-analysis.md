# V3 Continuation Prompt — Gap Analysis

## NEW items from v3 NOT in current todo.md:

### Layer 1: Intelligent Advisor Copilot
1. /MEETING_INTELLIGENCE — pre-meeting briefs, live transcription, post-meeting summaries, action extraction, calendar push
2. /PROACTIVE_INSIGHTS — next-best-action engine (portfolio drift, tax-loss harvesting, spending anomalies, life event triggers, compliance alerts, engagement scoring)
3. /FINANCIAL_PLANNING — Monte Carlo simulations, Social Security optimization, Roth conversion analysis, goal tracker
4. /BEHAVIORAL_COACH — behavioral finance nudges, financial wellness score (FinHealth framework), market downturn reframing
5. /COMPLIANCE_AUTOMATION — pre-delivery content review, communication surveillance, suitability documentation (Reg BI), regulatory filing tracking

### Layer 2: Platform Infrastructure
6. Firm-branded landing pages (admin editor with live preview, URL structure /firm/{slug}) — PARTIALLY exists as org landing pages
7. Global Admin layer (above Firm Admin) — PARTIALLY exists in schema, needs dashboard UI
8. Enhanced progressive auth (4 tiers) — PARTIALLY exists, needs completion
9. Marketplace foundation — /ADVISOR_MATCHING (match unaffiliated users with professionals), /PRODUCT_COMPARISON (multi-carrier side-by-side)
10. Conversational response improvements — voice mode max 75 words, text mode max 150/300 words, progressive disclosure, tone rules, auto-scroll
11. Voice mode enhancements — Web Speech API with 1.5s silence auto-send, Edge TTS via Cloudflare Worker, waveform animation, financial term dictionary

### Layer 3: Stress-Test & Validation
12. Full test playbook (50+ tests): functional, security, role hierarchy, performance, responsive, accessibility, compliance, integration tests

### Secrets needed:
- DEEPGRAM_API_KEY (meeting transcription)
- EDGE_TTS_PROXY_URL (Cloudflare Worker for TTS)
- PLAID_CLIENT_ID + PLAID_SECRET (account aggregation)
- DAILY_API_KEY (video calls)

## Items ALREADY covered in todo.md:
- 5-layer AI personalization (done)
- Organization CRUD (backend done, UI pending)
- Progressive auth (partially done)
- Voice mode (basic exists)
- View-as system (schema exists)
- Workflow orchestration (listed)
- Recommendation/matching (listed)
