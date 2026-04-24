# Expert Panel A2 — Gap Matrix (People + Data Engine Phase 2)

## Assessment Date: 2026-04-24
## Scope: 3 Next Steps + Remaining Parity Items

---

## GAP-A2-01: OutreachAutomation Frontend — Zero tRPC Wiring (CRITICAL)
- **Current:** 422-line page uses entirely static mock data (INITIAL_WORKFLOWS). No connection to cadenceEngine router's 31 procedures.
- **Required:** Wire to `trpc.cadenceEngine.*` for: listBaseCadences, enrollLead, pauseEnrollment, resumeEnrollment, stopEnrollment, draftTouch, logTouch, getEnrollmentStatus, listEnrollments, checkThrottle, getExpectedMetrics.
- **Impact:** The entire cadence engine backend is unreachable from the UI.
- **Fix:** Rewrite OutreachAutomation.tsx to use real tRPC data with proper loading/error states.

## GAP-A2-02: Weekly Summary Scheduled Endpoint (CRITICAL)
- **Current:** `buildStaticSummary()` and `generateWeeklySummary()` services exist but no `/api/scheduled/weekly-summary` endpoint to receive POST from scheduled task.
- **Required:** Create the endpoint per the periodic_updates pattern (OAuth wrapper, user role allowed, POST handler).
- **Impact:** Weekly summaries cannot be triggered by the scheduled task system.
- **Fix:** Add `/api/scheduled/weekly-summary` endpoint + schedule the cron job.

## GAP-A2-03: Compliance Dashboard — Cadence Audit Integration (CRITICAL)
- **Current:** ComplianceAudit page uses old `compliance.*` router (reviewContent, getDashboardStats). The new cadenceEngine compliance services (auditMessage, selectDailyAuditSample, generateMonthlySummary, validateEsiTracking) are not surfaced in any UI.
- **Required:** Create a CadenceComplianceDashboard panel showing daily audit samples, monthly summaries, ESI tracking status, and message audit grades.
- **Impact:** Compliance officers cannot review cadence-level audit data.
- **Fix:** Create CadenceComplianceDashboard.tsx and wire to cadenceEngine router procedures.

## GAP-A2-04: Cadence Enrollment UI (HIGH)
- **Current:** No UI for enrolling a lead into a cadence from the LeadDetail page.
- **Required:** Add "Enroll in Cadence" action button on LeadDetail that opens a cadence selector dialog, shows touch preview, and calls enrollLead.
- **Impact:** Advisors must use API directly to enroll leads — no self-service.
- **Fix:** Add CadenceEnrollmentDialog component usable from LeadDetail + OutreachAutomation.

## GAP-A2-05: Touch Drafting + Approval UI (HIGH)
- **Current:** draftTouch procedure exists but no UI to preview, edit, approve, or reject drafted touches.
- **Required:** Touch draft review panel with compliance check badges, edit capability, and approve/reject buttons.
- **Impact:** Drafted touches cannot be reviewed before sending.
- **Fix:** Add TouchDraftReview component within OutreachAutomation.

## GAP-A2-06: MEDDPICC Scorecard UI (HIGH)
- **Current:** completeMeddpiccFromTranscript, getMeddpiccFocusAreas procedures exist but no UI renders the MEDDPICC scorecard on LeadDetail.
- **Required:** Visual scorecard showing 8 fields with confidence levels, evidence quotes, focus areas, and stage recommendation.
- **Impact:** MEDDPICC data is collected but invisible to advisors.
- **Fix:** Add MeddpiccScorecard component to LeadDetail page.

## GAP-A2-07: Funnel Metrics Dashboard Panel (HIGH)
- **Current:** calculateFunnelMetrics, calculateFunnelRollup, getExpectedMetrics procedures exist but no UI.
- **Required:** Funnel performance dashboard showing CAC, ROI, LTV per funnel with expected vs actual comparison.
- **Impact:** Marketing ROI data is computed but not visible.
- **Fix:** Add FunnelMetricsPanel to PeopleHub Marketing tab.

## GAP-A2-08: Pattern Transition Indicator (MODERATE)
- **Current:** assessTransition, calculatePipelineCoverage services exist but no UI shows the advisor's current pattern or transition readiness.
- **Required:** Pattern transition badge/indicator on the PeopleHub dashboard showing current pattern, next pattern, and readiness score.
- **Impact:** Advisors don't know their growth trajectory.
- **Fix:** Add PatternTransitionBadge component to PeopleHub Pipeline tab.

## GAP-A2-09: Reply Analysis + Auto-Pause UI (MODERATE)
- **Current:** classifyReply, processOptOut, calculateOooReschedule services exist but no UI shows reply classifications or auto-pause status.
- **Required:** Reply feed panel showing classified replies with recommended actions.
- **Impact:** Reply intelligence is computed but not actionable from UI.
- **Fix:** Add ReplyInbox component to OutreachAutomation.

## GAP-A2-10: Recruit Scoring UI (MODERATE)
- **Current:** scoreRecruitCandidate service exists but no UI for entering candidate data or viewing 6-dimension scores.
- **Required:** Recruit scoring form + radar chart visualization.
- **Impact:** Recruiting managers cannot use the scoring engine from UI.
- **Fix:** Add RecruitScoringPanel to the Team/Manager section.

---

## Priority Implementation Order:
1. GAP-A2-01 (OutreachAutomation rewrite) — unlocks all cadence UI
2. GAP-A2-04 + GAP-A2-05 (Enrollment + Touch Draft) — core workflow
3. GAP-A2-03 (Compliance Dashboard) — governance requirement
4. GAP-A2-02 (Weekly Summary endpoint) — scheduled task enablement
5. GAP-A2-06 (MEDDPICC Scorecard) — sales intelligence
6. GAP-A2-07 (Funnel Metrics) — marketing ROI
7. GAP-A2-08 + GAP-A2-09 + GAP-A2-10 (Pattern/Reply/Recruit) — progressive disclosure
