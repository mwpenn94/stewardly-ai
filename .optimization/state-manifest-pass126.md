# State Manifest — Pass 126 (Manus Execution Prompt v2)

**Session:** pass126-20260418
**Type:** Fresh session
**Runner:** Manus
**Date:** 2026-04-18

## Codebase Metrics

| Metric | Value |
|--------|-------|
| Source files | 1,633 |
| Test files | 621 |
| Page components | 170 |
| Server routers | 105 |
| Routes in App.tsx | ~60 |
| Sidebar sections | 7 (Core, Wealth, Capabilities, Professional, Leadership, Platform, Learn) |

## Track Mapping

### Track 1 — Wealth Engine
- **Sidebar entry:** "Wealth Engine" under Wealth section (minRole: user)
- **Route:** /wealth-engine → Calculators.tsx
- **Sub-surfaces:** 11 calculator panels (PanelsA-J), engine dashboard, financial twin, products, comparables, tax projector, estate planning, financial planning, risk assessment, income projection, insurance analysis, social security, medicare, protection score, my-plan
- **Chat tools:** 7 calculator tools (retirement, tax, protection, monte carlo, estate, entity comparison, income projection)
- **Status:** LIVE, accessible, functional

### Track 2 — Learning Engine
- **Sidebar entry:** "Learn" item (minRole: user)
- **Route:** /learning → LearningHome.tsx
- **Sub-surfaces:** 15 pages (tracks, exam simulator, discipline deep dive, case study simulator, connections, achievements, licenses, studio, review, search, flashcards, quiz, study buddy)
- **Status:** LIVE, accessible, functional

### Track 3 — Command Center
- **Sidebar entry:** "People" under Professional section (minRole: advisor)
- **Route:** /people/clients → PeopleHub.tsx (13 tabs including Command Center, CRM Sync, Email Campaigns, Marketing Assets, Outreach Automation, Compliance, etc.)
- **Status:** LIVE but gated to advisor+ role. Command Center is a tab within PeopleHub, not a standalone surface.

### Track 4 — App Shell & AI Chat
- **Sidebar entries:** Chat (Core), Settings, Help (Footer)
- **Route:** /chat → Chat.tsx
- **Chat tools wired:** 18 total (5 search + 7 calculator + 6 agent)
- **Tool activity display:** Inline tool cards with icons and status
- **Capability discovery:** 10 chips in ChatGreetingV2
- **Status:** LIVE, accessible, functional

## Gaps Identified (Pre-Flight)

1. **Agent Hub / Manus-Next is a status dashboard, not live capabilities** — user feedback already received; capabilities now in chat but dashboard remains
2. **TTS Audio playback warnings** — repeated "[TTS] Audio playback error" in browser console
3. **Command Center buried under People tab** — not directly accessible from sidebar for non-advisor users
4. **No Learning Engine tools in AI chat** — calculators and agent tools are wired but no learning-specific tools (quiz, flashcard, exam, CE tracking)
5. **No Command Center tools in AI chat** — no CRM, outreach, or marketing tools in chat
6. **Capability chips in chat don't cover all 4 tracks** — missing Learning and Command Center capabilities
7. **ManusNextDashboard still exists as a status page** — should either be repurposed or removed
8. **Practice Management noted as "design reference, not in scope"** — per v2 prompt
