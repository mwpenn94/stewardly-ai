# WealthBridge AI — Platform Manifest (v124)

## Overview

WealthBridge AI is a comprehensive digital financial twin platform designed for financial advisors, wealth managers, and their clients. The platform integrates AI-powered planning, real-time data pipelines, compliance automation, and practice management into a unified surface.

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19, Tailwind 4, shadcn/ui | Responsive SPA with progressive disclosure |
| Backend | Express 4, tRPC 11, Drizzle ORM | Type-safe API with real-time streaming |
| Database | TiDB (MySQL-compatible) | 383 tables, WORM audit trail |
| AI | LLM integration with tool calling | 7 calculator tools, multi-model consensus |
| Data | FRED, SEC EDGAR, BLS, Census, Plaid, SnapTrade | 6 live data pipelines |
| Payments | Stripe | Checkout sessions, webhooks, subscriptions |
| Voice | Deepgram STT, Edge TTS | Real-time transcription and synthesis |
| Video | Daily.co | Conferencing with live transcription |

## Capability Domains

### A. Calculator Domain (13 panels)
- Client Profile and Risk Assessment
- Cash Flow Analysis (income, expenses, savings rate, emergency fund)
- Protection Analysis (life, disability, LTC, umbrella)
- Growth Projections (investment, stock comp, Monte Carlo)
- Retirement Planning (Social Security, replacement rate, gap analysis)
- Tax Planning (federal/state brackets, Roth conversion, charitable)
- Estate Planning (taxable estate, exemption, gifting, trusts)
- Education Funding (529, cost inflation, gap analysis)
- Premium Financing (ILIT, arbitrage, breakeven)
- Executive Compensation (NQDC, 280G, RSU diversification)
- Charitable Planning (DAF, CRT, CLT, QCD, private foundation)
- Business Exit Planning (valuation, exit strategy, tax impact)
- Business Entity Comparison (Sole Prop, LLC, S-Corp, C-Corp)

### B. Practice Management (12 panels)
- GDC Brackets and Production Planning
- Sales Funnel and Pipeline
- AUM Pipeline and Override
- Firm Comparison
- Income Streams (GDC, overrides, bonuses, channel diversification)
- Team Roll-up and Sub-Account Management
- Seasonality and Production Planning
- Product Mix Optimization
- Recruiting and Onboarding
- Client Acquisition Cost (CAC) and Lifetime Value (LTV)
- Revenue, COGS, Margin Analysis
- Extended Network ROI

### C. Advisory and Advanced (12 panels)
- Planning Hierarchy (multi-level tree with roll-up)
- Advanced Workflows (multi-step planning sequences)
- Strategy Archetypes (AI-powered strategy matching)
- Unified Client Plan (15 client + 12 advanced domains)
- Cascade Alerts (cross-panel misalignment detection)
- Client-Facing Summary Generator
- Bulk Engagement Letter Management
- Annual Review Generator
- Personal Financial Review (PFR)
- Cost-Benefit Analysis with Horizon Projections
- Cost Transparency (5-layer fee breakdown)
- Strategy Comparison with Saved Scenarios

### D. Data Pipelines (6 sources)
- FRED Economic Data (18 series)
- SEC EDGAR (filings, tickers, feed parsing)
- BLS Employment Data
- Census Bureau Demographics
- Plaid Account Aggregation
- SnapTrade Portfolio Sync

### E. Platform Services
- Unified AI Surface (Chat, Dev, Auto modes with LLM streaming)
- Calculator Chat Tools (7 tools wired into AI chat)
- Cascade Planning Engine (forward/backward cascade, health scoring)
- Cost Transparency Engine (5-layer fee analysis)
- Competitive Parity Mapping (8-domain gap analysis)
- Compliance Copilot (audit trail, privacy log, severity tracking)
- Tax Projector (federal + state, RMD, IRMAA)
- Voice (TTS + STT with hands-free mode)
- Video Conferencing (Daily.co with transcription)
- Sharing UI Kit (ShareButton, RecipientPicker, PermissionSelector)
- Progressive Disclosure (4-level: Essential/Standard/Professional/Expert)
- Stripe Payments (checkout, webhooks, subscriptions)
- Command Center (7-tab hub: Overview, CRM, Campaigns, ATS, LinkedIn, Segments, Assets)
- Notification System (in-app, owner alerts)
- Onboarding Checklist and Changelog

## Key Routes

| Route | Component | Access | Description |
|-------|-----------|--------|-------------|
| `/chat` | Chat | All users | AI conversation with tool calling |
| `/wealth-engine` | WealthEngine | All users | 56-panel unified planning surface |
| `/calculators` | Calculators | All users | Standalone calculator interface |
| `/agent` | AgentPage | All users | Calculator tool discovery and quick prompts |
| `/products` | Products | All users | Product marketplace with suitability |
| `/comparables` | Comparables | All users | Competitive gap analysis + parity dashboard |
| `/lead-pipeline` | LeadPipeline | Advisors | AI-powered lead management |
| `/command-center` | CommandCenter | Advisors | Multi-platform CRM hub |
| `/compliance-audit` | ComplianceAudit | Advisors | FINRA/SEC compliance review |
| `/data-intelligence` | DataIntelligence | All users | Macro economic dashboard |
| `/manus-next` | ManusNextDashboard | Admin | Capability validation surface |
| `/operations` | OperationsHub | Admin | System operations and monitoring |
| `/settings` | Settings | All users | Profile, AI tuning, appearance |

## Build Metrics (v124)

| Metric | Value |
|--------|-------|
| Total LOC | 435,000+ |
| Page Components | 155 |
| UI Components | 235 |
| Server Services | 380 |
| Server Routers | 105 |
| Database Tables | 383 |
| Tests Passing | 9,883 |
| Build Time | 47s |

## Documentation

- `PLATFORM_GUIDE.md` — User-facing platform guide
- `SETUP_GUIDE.md` — Installation and configuration
- `INTEGRATION-SETUP-GUIDE.md` — Third-party integration setup
- `CONVERGENCE_REPORT.md` — Recursive optimization convergence report
- `PARITY_BACKLOG.md` — Competitive parity gap backlog
- `CFP-ADVISOR-ASSESSMENT.md` — CFP advisor assessment framework
- `STEWARDLY_COMPREHENSIVE_GUIDE.md` — Comprehensive platform guide
