# Stewardly Phase 6 — Data Integrations / Pipelines / Ingestion / Modeling

> **Target repo:** `mwpenn94/stewardly-ai`
> **Phase:** 6 of 8
> **Scope:** P0 financial data integrations (Plaid, FRED, EDGAR, GLEIF+OpenFIGI, NAIC+FFIEC), consumer PFM app integrations (Empower, EveryDollar), unified ingestion pipeline, agent-driven scraping, cross-platform data flow
> **Prior phases:** All 1-5 complete. Read prior `PHASE_*_EXIT.md` files.
> **Reference docs:** `FINANCIAL_DATA_TOOLS_TIERED.md`

---

## CORE RULES

1-8 same as prior phases. **Anti-regression:** Phases 1-5 must not regress. **Commits:** `pass-[N] · phase-6 · [description]`

**Termination:** (1) User stop. (2) Platform limit → `HANDOFF.md`. (3) Merge-gate → `BLOCKED_ON.md`. (4) 1-hour active stall → `STALLED.md`.

---

## WHAT PHASE 6 BUILDS

Phase 6 connects live external data to the surfaces built in Phases 2-5. The goal: wealth engine calculations use real data, command center contacts have real financial profiles, AI recommendations are informed by current market conditions.

---

## P0 INTEGRATIONS (all must-have)

| Integration | Source | Cost | What it feeds |
|---|---|---|---|
| **Plaid** | Banking aggregation (accounts, balances, transactions) | Paid (the only paid P0) | Wealth engine (balance sheet, cash flow), Command center (client profile enrichment) |
| **edgartools / SEC EDGAR** | Company filings, fund holdings, insider transactions | 🟢 Free | Wealth engine (stock-based comp, concentration analysis), References |
| **FRED** | Federal Reserve economic data (rates, inflation, unemployment, GDP) | 🟢 Free | Wealth engine defaults (risk-free rate, inflation assumptions), AI context |
| **GLEIF + OpenFIGI** | Legal entity identification, financial instrument identification | 🟢 Free | Wealth engine (entity resolution), Command center (company identification) |
| **NAIC + FFIEC** | Insurance company data, bank/credit union data | 🟢 Free | Wealth engine (carrier comparison, bank stability), References |

**If Plaid credentials unavailable:** implement the pipeline architecture with CSV/manual import fallback. The architecture must be correct (normalized schema, ingestion pipeline, cross-surface distribution) even without the live connector. Plaid plugs in later without architectural change.

---

## CONSUMER PFM INTEGRATION (differentiator)

Empower + EveryDollar + Mint-export covers 60-70% of consumer PFM market at $0 cost. The goal: a client who already uses one of these apps can connect to their advisor's Stewardly instance, giving the advisor visibility into client financials.

| PFM App | Integration path | Notes |
|---|---|---|
| **Empower** | No public API — agent browser-operator (Phase 4) or Plaid aggregation | Free, Yodlee-backed |
| **EveryDollar** | Manual export CSV import or Premium's Plaid connection | Free tier = manual; Premium = Plaid |
| **Monarch Money** | REST API | Paid app but API available |
| **YNAB** | REST API | Established API |
| **Tiller** | Google Sheets sync → Stewardly Sheets sync (Phase 5) | Sheets-native |

**At minimum ONE PFM integration path must be functional** — even CSV import counts. The pipeline architecture must normalize PFM data into the same schema as Plaid data.

---

## UNIFIED INGESTION PIPELINE

A single pipeline that normalizes data from multiple sources into a common schema:

**Sources:** API responses, agent-driven browser scraping, CSV uploads, PFM app data, Google Sheets sync

**Common schema feeds:** wealth engine (portfolio holdings, income, expenses, assets, liabilities), command center (contact demographics, lifecycle stage, engagement history), AI (context for reasoning), learning (personalized recommendations based on client book composition)

**Requirements:**
- Idempotent processing (re-importing the same data doesn't create duplicates)
- Source provenance tracking (every data point knows where it came from and when)
- Stale-data detection (flag data older than configured threshold)
- Error handling with Phase 1 failover patterns (degraded mode shows cached data)
- Cost-tier compliance: Tier 0/1 defaults from 🟢 FREE sources only

---

## AGENT-DRIVEN SCRAPING

Phase 4's autonomous agent (Mode 3) can operate a browser. Phase 6 leverages this for data sources without clean APIs:

- Build agent task templates for data retrieval workflows
- Agent navigates to source, reads page, extracts structured data, normalizes into pipeline schema
- Agent adapts to page layout changes (visual reading, not brittle CSS selectors)
- At minimum one P0 integration demonstrated via agent-driven retrieval (e.g., FRED time series)

---

## CROSS-PLATFORM DATA FLOW

Ingested data must flow correctly across ALL surfaces:
- Client's Plaid-sourced holdings → appears in Retirement surface, Tax surface, Estate surface, AND command center contact profile simultaneously
- FRED rates → update wealth engine default assumptions across all calculators
- EDGAR filings → feed stock-based comp analysis AND due diligence references
- PFM data → enriches client profile in both wealth engine and command center

---

## EXIT CRITERIA

- [ ] All must-have criteria ≥8 × 3 consecutive passes
- [ ] P0 integrations functional (or architecturally ready with fallback for Plaid)
- [ ] ≥1 consumer PFM integration path demonstrated (API, agent scraping, or CSV import)
- [ ] Zero stale-data incidents on connected sources
- [ ] Unified pipeline normalizes from ≥3 source types into common schema
- [ ] Agent-driven ingestion demonstrated for ≥1 data source
- [ ] Cross-platform data flow verified (same data appears correctly in wealth engine + command center + AI context)
- [ ] Cost-tier compliance (Tier 0/1 from free sources)
- [ ] Phases 1-5 have not regressed

**Emit `PHASE_6_EXIT.md`.**

---

Begin. Read `FINANCIAL_DATA_TOOLS_TIERED.md`. Read prior exit files. Inventory current integrations. Score. Build. Ship. Continue.
