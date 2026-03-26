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

## Phase 1: Privacy (F avg 2.1 → 3.5)
1. 1A: /privacy page
2. 1B: Privacy/terms footer links on ALL pages
3. 1C: Persistent financial disclaimer footer
4. 1D: PII masking pipeline before LLM calls
5. 1E: "Privacy & Data" settings tab (download, delete, connected services)
6. 1F: Per-source consent tracking

## Phase 2: Transparency (G avg 2.4 → 3.5)
1. 2A: AI identity disclosure at session start
2. 2B: "AI" badge on assistant messages
3. 2C: Reasoning transparency [REASONING_START/END]
4. 2D: Fairness testing baseline

## Phase 3: Suitability (D avg 2.7 → 3.5)
1. 3A: "Connect with Professional" escalation
2. 3B: Topic-specific disclaimers
3. 3C: COI disclosure in marketplace

## Phase 4: Infrastructure (I avg 2.2 → 3.0)
1. 4A: BCP documentation
2. 4B: LLM provider failover
3. 4C: Error tracking + monitoring

## Phase 5: Quick Wins
1. 5A: Fix "Loading checklist..."
2. 5B: Replace generic suggested prompts
3. 5D: Conversational tone rules in system prompt
