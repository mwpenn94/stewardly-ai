# Audit v2 Action Items — Prioritized

## ALREADY FIXED
- DB tables: 64 missing tables migrated (92 total now) — Phase 5C DONE
- Touch targets: 40-44px WCAG AAA — H3 DONE
- Robots.txt: ClaudeBot allowed

## FIXED IN AUDIT v4 (March 26, 2026)
- Guest migration auth vulnerability — S1 DONE
- XSS via dangerouslySetInnerHTML — S2 DONE
- WebSocket CORS wildcard — S3 DONE
- Security headers not applied as middleware — S4 DONE
- CSP unsafe-eval/unsafe-inline — S5 DONE
- Encryption key hardcoded fallback — S6 DONE
- Cookie sameSite "none" — S7 DONE
- 1-year session duration — S8 DONE
- No rate limiting — S9 DONE
- 50MB body limit — S10 DONE
- No CORS middleware — S11 DONE
- Incomplete RBAC stubs — S12 DONE
- Unsafe JSON.parse — S13 DONE
- Hash chain audit logging (spec gap) — G1 DONE
- DSAR pipeline (spec gap) — G2 DONE
- Role elevation auto-revoke (spec gap) — G3 DONE
- Env var validation — L1 DONE
- .env.example — L2 DONE
- Cookie domain scoping — L3 DONE
- Spec accuracy — L4 DONE

## Phase 1: Privacy (F avg 2.1 → 3.5) — ALL DONE
1. 1A: /privacy page — DONE (`client/src/pages/Privacy.tsx`, 10KB, 5 sections covering data collection, processing, retention, rights, security)
2. 1B: Privacy/terms footer links on ALL pages — DONE (`client/src/components/GlobalFooter.tsx`, persistent footer with Privacy Policy, Terms of Service, Help links)
3. 1C: Persistent financial disclaimer footer — DONE (amber disclaimer in GlobalFooter: "AI-powered informational content only... consult licensed professional")
4. 1D: PII masking pipeline before LLM calls — DONE (`server/prompts.ts`: `detectPII()`, `stripPII()`, `maskPIIForLLM()` covering SSN, credit cards, phones, emails, accounts)
5. 1E: "Privacy & Data" settings tab — DONE (`client/src/pages/settings/PrivacyDataTab.tsx`, 10KB: consent management, data export, activity summary, account deletion)
6. 1F: Per-source consent tracking — DONE (`server/routers/consent.ts`: list, check, grant, revoke, revokeAll with audit logging for 6 consent types)

## Phase 2: Transparency (G avg 2.4 → 3.5) — ALL DONE
1. 2A: AI identity disclosure at session start — DONE (AI badge on every assistant message in `MessageList.tsx`, disclosed in Privacy.tsx)
2. 2B: "AI" badge on assistant messages — DONE (`MessageList.tsx:73-77`: Sparkles icon + "AI" text badge on every assistant message)
3. 2C: Reasoning transparency [REASONING_START/END] — DONE (`client/src/components/ReasoningChain.tsx`, 7KB: 5-step collapsible chain with confidence scores)
4. 2D: Fairness testing baseline — DONE (`server/services/fairnessTesting.ts` + `FairnessTestDashboard.tsx`: 20 demographic-varied prompts, bias detection, admin dashboard)

## Phase 3: Suitability (D avg 2.7 → 3.5) — ALL DONE
1. 3A: "Connect with Professional" escalation — DONE (`server/services/proactiveEscalation.ts`: hard triggers, availability management, Daily.co video consultation booking)
2. 3B: Topic-specific disclaimers — DONE (`server/services/dynamicDisclaimers.ts`: 7 topics, topic-change detection, version tracking, interaction analytics)
3. 3C: COI disclosure in marketplace — DONE (`client/src/pages/CoiNetwork.tsx`: COI contact management with specialties, relationship strength, analytics)

## Phase 4: Infrastructure (I avg 2.2 → 3.0) — ALL DONE
1. 4A: BCP documentation — DONE (`client/src/pages/BCP.tsx`, 19KB: 7 dependencies with RTO/RPO targets, fallback strategies, health dashboard)
2. 4B: LLM provider failover — DONE (`server/services/llmFailover.ts`: multi-provider failover, circuit breaker, health tracking, complexity-based routing)
3. 4C: Error tracking + monitoring — DONE (`server/services/errorHandling.ts`: structured error logging to DB, retry with exponential backoff, circuit breaker, error stats)

## Phase 5: Quick Wins — PREVIOUSLY COMPLETED
1. 5A: Fix "Loading checklist..." — DONE
2. 5B: Replace generic suggested prompts — DONE
3. 5D: Conversational tone rules in system prompt — DONE
