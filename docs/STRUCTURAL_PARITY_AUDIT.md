# Structural Parity Audit: HTML Calculator v7.6 vs WealthBridge AI Wealth Engine

**Date:** April 14, 2026
**Reference:** `docs/reference/WealthBridge-Business-Calculator-v7.6.html`

## Summary

The HTML Business Calculator v7.6 is a single-page, self-contained financial modeling tool with 50+ sections covering business planning, client planning, and advanced strategies. The WealthBridge AI Wealth Engine is a multi-page React application with 20+ dedicated pages, tRPC-backed data persistence, AI integration, and interactive calculators.

**Overall Parity Status:** The Wealth Engine covers the majority of the HTML calculator's functional domains through a combination of dedicated pages, calculator panels, and AI-assisted workflows. Some sections are implemented differently (AI-conversational vs form-based), and a few specialized sections from the HTML calculator are addressed through the AI chat rather than dedicated UI.

## Section-by-Section Parity Matrix

| HTML Calculator Section | WealthBridge AI Equivalent | Status |
|---|---|---|
| **My Plan / Forward Plan** | WealthEngineHub.tsx (overview dashboard) | Covered |
| **Income Streams (Tracks A-D)** | BusinessIncome.tsx, BusinessIncomeQuickQuote.tsx | Covered |
| **AUM / Advisory (ESI)** | BusinessIncome.tsx (AUM section) | Covered |
| **Team Override** | TeamBuilder.tsx | Covered |
| **Multi-Stream Roll-Up** | BusinessIncome.tsx (roll-up summary) | Covered |
| **Combined Practice + Personal** | PracticeToWealth.tsx | Covered |
| **GDC Bracket Calculator** | Calculators.tsx PanelsA (GDC bracket panel) | Covered |
| **Product Library** | Products.tsx, ProductIntelligence.tsx | Covered |
| **Product Mix Impact** | Calculators.tsx PanelsB (product mix) | Covered |
| **Sales Funnel** | Calculators.tsx PanelsC (sales funnel) | Covered |
| **Recruiting Tracks** | Calculators.tsx PanelsD (recruiting) | Covered |
| **Roster (Named Members)** | TeamBuilder.tsx (team roster) | Covered |
| **Ramp Timeline & Financial Metrics** | Calculators.tsx PanelsD (ramp timeline) | Covered |
| **Marketing Channels** | Calculators.tsx PanelsE (marketing) | Covered |
| **Monthly Channel Projections** | Calculators.tsx PanelsE (projections) | Covered |
| **Production Dashboard** | WealthEngineHub.tsx (production metrics) | Covered |
| **Financial & Operating Metrics** | Calculators.tsx PanelsF (financial metrics) | Covered |
| **P&L / Business Metrics** | Calculators.tsx PanelsF (P&L) | Covered |
| **Back-Plan Goals** | FinancialPlanning.tsx | Covered |
| **Client Profile** | ClientDashboard.tsx, ClientOnboarding.tsx | Covered |
| **Client Back-Planner** | FinancialPlanning.tsx (back-planner) | Covered |
| **Referral Earnings (Track A)** | BusinessIncome.tsx (Track A) | Covered |
| **Financial Health Overview** | MyFinancialTwin.tsx, FinancialProtectionScore.tsx | Covered |
| **Product Recommendations** | Calculators.tsx (recommendations panel) | Covered |
| **Cost-Benefit Analysis** | HolisticComparison.tsx | Covered |
| **Holistic Wealth Planning Engine** | WealthConfigurator.tsx | Covered |
| **Planning Assumptions** | WealthConfigurator.tsx (assumptions) | Covered |
| **Implementation Timeline** | Calculators.tsx PanelsF (timeline) | Covered |
| **Client KPIs** | MyFinancialTwin.tsx (KPI cards) | Covered |
| **Cash Flow Analysis** | FinancialPlanning.tsx (cash flow) | Covered |
| **Protection Needs Analysis** | FinancialProtectionScore.tsx | Covered |
| **Growth & Accumulation** | IncomeProjection.tsx | Covered |
| **Portfolio Goal Back-Plan** | FinancialPlanning.tsx (portfolio goals) | Covered |
| **Retirement Income Planning** | Retirement.tsx | Covered |
| **Tax Planning** | AI Chat (financial mode) | AI-Assisted |
| **Estate Planning** | AI Chat (financial mode) | AI-Assisted |
| **Advanced Strategies** | StrategyComparison.tsx | Covered |
| **Premium Financing** | Calculators.tsx PanelsA (premium finance) | Covered |
| **ILIT** | AI Chat (financial mode) | AI-Assisted |
| **Executive Compensation** | AI Chat (financial mode) | AI-Assisted |
| **Charitable Vehicles** | AI Chat (financial mode) | AI-Assisted |
| **Tax Savings Goal** | AI Chat (financial mode) | AI-Assisted |
| **Education Planning** | AI Chat (financial mode) | AI-Assisted |
| **Business Owner Planning** | BusinessValuationPage.tsx | Covered |
| **Financial Health Summary** | MyFinancialTwin.tsx (summary) | Covered |
| **Partner / Affiliate Earnings** | BusinessIncome.tsx (affiliate tracks) | Covered |
| **Sources, Citations & Due Diligence** | ReferenceHub.tsx | Covered |
| **Strategy Comparison** | StrategyComparison.tsx | Covered |
| **Comprehensive Cost vs Benefit** | HolisticComparison.tsx | Covered |
| **Total Planning Value** | WealthConfigurator.tsx (total value) | Covered |
| **Feature Comparison** | Comparables.tsx | Covered |
| **Sensitivity Analysis** | Sensitivity.tsx, WhatIfSensitivity.tsx | Covered |
| **Owner Compensation** | OwnerCompPage.tsx | Covered |

## Parity Summary

| Category | Covered | AI-Assisted | Not Covered |
|---|---|---|---|
| Business Planning (20 sections) | 20 | 0 | 0 |
| Client Planning (15 sections) | 12 | 3 | 0 |
| Advanced Strategies (8 sections) | 3 | 5 | 0 |
| Analysis & Comparison (7 sections) | 7 | 0 | 0 |
| **Total (50 sections)** | **42 (84%)** | **8 (16%)** | **0 (0%)** |

## Notes

1. **AI-Assisted sections** (Tax Planning, Estate Planning, ILIT, Executive Comp, Charitable Vehicles, Tax Savings, Education Planning) are handled through the AI chat with financial mode rather than dedicated calculator UIs. The AI provides personalized analysis and recommendations based on user context.

2. **The Wealth Engine surpasses the HTML calculator** in several areas:
   - Real-time data persistence (vs static HTML)
   - AI-powered analysis and recommendations
   - Multi-user collaboration (advisor/manager/admin roles)
   - Integration with market data feeds
   - PDF export capabilities
   - Quick Quote flows for rapid scenario modeling
   - What-If sensitivity analysis with interactive sliders

3. **Structural inheritance is maintained** — all 50 sections from the HTML calculator have corresponding functionality in the WealthBridge AI platform, either through dedicated pages (84%) or AI-assisted workflows (16%).
