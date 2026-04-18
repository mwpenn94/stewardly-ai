# Pass 126 — Landscape Gap List

## Track 1: Wealth Engine (7 gaps)

| # | Gap | Severity | Persona Impact | Proposed Fix |
|---|-----|----------|---------------|-------------|
| W1 | Calculator tools in chat lack learning context — user asks "explain this projection" and gets generic response, not tied to their calculator state | Medium | Diana, Henry | Add calculator-state-aware context injection to chat system prompt |
| W2 | No "save scenario" prompt after calculator tool runs in chat | Medium | Marcus, Henry | Add follow-up suggestion after calculator tool results |
| W3 | Cost transparency section in CostBenefitPanel not connected to real per-task cost data | Low | Priya | Wire actual cost tracking when available |
| W4 | Parity Dashboard on Comparables shows static data, not live capability health | Low | Priya | Connect to actual adapter health checks |
| W5 | Wealth Engine chat tools don't include AUM/practice engine tools | Medium | Diana, Priya | Add practice-engine-aware tools to chat |
| W6 | No inline chart/visualization rendering when calculator tools return data in chat | Medium | All 4 | Add chart rendering for calculator results in chat messages |
| W7 | ManusNextDashboard still exists as status page — confusing alongside live chat capabilities | Low | All 4 | Repurpose as system health or remove |

## Track 2: Learning Engine (5 gaps)

| # | Gap | Severity | Persona Impact | Proposed Fix |
|---|-----|----------|---------------|-------------|
| L1 | **No Learning Engine tools in AI chat** — users cannot ask "quiz me on Series 65" or "what CE credits do I need" through chat | High | Marcus, Priya | Add learning-specific chat tools (quiz, flashcard, CE tracking, exam prep) |
| L2 | Learning sidebar item visible only to role >= user — guests cannot discover it | Low | Marcus (pre-signup) | Acceptable; guests see chat which can describe learning features |
| L3 | No capability chip for Learning in chat welcome | Medium | Marcus | Add Learning capability chips to ChatGreetingV2 |
| L4 | Study Buddy page exists but not surfaced in chat tool discovery | Medium | Marcus | Add study buddy as chat capability |
| L5 | No cross-track link from Wealth Engine results to relevant learning modules | Low | Marcus | Future enhancement — add "learn more" links |

## Track 3: Command Center (6 gaps)

| # | Gap | Severity | Persona Impact | Proposed Fix |
|---|-----|----------|---------------|-------------|
| C1 | **No Command Center tools in AI chat** — users cannot ask "draft an outreach email" or "show my pipeline" through chat | High | Diana, Marcus | Add CRM/marketing chat tools |
| C2 | Command Center buried as tab within PeopleHub — not directly discoverable | Medium | Diana, Henry | Add direct sidebar entry or prominent link |
| C3 | No capability chip for CRM/Marketing in chat welcome | Medium | Diana | Add Command Center capability chips to ChatGreetingV2 |
| C4 | Email Campaigns, Marketing Assets, Outreach Automation are separate tabs but could be unified | Low | Diana | Consolidation candidate for Pass 3 |
| C5 | No COI (Center of Influence) network visualization or management surface | Medium | Diana | Future enhancement — COI relationship mapping |
| C6 | GHL integration status not visible to users | Low | Diana, Priya | Add integration health indicator |

## Track 4: App Shell & AI Chat (8 gaps)

| # | Gap | Severity | Persona Impact | Proposed Fix |
|---|-----|----------|---------------|-------------|
| A1 | **TTS Audio playback errors** — repeated warnings in console | Medium | Henry, Diana | Fix TTS error handling to gracefully degrade |
| A2 | Capability chips in ChatGreetingV2 only cover Wealth + general tools — missing Learning and Command Center | High | All 4 | Add Learning and Command Center chips |
| A3 | Tool activity cards in chat don't show results inline — just status | Medium | All 4 | Enhance tool cards to show result previews |
| A4 | No "/capabilities" or "/tools" slash command in chat | Low | Marcus | Add slash command for tool discovery |
| A5 | Chat welcome doesn't adapt to user role — advisor sees same chips as general user | Medium | Diana, Priya | Role-aware capability chips |
| A6 | No keyboard shortcut for tool discovery (Ctrl+/) goes to ContextualHelp, not tool list | Low | Diana | Acceptable — ContextualHelp serves this purpose |
| A7 | Self-discovery trigger fires but response not always visible to user | Low | All 4 | Verify self-discovery UI rendering |
| A8 | Agent Hub sidebar item points to ManusNextDashboard instead of chat with tool context | Medium | All 4 | Redirect Agent Hub to /chat or remove |

## Priority Execution Order (Pass 1)

1. **L1 + C1** — Add Learning and Command Center tools to AI chat (HIGH)
2. **A2 + L3 + C3** — Add missing capability chips to ChatGreetingV2 (HIGH)
3. **A1** — Fix TTS audio playback error handling (MEDIUM)
4. **A8** — Redirect Agent Hub to chat or repurpose (MEDIUM)
5. **W7** — Repurpose ManusNextDashboard (LOW)
