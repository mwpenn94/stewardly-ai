# Source HTML v7 Analysis — Gaps to Fill

## Current App vs Source HTML Panel Comparison

### Panels Present in Both (Matched)
- My Plan, GDC Brackets, Products, Sales Funnel, Recruiting, Channels, Dashboard, P&L
- Client Profile, Cash Flow, Protection, Growth, Retirement, Tax, Estate, Education
- Cost-Benefit, Strategy Compare, Summary, Action Plan/Timeline, References

### Panels Missing from App (in source HTML but not in app)
- **Advanced** (Premium Finance, Split Dollar, Deferred Comp strategies)
- **Business Client** (business-specific planning: entity type, succession, key person)
- **Partner** (strategic partner income streams)

### Features Present in Source HTML but Incomplete in App

#### 1. Bracket Override Selector (My Plan panel)
- Source HTML has a dropdown to override the GDC bracket rate
- App has the state variable `ppBracketOverride` but NO UI control wired

#### 2. References Panel — MAJOR GAP
Source HTML has 14 reference categories with 50+ individual citations:
1. Funnel & Conversion Metrics — Step-by-Step Rate Benchmarks
2. Commission & GDC Structures
3. Marketing & Lead Generation
4. Client Financial Planning & Market Returns
5. Industry Trends (2024-2026)
6. Premium & Fee Benchmarks
7. WealthBridge Carrier Products
8. Recruiting, Retention & Talent
9. Client Planning — Cost vs. Benefit Due Diligence
10. Your Due Diligence Checklist
11. Regulatory & Compliance
12. Engine Methodology (How Our Engines Work)
13. Product-Level Source Citations
14. Industry Benchmarks for Comparison

Current app has only: Calculation Methods table + Due Diligence checklist + Disclaimer

#### 3. PRODUCT_REFERENCES (inline citations per product)
Source HTML has detailed per-product citations with source, URL, and benchmark data for:
term, iul, wl, di, ltc, fia, aum, 401k, roth, 529, estate, premfin, splitdollar, deferredcomp

#### 4. INDUSTRY_BENCHMARKS (comparison data)
Source HTML has benchmark data for:
- savingsRate, investorBehaviorGap, lifeInsuranceGap, retirementReadiness
- estatePlanningGap, advisorAlpha, avgAdvisoryFee, avgWealthGrowth

#### 5. METHODOLOGY_DISCLOSURE (engine explanations)
Source HTML has detailed methodology for: UWE, BIE, HE, MC, PF + disclaimer

#### 6. Recruiting Source Benchmarks
Source HTML has LIMRA 2022, AllCalls 2026, FirstPageSage 2026 data for recruiting costs

## Priority Order for Implementation
1. Wire bracket override selector UI (quick win)
2. Massively expand References panel with all 14 categories from source HTML
3. Add PRODUCT_REFERENCES, INDUSTRY_BENCHMARKS, METHODOLOGY_DISCLOSURE data
4. Add inline citation tooltips throughout calculator panels
5. Optimize defaults with industry data where gaps exist
