# Financial Data Tools — Tiered Cost Classification

> **Version:** 1.0 (v2.6.1 patch)
> **Authority:** Authoritative reference for cost-tier classification of every data source, tool, and integration that Stewardly defaults, references, or integrations may depend on.
> **Trust boundary:** Data only — agent cannot edit per directive floor. Amendments via `PROMPT_ISSUES.md`.

---

## Cost-Tier Legend

| Tier | Label | Definition |
|------|-------|------------|
| 🟢 | **FREE** | Zero-cost access with no usage limits that would affect production. Government data, open-source tools, or permanently free APIs. |
| 🟡 | **FREEMIUM** | Free tier available but with usage caps, rate limits, or feature restrictions that may require paid upgrade at production scale. |
| 🔴 | **PAID** | No meaningful free tier. Requires paid subscription, licensing, or per-transaction fees for any production use. |

---

## Sourcing Policy

The sourcing policy governs which cost tier is acceptable at each complexity tier of the Stewardly platform.

| Complexity Tier | Acceptable Cost Tiers | Policy |
|----------------|----------------------|--------|
| **Tier 0 — Instant** | 🟢 only | A Tier 0 surface that breaks because a paid subscription lapsed is a design failure. |
| **Tier 1 — Quick-check** | 🟢 only | Same rationale as Tier 0. Core defaults must never depend on paid sources. |
| **Tier 2 — Current engine** | 🟢 preferred; 🟡 acceptable | Freemium sources acceptable when documented. Paid sources only with explicit justification. |
| **Tier 3 — Advanced cascades** | 🟢 / 🟡 / 🔴 | Any tier acceptable. Declare cost dependency at sourcing time. |
| **Tier 4 — AI + integrations** | 🟢 / 🟡 / 🔴 | Any tier acceptable. Full vendor-cost stack shown to user in settings. |

---

## Government / Regulatory Data Sources

These are the highest-authority, zero-cost sources. They should be preferred for all default values where applicable.

| Source | Category | Cost Tier | Auth Method | Rate Limits | Stewardly Usage |
|--------|----------|-----------|-------------|-------------|-----------------|
| **FRED** (Federal Reserve Economic Data) | Economic | 🟢 FREE | API key (free) | Unlimited | Interest rates, inflation, GDP, SOFR, Treasury yields. Foundational for Tier 0/1 Retirement, Tax, Estate surfaces. |
| **BLS** (Bureau of Labor Statistics) | Economic | 🟢 FREE | API key (free) | 500/day (v2) | CPI, unemployment, wages, occupation data. Foundational for income and cost-of-living defaults. |
| **BEA** (Bureau of Economic Analysis) | Economic | 🟢 FREE | API key (free) | Unlimited | Regional GDP, personal income, consumer spending. |
| **U.S. Census Bureau** | Demographics | 🟢 FREE | API key (free) | Unlimited | Income, population, education, housing by geography. |
| **SEC EDGAR** | Regulatory | 🟢 FREE | None (User-Agent header) | 10 req/sec | 10-K, 10-Q, 8-K, Form ADV filings. Foundational for compliance-aware flagging. |
| **FINRA BrokerCheck** | Regulatory | 🟢 FREE | None | Unlimited | Advisor/broker verification, disciplinary history. |
| **NAIC** (National Association of Insurance Commissioners) | Insurance/Regulatory | 🟢 FREE | None (public data) | N/A | Carrier financial data, consumer complaint ratios, model regulations. Foundational for Protection surfaces. |
| **FFIEC** (Federal Financial Institutions Examination Council) | Banking/Regulatory | 🟢 FREE | None (public data) | N/A | Bank financial data, CRA ratings, demographic data. Foundational for banking-side defaults. |
| **SSA** (Social Security Administration) | Government | 🟢 FREE | None (published tables) | N/A | Benefit calculations, life tables, AIME/PIA formulas. |
| **IRS** (Internal Revenue Service) | Government | 🟢 FREE | None (published tables) | N/A | Tax brackets, standard deductions, contribution limits. |
| **Treasury Direct** | Government | 🟢 FREE | None (published rates) | N/A | I-Bond rates, Treasury yields, Section 7520 rates. |
| **GLEIF** (Global Legal Entity Identifier Foundation) | Entity Resolution | 🟢 FREE | None | 60 req/min | LEI lookup, entity verification, ownership chains. Foundational for cross-client portfolio analytics. |
| **OpenFIGI** | Security Resolution | 🟢 FREE | API key (free) | 250 req/min | FIGI-to-ticker mapping, instrument identification. Foundational for cross-client portfolio analytics. |

---

## Open-Source Tools and Libraries

