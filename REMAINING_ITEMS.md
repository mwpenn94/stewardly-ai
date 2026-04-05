# Stewardly — Remaining Items to Complete

**Date:** April 5, 2026
**Current State:** 314 tables, 158 services, 65 routers, 2,249 tests passing, 0 TS errors
**What's Done:** Intelligence layer (complete), schema (complete), core business services (complete), tRPC routers (complete for built services)
**What's Left:** Seed data, UI pages, components, remaining service files, webhook routers, cron jobs, web search

---

## Section 1: Manus Prompt (Copy-Paste Ready)

Copy everything below into a Manus task to auto-complete what it can.

```
# STEWARDLY COMPLETION — Remaining Items

You are completing the Stewardly AI financial advisory platform.
The intelligence layer, schema (309 tables), core services (151 files), and routers (65 files) are DONE.
Do NOT modify existing files unless appending. Work in NEW files only.
Run `pnpm run check` after every batch. Fix all TS errors before proceeding.
Run `pnpm test` at the end — 0 regressions allowed.

## PRIORITY 1: Web Search Tool (enables AI-powered features)

Create server/services/webSearchTool.ts:
  export async function executeWebSearch(query: string, options?: { includeDomains?: string[] }): Promise<string>
  Cascade: 1) Tavily (TAVILY_API_KEY, $0.008/search) → 2) Brave (BRAVE_SEARCH_API_KEY) → 3) graceful fallback
  Default includeDomains: irs.gov, sec.gov, finra.org, ssa.gov, treasury.gov, investopedia.com, kitces.com
  Return: formatted search results as string (max 2000 chars)
  If no API keys: return "Web search unavailable — using training data only"

## PRIORITY 2: 13 UI Components

Create in client/src/components/:

LeadCaptureGate.tsx — Calculator email gate overlay. Props: calculatorType, onCapture(email). Mobile: bottom sheet. Desktop: centered modal. CAN-SPAM: unchecked consent checkbox + privacy link.
CalculatorInsight.tsx — AI analysis display. Props: insight (string), loading (boolean). Streaming skeleton loader. "Try Again" button on failure.
VerificationBadge.tsx — Credential badge pill. Props: provider, status, label. Colors: verified=green, expired=amber, revoked=red.
PropensityGauge.tsx — Score visualization 0-100. Props: score, tier. Control group shows "Score pending".
LeadCard.tsx — Pipeline card. Props: lead data. Shows propensity badge, source, key fields, action buttons.
PiiMaskedField.tsx — Shows j***@example.com. Props: value, onReveal. "Reveal" button checks role.
ConsentCheckbox.tsx — CAN-SPAM compliant. Unchecked by default. Links to /privacy.
EmbedCodeGenerator.tsx — Generates iframe snippet. Props: baseUrl, advisorId, calculatorType. Copy button.
SEOHead.tsx — Per-route meta tags, OG, Twitter cards. Props: title, description, canonical, image.
FinancialScoreCard.tsx — Shareable score gauge 0-100. Canvas-based share image generation.
FileUploader.tsx — Drag-and-drop with format validation. Props: accept, maxSize, onUpload. Progress bar.
ColumnMapper.tsx — Interactive drag-and-drop column-to-field mapping. Props: headers, targetFields, onMap.
ImportProgress.tsx — Real-time progress bar. Props: total, imported, skipped, failed, status.

## PRIORITY 3: 14 UI Pages

Create in client/src/pages/:

ImportData.tsx — Drag-and-drop file upload → column mapping → preview → progress → history. Uses trpc.dataImport.
LeadPipeline.tsx — Kanban board (new/enriched/scored/qualified/assigned/contacted/meeting/proposal/converted). PII masked in list. Uses trpc.leadPipeline.
FinancialProtectionScore.tsx — Mobile-first (320px min). 12-dimension questionnaire → score gauge → share. Gate personalized plan behind email.
Community.tsx — Forum for authenticated professionals. Post list → post detail → reply.
Unsubscribe.tsx — One-click CAN-SPAM unsubscribe. Token-validated URL.
AdminSystemHealth.tsx — Cron status grid (28 jobs), error rates, unacknowledged alerts. Admin only.
AdminDataFreshness.tsx — Provider status grid with refresh/pause controls. Admin only.
AdminLeadSources.tsx — Lead source ROI comparison table with charts. Admin only.
AdminRateManagement.tsx — Rate profiles grid + AI recommendations. Admin only.
AdminPlatformReports.tsx — Aggregate production, regional comparison, campaign ROI. Admin only.
MDDashboard.tsx — Team performance, recruiting ramp, client gap pipeline, advanced strategy tracker.
ProfessionalDashboard.tsx — Plan vs actual with back-plan tracking, client gaps, industry benchmarks.
ClientDashboard.tsx — Holistic plan scorecard (9 domains), per-domain action steps, implementation timeline.

Register all pages in client/src/App.tsx routes.

## PRIORITY 4: Webhook Routers

Create and register in server/routers.ts:

server/routers/ghlWebhook.ts — POST /api/webhooks/ghl. Verify GHL_WEBHOOK_SECRET. Handle: ContactCreate, ContactUpdate, OpportunityStageUpdate. Public endpoint.
server/routers/dripifyWebhook.ts — POST /api/webhooks/dripify. Verify DRIPIFY_WEBHOOK_SECRET. Store in dripify_webhook_events, process into lead_pipeline.
server/routers/smsitWebhook.ts — POST /api/webhooks/smsit. Verify SMSIT_WEBHOOK_SECRET. CRITICAL: contact.opted_out → immediately unsubscribe (TCPA).

## PRIORITY 5: 34 Seed Scripts

Create in server/seeds/ (Node.js files, run with `node server/seeds/XX-name.ts`):

00-rateLimitProfiles.ts through 33-channelPilotDefaults.ts (see STEWARDLY_BUILD_SPEC.md for full list).
Key data requiring web search verification at build time:
- 03: IRS 2025/2026 tax brackets, deductions, limits
- 04: SSA bend points, COLA history, FRA by birth year
- 07: AM Best carrier ratings for 50 carriers
- 26: Term life benchmark quotes from 10 carriers
- 30: Arizona state parameters (verify 2.5% flat income tax, homestead, 529)

## PRIORITY 6: Remaining 41 Service Files

Create in server/services/ following existing patterns:

scraping/: tosChecker, rateSignalDetector, rateCalibrator, rateProber, integrationAnalyzer, extractionPlanner, extractionExecutor, rateRecommender, dataValueScorer (9 files)
enrichment/: clearbit, fullContact, aiEnrichment (3 files — all env-gated stubs)
import/: xlsxParser, jsonParser, xmlParser, vcfParser, pdfTableParser, docxTableParser, archiveExtractor, fileRouter (8 files)
planning/: calculatorImporter, coaDashboardImporter, actualsIngester, trendIngester, censusApiClient (5 files)
reporting/: performanceReport, campaignReport, recruitingReport, clientOutcomesReport, industryComparisonReport, pipelineHealthReport (6 files)
verification/: secIapd, cfpBoard, nasbaCpaverify, nmlsConsumerAccess, stateBar, niprPdb, attorneyRatings, businessBroker, providerHealthMonitor (9 files — 7 are ToS-gated stubs)
marketHistory/: marketHistory (1 file)

## PRIORITY 7: 28 Cron Jobs

Wire in server/services/scheduler.ts using runMonitoredCron() from monitoring/healthMonitor.ts:

EVERY 4H: provider-health-check, smsit-contact-sync
DAILY: refresh-sofr-rates (6am), daily-market-close (7pm), daily-crm-sync (2am), data-freshness-check, pii-retention-sweep (3am), import-stale-cleanup (3am)
WEEKLY: reverify-credentials (Sun 2am), coi-alerts (Mon 8am), rescore-leads (Sun 4am), weekly-scrape-batch, score-data-value, rate-optimization, weekly-performance-report (Mon 6am)
MONTHLY: cfp-refresh, regulatory-scan, bulk-refresh, retrain-propensity, carrier-ratings, product-rates, monthly-report-snapshot
QUARTERLY: bias-audit, iul-crediting-update, quarterly-planning-review
ANNUAL: parameter-check (weekly Oct-Dec), ssa-cola (Oct), medicare-premium (Nov)

## FINAL: Tests + Compile

Add tests for each new file. Target: 100+ new tests.
pnpm run check — 0 errors
pnpm test — 0 regressions vs 2,231 baseline
git add -A && git commit -m "feat: complete remaining build-out items"
git push origin HEAD:main
```

