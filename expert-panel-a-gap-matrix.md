# Expert Panel A — Gap Matrix: People + Data Engines

**Date:** 2026-04-24
**Assessed against:** cadence_library.json, claude_api_prompt_library.md, Manus_AI_Execution_Prompt_v10.md, recursive-optimization-converged-final

---

## CRITICAL GAPS (Must implement)

### GAP-01: Cadence Engine — No cadence_library.json integration
**Current:** OutreachAutomation.tsx has hardcoded demo workflows. No server-side cadence library.
**Required:** 7 cadences from cadence_library.json (HNW_PROSPECT_12TOUCH, HNW_NM_12TOUCH, RECRUIT_TIER1_12TOUCH, COI_MAINTENANCE_QUARTERLY, STEWARDLY_AFFILIATE_ONBOARDING, WTA_PCMP_B2B_PROSPECT, DORMANT_REENGAGEMENT) with full touch sequences, compliance overlays, ESI pre-approval gates, stop-on-reply logic, and GHL workflow mapping.
**Impact:** Core operational cadence engine is placeholder-only.

### GAP-02: 6-Dimension Recruit Scoring — Missing
**Current:** Expert weights exist for propensity scoring (8 segments) but NOT the 6-dimension recruit scoring from claude_api_prompt_library.md (production_fit, cultural_fit, geographic_fit, network_leverage, compliance_posture, engagement_signal).
**Required:** Full 6-dimension scoring with weighted composite (20/15/10/20/20/15), tier assignment (Tier1/2/3/Hold), cascade potential estimation.
**Impact:** Recruit candidates cannot be scored per v10 methodology.

### GAP-03: HNW Narrative Scoring — Missing
**Current:** No HNW prospect narrative scoring (wealth_signal_strength, fit_with_HNW_funnel, engagement_difficulty_estimate, recommended_cadence, personalization_inputs).
**Required:** Full PROMPT 2 from claude_api_prompt_library.md with cadence recommendation engine.
**Impact:** HNW prospects cannot be evaluated and routed to appropriate cadences.

### GAP-04: Cadence Touch Drafting — Missing
**Current:** Email campaign service has template rendering but no cadence-specific touch drafting with compliance checks.
**Required:** PROMPT 3 from claude_api_prompt_library.md — personalized touch generation with ESI verification, anti-rebate language check, FINRA 2210 compliance, TCPA consent verification, performance projection blocking.
**Impact:** Outbound touches cannot be generated with compliance gates.

### GAP-05: MEDDPICC Tracking — Missing from lead_pipeline schema
**Current:** lead_pipeline has pipelineStage varchar but no MEDDPICC fields.
**Required per v10:** 8 custom fields per opportunity: Metrics, EconomicBuyer, DecisionCriteria, DecisionProcess, PaperProcess, IdentifyPain, Champion, Competition.
**Impact:** Deal qualification methodology not trackable.

### GAP-06: Reply Analysis + Cadence Pause — Missing
**Current:** SMS-iT opt-out handling exists. No reply detection → cadence pause → manual queue routing.
**Required per global_cadence_rules:** auto_pause_cadence on reply, route to manual queue, OOO detection with reschedule.
**Impact:** Cadence automation lacks reply intelligence.

### GAP-07: Delivery Throttling — Missing
**Current:** OUTREACH_ENABLED kill switch exists. No per-channel rate limiting.
**Required per global_cadence_rules:** max 50 emails/domain/day, max 25 LinkedIn connections/day, max 10 InMails/day, max 100 calls/day, auto-throttle at 80%, hard stop at 100%.
**Impact:** Risk of deliverability collapse or LinkedIn account restriction.

---

## HIGH GAPS (Should implement)

### GAP-08: Compliance Audit Cadence — Incomplete
**Current:** Compliance copilot reviews content. No daily random-sample audit of sent messages.
**Required per v10:** Daily 1-2 random-sample audits, monthly 20-message full audit, audit log with Pass/Conditional Pass/Fail.
**Impact:** Compliance monitoring is reactive, not proactive.

### GAP-09: Pattern Transition Engine — Missing
**Current:** No pattern transition tracking (C6: AUM signed/month, C7: >$500K threshold, C8: active affiliates, C9: new producers).
**Required per v10:** PatternTransition metrics with monthly assessment and recommendation.
**Impact:** Cannot detect when to transition from Pattern 4 to Pattern 5.

### GAP-10: Cascade Tracking — Missing
**Current:** No cascade tracking (when Tier 1 signs → auto-queue outreach to their listed colleagues).
**Required per v10 Workable section:** Cascade tracking with automatic colleague outreach queuing.
**Impact:** Network leverage multiplier not captured.

### GAP-11: Signal Monitoring Integration Points — Stub only
**Current:** Data pipeline tables exist (import_jobs with 14 source types). No actual n8n workflow integration for: SEC Form 4, county recorder, FAA registry, USCG registry, IRS Form 990, FEC donor file.
**Required per v10:** Daily 3-4 AM scheduled scrapes with append to prospect pool.
**Impact:** HNW signal sourcing is manual.

### GAP-12: Variable Naming Convention — Not enforced
**Current:** Email template uses {{recipientName}} style. Cadence library uses {{prospect_first_name}}, {{prospect_company}}, {{specific_observation}}, etc.
**Required:** Align template variables to cadence_library.json variable_naming_convention.
**Impact:** Templates won't render correctly when cadence engine activates.

---

## MODERATE GAPS (Nice to have for convergence)

### GAP-13: Compliance Reply Analysis (PROMPT 4) — Missing
**Current:** Compliance copilot exists but doesn't analyze replies for sentiment/intent.
**Required per claude_api_prompt_library.md PROMPT 4:** Reply classification (interested/objection/info_request/opt_out/OOO/wrong_person) with recommended response template.

### GAP-14: Daily KPI Dashboard Alignment — Partial
**Current:** AdminPlatformReports and CommandCenter exist. No v10-aligned daily brief structure.
**Required:** Pipeline Coverage health metrics (Discovery 10-15×, Solution Design 5-7×, Validation 3-4×, Commit 1.5-2×), conversion rate benchmarks.

### GAP-15: ESI Pre-Approval ID Tracking — Missing from schema
**Current:** No ESI pre-approval ID or expiry date fields on opportunities/campaigns.
**Required per v10 GHL section:** AntiRebateLanguageVerified (Boolean), ESIPreApprovalID (string), ESIPreApprovalExpiry (date) per opportunity.

---

## SUMMARY

| Priority | Count | Status |
|----------|-------|--------|
| CRITICAL | 7 | All missing |
| HIGH | 5 | All missing |
| MODERATE | 3 | All missing |
| **TOTAL** | **15** | **0 converged** |

**Convergence counter: 0/3**