| Tool | Category | Cost Tier | License | Stewardly Usage |
|------|----------|-----------|---------|-----------------|
| **edgartools** | SEC Filings Parser | 🟢 FREE | MIT | Python library for parsing SEC EDGAR filings. P0 integration for compliance-aware flagging. |
| **FinanceToolkit** | Financial Analysis | 🟢 FREE | MIT | Open-source financial analysis: ratios, models, technical indicators. |
| **OpenBB Platform** | Market Data Abstraction | 🟢 FREE | AGPL-3.0 | Unified API for multiple market data sources. Replaces multiple paid APIs. |
| **yfinance** | Market Data | 🟢 FREE | Apache 2.0 | Yahoo Finance data wrapper. Useful for prototyping; not for production at scale. |
| **n8n** (self-hosted) | Workflow Automation | 🟢 FREE | Sustainable Use | Self-hosted workflow automation for custom integrations. |

---

## Freemium Data Providers

| Provider | Category | Cost Tier | Free Tier | Paid Tier | Stewardly Usage |
|----------|----------|-----------|-----------|-----------|-----------------|
| **Polygon.io** | Market Data | 🟡 FREEMIUM | 5 API calls/min, delayed data | $29-$199/mo for real-time | Real-time quotes, historical data. Use free tier for development. |
| **Financial Modeling Prep** (FMP) | Fundamentals | 🟡 FREEMIUM | 250 req/day | $14-$49/mo | Company financials, ratios, DCF. Use free tier for Tier 2 surfaces. |
| **Tiingo** | Market Data | 🟡 FREEMIUM | 1,000 req/hr, 500 symbols | $10-$30/mo | EOD prices, news, crypto. Good free tier for most use cases. |
| **Alpha Vantage** | Market Data | 🟡 FREEMIUM | 25 req/day | $49.99/mo | Stock prices, forex, crypto, technical indicators. |
| **People Data Labs** | Contact Enrichment | 🟡 FREEMIUM | 100 records/mo | Volume pricing | Income, employer, education, social profiles. Advisor-level distribution. |
| **SnapTrade** | Brokerage Linking | 🟡 FREEMIUM | 5 connections/key | Volume pricing | Brokerage account linking (Fidelity, Schwab, Alpaca, etc.). |
| **COMPULIFE** | Insurance Quoting | 🟡 FREEMIUM | 2-month trial | Volume pricing | Life insurance quoting engine with carrier comparison. |
| **Canopy Connect** | Insurance Aggregation | 🟡 FREEMIUM | Free sandbox | Per-connection | Insurance policy data aggregation and verification. |
| **Wealthbox** | Advisor CRM | 🟡 FREEMIUM | Free tier (limited) | $49+/mo | Advisor CRM. Freemium tier for prototyping. |
| **Redtail** | Advisor CRM | 🟡 FREEMIUM | Free trial | $99/mo | Advisor CRM. Free trial for prototyping. |

---

## Paid-Only Providers

| Provider | Category | Cost Tier | Pricing | Stewardly Usage | Free Alternative |
|----------|----------|-----------|---------|-----------------|------------------|
| **Plaid** | Banking Aggregation | 🔴 PAID | Per-connection pricing | Bank account linking, transaction data, investment holdings. No real free alternative for production banking aggregation. | None for production |
| **CANNEX** | Annuity Quotes | 🔴 PAID | Enterprise licensing | Annuity quote engine. Required for high-fidelity annuity flooring in Tier 3/4 retirement surfaces. | None |
| **Wink Intelligence** | Annuity Research | 🔴 PAID | Enterprise licensing | Annuity research and analytics. Pairs with CANNEX. | None |
| **Holistiplan** | Tax Return Parser | 🔴 PAID | Per-advisor pricing | Tax return parsing and analysis. High productivity gain. | Manual entry |
| **FP Alpha** | Cross-Document Analysis | 🔴 PAID | Per-advisor pricing | Cross-document financial analysis. | Manual analysis |
| **eMoney Advisor** | Financial Planning | 🔴 PAID | Enterprise licensing | Compliance-audited planning software. Integration target for existing books. | Stewardly native |
| **RightCapital** | Financial Planning | 🔴 PAID | Per-advisor pricing | Financial planning software. Integration target for existing books. | Stewardly native |
| **BridgeFT** | Investment Data | 🔴 PAID | Partnership required | Unified API for investment account data via Fidelity Integration Xchange. | SnapTrade (freemium) |
| **ATTOM Data** | Property Data | 🔴 PAID | PAYG or annual | Property valuations, ownership, tax assessments, sales history. | Zillow API (limited) |

---

## Enterprise-Only (Deferred)