---

## Section 2: User Pickup Guide

### What Manus Can Complete Automatically
- UI components (Priority 2) — React components from specs
- UI pages (Priority 3) — page scaffolding with tRPC hooks
- Webhook routers (Priority 4) — mechanical tRPC wiring
- Service file stubs (Priority 6) — especially the ToS-gated verification stubs and env-gated enrichment stubs
- Import parsers (Priority 6, import/) — xlsxParser needs SheetJS, others are straightforward
- Reporting service stubs (Priority 6, reporting/) — follow reportGenerator.ts pattern
- Cron job wiring (Priority 7) — mechanical setInterval + runMonitoredCron calls

### What Requires Human Action

#### 1. Environment Variables (before anything works end-to-end)
```bash
# Required — generate these now:
INTEGRATION_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Required for CRM:
GHL_LOCATION_ID=       # From GoHighLevel settings
GHL_API_TOKEN=         # From GoHighLevel API
GHL_PIPELINE_ID=       # From GoHighLevel pipeline setup
# + 9 GHL_STAGE_* variables (one per pipeline stage)
# + 6 GHL_CF_* variables (custom field IDs)

# Required for demographics:
CENSUS_API_KEY=        # Free: api.census.gov/data/key_signup.html
FRED_API_KEY=          # Free: fred.stlouisfed.org/docs/api/api_key.html

# Optional — activate by adding key:
TAVILY_API_KEY=        # Web search ($0.008/search, 1K free/month)
BRAVE_SEARCH_API_KEY=  # Fallback search (2K free/month)
PDL_API_KEY=           # People Data Labs enrichment
CLEARBIT_API_KEY=      # Clearbit enrichment
APOLLO_API_KEY=        # Apollo enrichment
SMSIT_API_KEY=         # SMS-iT integration
SENTRY_DSN=            # Error tracking
OTEL_EXPORTER_OTLP_ENDPOINT= # OpenTelemetry
```

