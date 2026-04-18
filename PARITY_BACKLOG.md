# WealthBridge AI — Parity Backlog (v124)

## Purpose

This document tracks competitive parity gaps identified through the 8-domain capability mapping against industry competitors (eMoney, MoneyGuidePro, RightCapital, Orion Planning, Holistiplan, and others). Each item represents a capability where WealthBridge either trails the industry leader or has room for differentiation.

## Status Legend

| Status | Meaning |
|--------|---------|
| Live | Fully implemented and accessible to users |
| Beta | Implemented but under validation |
| Planned | Designed but not yet implemented |
| Not Started | Identified gap, no implementation begun |

## Domain Summary

| Domain | Total | Live | Beta | Planned | Coverage |
|--------|-------|------|------|---------|----------|
| Planning | 10 | 10 | 0 | 0 | 100% |
| Protection | 3 | 3 | 0 | 0 | 100% |
| Growth | 3 | 3 | 0 | 0 | 100% |
| Practice Management | 4 | 4 | 0 | 0 | 100% |
| Compliance | 3 | 3 | 0 | 0 | 100% |
| Data | 2 | 2 | 0 | 0 | 100% |
| AI | 3 | 3 | 0 | 0 | 100% |
| Client Experience | 2 | 2 | 0 | 0 | 100% |
| Integration | 2 | 2 | 0 | 0 | 100% |
| Reporting | 2 | 2 | 0 | 0 | 100% |

## Remaining Gaps and Enhancement Opportunities

The following items represent areas where competitors offer deeper functionality or where WealthBridge can further differentiate. These are prioritized by impact on advisor workflow and client outcomes.

### High Priority

| ID | Domain | Capability | Gap Description | Competitor Reference | Target |
|----|--------|-----------|-----------------|---------------------|--------|
| GAP-001 | Planning | Social Security Optimization | eMoney offers detailed claiming strategy comparison with spousal/survivor benefits | eMoney Advisor | Enhance retire panel with multi-scenario SS claiming |
| GAP-002 | Growth | Tax-Loss Harvesting Automation | Orion and Betterment offer automated TLH with wash-sale tracking | Orion, Betterment | Add TLH opportunity scanner to growth panel |
| GAP-003 | Compliance | ADV Part 2B Generation | Holistiplan auto-generates ADV disclosures from plan data | Holistiplan | Integrate ADV generation into compliance copilot |

### Medium Priority

| ID | Domain | Capability | Gap Description | Competitor Reference | Target |
|----|--------|-----------|-----------------|---------------------|--------|
| GAP-004 | Data | Real-Time Market Data | Bloomberg/Refinitiv offer streaming quotes; current FRED data is delayed | Bloomberg Terminal | Evaluate real-time data feed integration |
| GAP-005 | Client Experience | Client Mobile App | RightCapital offers a dedicated client-facing mobile app | RightCapital | Progressive web app (PWA) for client access |
| GAP-006 | Integration | CRM Deep Integration | eMoney integrates deeply with Salesforce and Redtail | eMoney | Build Salesforce/Redtail webhook connectors |
| GAP-007 | Reporting | Custom Report Builder | MoneyGuidePro offers drag-and-drop report customization | MoneyGuidePro | Add report template editor to annual review |

### Low Priority (Differentiation Opportunities)

| ID | Domain | Capability | Gap Description | Competitor Reference | Target |
|----|--------|-----------|-----------------|---------------------|--------|
| GAP-008 | AI | Multi-Language Support | No competitor offers full multi-language financial planning | None | Add i18n framework for Spanish, Mandarin, Portuguese |
| GAP-009 | Practice Management | Succession Planning | Limited competitor coverage of practice succession modeling | None | Add succession planning panel to practice management |
| GAP-010 | Planning | Behavioral Finance Integration | Riskalyze offers behavioral risk scoring | Riskalyze | Integrate behavioral finance insights into profile panel |

## WealthBridge Differentiators (No Competitor Parity)

These capabilities are unique to WealthBridge and represent competitive advantages that no current competitor matches.

| Capability | Description | Why It Matters |
|-----------|-------------|----------------|
| Cascade Planning Engine | Forward/backward data propagation across all 56 panels | Changes in one domain automatically update all dependent domains |
| Planning Hierarchy | Multi-level tree with automated roll-up and ancestor traversal | No competitor offers hierarchical planning with cascade propagation |
| Calculator Chat Tools | 7 financial calculators wired directly into AI chat | Advisors can run projections conversationally without switching tools |
| Cost Transparency Engine | 5-layer fee analysis with industry benchmarks | Transparent fee comparison across 8 advisory models |
| Competitive Parity Mapping | Self-aware capability gap analysis | Platform continuously tracks its own competitive position |
| Multi-Model Consensus | AI responses validated across multiple LLM models | Higher confidence in AI-generated financial advice |
| Practice-to-Client Income Roll-up | Bidirectional planning with 15 client + 12 advanced domains | Unified view from practice revenue down to individual client plans |

## Extraction Roadmap (Manus-Next)

The monolith-to-monorepo extraction is tracked separately in the ManusNextDashboard. Current status: Phase 0 complete (documentation and planning), Phase 1 next (zero-dependency extraction of wealth-engine, practice-engine, and references packages).

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| v124 | 2026-04-18 | Initial parity backlog creation, 10 gaps identified, 7 differentiators documented |