| Provider | Category | Cost Tier | Stewardly Relevance |
|----------|----------|-----------|---------------------|
| Bloomberg Terminal / B-PIPE | Market Data | 🔴 PAID ($24K+/yr) | Only relevant if entering institutional buy-side market. |
| Refinitiv / LSEG | Market Data | 🔴 PAID | Same as Bloomberg. |
| FactSet | Market Data | 🔴 PAID | Same as Bloomberg. |
| CRSP / Compustat | Academic Data | 🔴 PAID | Only relevant for back-testing / research surfaces. |
| OptionMetrics | Options Data | 🔴 PAID | Only relevant for options research surfaces. |
| Addepar | Portfolio Management | 🔴 PAID | Only relevant for white-label institutional deployments. |
| Orion | Portfolio Management | 🔴 PAID | Same as Addepar. |
| Black Diamond | Portfolio Management | 🔴 PAID | Same as Addepar. |

---

## Integration Priority Matrix (Scope #7)

| Priority | Integration | Cost Tier | Rationale |
|----------|-------------|-----------|-----------|
| **P0** | Plaid | 🔴 PAID | No free alternative for banking aggregation. Foundational for Tier 4 cross-client analytics. |
| **P0** | SEC EDGAR via edgartools | 🟢 FREE | Zero-cost. Foundational for compliance-aware flagging. |
| **P0** | FRED | 🟢 FREE | Zero-cost. Foundational for Tier 0/1 surfaces across Retirement, Tax, Estate. |
| **P0** | GLEIF + OpenFIGI | 🟢 FREE | Zero-cost. Foundational for cross-client portfolio analytics and entity/instrument resolution. |
| **P0** | NAIC + FFIEC | 🟢 FREE | Zero-cost. Foundational for Protection surfaces and banking-side defaults. |
| **P1** | Empower Personal Dashboard | 🟢 FREE | Free PFM ingestion. Covers 40-50% of consumer PFM market. |
| **P1** | EveryDollar | 🟡 FREEMIUM | Free + Premium for Ramsey clients. High relevance to stewardship-aligned client base. |
| **P1** | OpenBB Platform | 🟢 FREE | Open-source unified market data abstraction. Replaces multiple paid APIs. |
| **P1** | GoHighLevel (GHL) | 🔴 PAID | Already in Stewardly stack. Deepen integration. |
| **P1** | Wealthbox / Redtail | 🟡 FREEMIUM | Advisor CRM. Freemium tier for prototyping; paid for production. |
| **P2** | CANNEX | 🔴 PAID | Required for high-fidelity annuity flooring. Build-vs-buy tradeoff. |
| **P2** | Wink Intelligence | 🔴 PAID | Annuity research. Pairs with CANNEX. |
| **P2** | Holistiplan | 🔴 PAID | Tax return parser. High productivity gain but build-vs-buy tradeoff. |
| **P2** | FP Alpha | 🔴 PAID | Cross-document analysis. Same tradeoff. |
| **P2** | eMoney / RightCapital | 🔴 PAID | Compliance-audited planning. Integration target for migrating existing books. |
| **P3** | Bloomberg / Refinitiv / FactSet | 🔴 PAID | Enterprise-only. Defer indefinitely unless entering institutional market. |
| **P3** | CRSP / Compustat / OptionMetrics | 🔴 PAID | Academic/institutional. Defer indefinitely unless adding research surfaces. |
| **P3** | Addepar / Orion / Black Diamond | 🔴 PAID | Enterprise PMS. Defer indefinitely unless white-label institutional deployments. |

---

## Ratcheting Metrics (v2.6.1)

| Metric | Description | Target |
|--------|-------------|--------|
| `defaults_cost_tier_compliance_rate` | % of defaults at Tier 0 + Tier 1 surfaces sourced from 🟢 FREE or with explicit user override | 100% |
| `references_cost_tier_tagged_rate` | % of references with `source_cost_tier` value committed | 100% |
| `tier_4_vendor_cost_transparency_rate` | % of Tier 4 surfaces showing full vendor-cost stack to user | 100% |
| `scope_7_p0_integrations_live` | Count of P0 integrations with capability live | 5 |

---

## Current P0 Integration Status

| Integration | Status | Provider Slug | Notes |
|-------------|--------|---------------|-------|
| Plaid | **Live** | `plaid` | Bank linking, transactions, holdings. Sandbox + production. |
| SEC EDGAR via edgartools | **Live** | `sec-edgar` | Filing monitoring. Zero-cost, no API key required. |
| FRED | **Live** | `fred` | 800,000+ economic time series. Free API key. |
| GLEIF + OpenFIGI | **Pending** | — | Entity/instrument resolution. Zero-cost. To be wired. |
| NAIC + FFIEC | **Partial** | — | Referenced in calculator defaults. Full API integration pending. |

---

## Aging Review Schedule

Every 50 convergence passes, re-evaluate:

1. Cost-tier classifications (free tools may have moved to freemium; freemium tools may have changed pricing; new tools may have emerged with better free tiers).
2. Scope #7 P0/P1/P2 prioritization based on actual demand signals from `PINNACLE_INFRA_GAPS.md`.
3. New government data sources or open-source tools that could replace paid dependencies.

---

*Last updated: April 14, 2026. Next aging review: Pass 50 of current convergence cycle.*