#### 2. Database Deployment
```bash
# Deploy the 131 missing tables (migration is ready):
pnpm run db:deploy-missing
# Requires TiDB Cloud IP whitelist access
```

#### 3. Seed Data Verification
Seeds 03, 04, 06, 07, 08, 26, 30 contain financial data that MUST be web-search verified:
- **Tax brackets**: IRS publishes annually in October/November. Verify 2025/2026 values.
- **SSA parameters**: Check ssa.gov for current COLA, bend points, FRA.
- **Carrier ratings**: Check ambest.com for current ratings of the 50 carriers.
- **AZ state parameters**: Verify flat tax rate, homestead exemption, 529 details.
- **Term quotes**: Get current benchmark quotes from 10 carriers.

#### 4. GoHighLevel Pipeline Setup
1. Create pipeline in GHL with 9 stages: New → Enriched → Scored → Qualified → Contacted → Meeting → Proposal → Converted → Disqualified
2. Create 6 custom fields: Propensity Score, Primary Interest, Estimated Income, Protection Score, Lead Source, Stewardly ID
3. Copy all IDs into env vars

#### 5. Compliance Review (before go-live)
- [ ] FINRA 2210 review: all AI-generated content has required disclaimers
- [ ] CAN-SPAM: unsubscribe works, consent checkbox unchecked by default, physical address in footer
- [ ] TCPA: no auto-text without express written consent, opt-out immediately processed
- [ ] CCPA: PII deletion requests processed within 45 days
- [ ] Reg BI: suitability disclosures on all recommendations
- [ ] Fair lending: propensity bias audit passes quarterly (disparity ratio ≤ 1.25)

#### 6. Post-Launch Monitoring
- [ ] Check propensity control group monthly (is model outperforming random?)
- [ ] Run bias audit quarterly
- [ ] Verify SOFR rates updating daily (FRED API)
- [ ] Monitor system_health_events for cron failures
- [ ] Review communication_archive retention (3yr FINRA 17a-4)

---

## Section 3: Completion Checklist

| Priority | Item | Count | Status |
|----------|------|-------|--------|
| 1 | Web search tool | 1 file | DONE |
| 2 | UI components | 13 files | NOT STARTED |
| 3 | UI pages | 14 files | NOT STARTED |
| 4 | Webhook routers | 3 files | NOT STARTED |
| 5 | Seed scripts | 34 files | NOT STARTED |
| 6 | Service files | 41 files | NOT STARTED |
| 7 | Cron jobs | 28 jobs | NOT STARTED |
| — | Env vars | 20+ vars | HUMAN REQUIRED |
| — | DB deployment | 131 tables | HUMAN REQUIRED |
| — | Seed verification | 7 seeds | HUMAN REQUIRED |
| — | GHL setup | Pipeline + fields | HUMAN REQUIRED |
| — | Compliance review | 6 checks | HUMAN REQUIRED |
