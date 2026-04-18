# Stewardly AI (WealthBridge) — Comprehensive CFP/Advisor Expert Assessment

**Assessment Date:** April 17, 2026
**Assessment Type:** Landscape + Depth + Adversarial (Recursive Optimization Framework)
**Scope:** Full platform audit from the perspective of a CFP, insurance advisor, investment advisor, and managing director — evaluating every client-facing workflow, practice management workflow, compliance surface, and planning hierarchy

---

## Signal Assessment

**Landscape:** PRESENT — The platform has not been systematically evaluated from a practicing advisor's perspective against real-world CFP, insurance, and investment advisory workflows. Gaps are visible in client planning hierarchy alignment.

**Depth:** PRESENT — Broad coverage exists across 161 page components and 365 database tables, but the client planning layer remains shallow compared to the practice management layer. The "Also My Client" roll-up mechanism exists but does not cascade planning intelligence bidirectionally.

**Adversarial:** PRESENT — The platform appears solid on the surface but contains hidden failure modes in the PFR (Personal Financial Review) workflow, suitability documentation chain, and the disconnect between calculator outputs and recommendation persistence.

**Future-State:** PARTIALLY PRESENT — The platform has emerging technologies (AI consensus, autonomous client analysis) but has not been stress-tested against the 2026 regulatory landscape (DOL Fiduciary Rule 2.0, NAIC model regulations, SEC Marketing Rule enforcement).

**Fundamental Redesign:** ABSENT — The core architecture is sound. The five-hub structure (Wealth Engine, People, Intelligence, Admin, Settings) with the unified calculator orchestrator is the correct foundation. What is needed is alignment and deepening, not rebuilding.

**Executing:** Landscape + Depth pass (combined, as both signal types are strongly present).

---

## 1. Platform Architecture Summary

### 1.1 Scale

| Metric | Count |
|---|---|
| TypeScript/TSX source files | 1,649 |
| Total lines of code | 422,125 |
| Database tables (Drizzle schema) | 365 |
| Page components | 161 |
| UI components (shadcn/ui + custom) | 228 |
| Server routers | 104 |
| Server services | 363 |
| Test files | 580 |
| Routes (App.tsx) | 62 |
| Lazy-loaded pages | 113 |
| Calculator panels | 49 |
| Quick quote types | 15 |
| Suitability dimensions | 12 |
| Learning disciplines | 8 |
| Subscription tiers | 3 (Starter $49/mo, Professional $149/mo, Enterprise $499/mo) |

### 1.2 Five-Hub Architecture

**Wealth Engine Hub** — The unified calculator orchestrator with 49 panels across 4 groups: Practice Management (19 panels), Client Planning (15 panels), Advanced Strategies (12 panels), and References & Due Diligence (3 panels). Also contains Quick Quotes (15 types), Strategy Comparison, Quick Bundle, Owner Comp Analysis, Business Valuation, and Comparables.

**People Hub** — Client/lead management with Relationships, Lead Pipeline, Client Onboarding, Annual Review, Organizations, Command Center, and Outreach Automation.

**Intelligence Hub** — Data intelligence with Financial Twin, Suitability Panel, Product Intelligence, Comparables, Market Data, Data Pipelines, Sovereign Study, and Fairness Audit.

**Admin Hub** — Practice operations with Manager Dashboard, Workflow Automation, Compliance Copilot, Compliance Audit, Marketing Assets, Campaign Manager, CRM Sync, BCP, and Reporting.

**Settings Hub** — Configuration with Profile, Integrations, Billing, Team, Notifications, Security, Data Export, and API Keys.

### 1.3 Integration Stack

| Integration | Purpose | Status |
|---|---|---|
| Plaid | Account aggregation, balance verification | Configured |
| SnapTrade | Brokerage account linking, portfolio data | Configured |
| Daily.co | Video conferencing for client meetings | Configured |
| Deepgram | Voice transcription for meeting notes | Configured |
| Stripe | Subscription billing, payment processing | Configured (sandbox) |
| FRED API | Federal Reserve economic data, interest rates | Configured |
| BLS API | Bureau of Labor Statistics data | Configured |
| BEA API | Bureau of Economic Analysis data | Configured |
| Census API | Demographic and economic census data | Configured |
| LinkedIn OAuth | Professional identity verification | Configured |
| Google OAuth | Authentication | Configured |
| Edge TTS | Text-to-speech for audio narration | Built-in |
| LLM (Forge) | AI chat, consensus engine, analysis | Built-in |
| E-Signature | Document signing workflows | Built-in |
| S3 Storage | File storage, report archival | Built-in |

---

## 2. CFP Workflow Assessment

A Certified Financial Planner follows a six-step process defined by the CFP Board. This section evaluates how each step is supported.

### 2.1 Step 1: Understanding the Client's Personal and Financial Circumstances

**Current State:** The `FinancialProfile` interface in `shared/financialProfile.ts` captures 30+ fields including age, income, net worth, savings, dependents, mortgage, debts, marginal rate, retirement age, estate goals, insurance coverage, business ownership, and filing status. The `ClientOnboarding` page provides a guided intake flow. The `MyFinancialTwin` page builds an AI-generated financial profile.

**Gap Analysis:**

| Area | Current | Needed for CFP Standard |
|---|---|---|
| Risk tolerance | Single `riskAssessment` quick quote | Validated psychometric questionnaire (e.g., FinaMetrica-style) with documented scoring methodology |
| Time horizon | Implicit via `retirementAge` | Explicit multi-goal time horizons (education in 5yr, retirement in 20yr, estate in 40yr) |
| Values/attitudes | Not captured | Qualitative discovery (legacy priorities, charitable intent, family dynamics) |
| Cash flow detail | `income` and `monthlySavings` only | Full income/expense breakdown with categories, irregular income, bonus structures |
| Existing documents | Not systematically collected | Will/trust inventory, insurance policy review, tax return analysis, beneficiary audit |
| Family dynamics | `dependents` count only | Family tree with ages, health status, special needs, blended family considerations |
| Employer benefits | Not captured | 401(k) match, ESOP, stock options, deferred comp, pension details |
| Health/longevity | Not captured | Health status, family longevity history, LTC probability assessment |

**Recommendation:** Extend `FinancialProfile` with a `discoveryLayer` that captures qualitative and quantitative data across all CFP-required domains. This becomes the foundation for the unified planning hierarchy.

### 2.2 Step 2: Identifying and Selecting Goals

**Current State:** The `clientPlanOutcomes` table tracks 13 plan areas (protection, retirement, estate, tax, education, debt, growth, business, cash_flow, premium_finance, ilit, exec_comp, charitable) with target metrics, target values, current values, and gap values. The `planAdherence` table tracks 6 categories (savings, spending, investment, debt, insurance, estate).

**Gap Analysis:**

| Area | Current | Needed |
|---|---|---|
| Goal prioritization | Flat list of 13 plan areas | Ranked priority matrix with interdependencies (e.g., "pay off debt before maximizing retirement") |
| Goal quantification | `targetValue` and `currentValue` | Time-bound milestones with probability of success (Monte Carlo integration) |
| Goal conflicts | Not detected | AI-powered conflict detection (e.g., "aggressive growth goal conflicts with conservative risk tolerance") |
| Life event triggers | Not modeled | Event-driven goal adjustments (marriage, divorce, inheritance, job change, disability) |
| Client agreement | Not formalized | Documented goal agreement with e-signature, forming the basis of the engagement letter |

**Recommendation:** Create a `GoalHierarchy` model that links goals to time horizons, assigns priorities, detects conflicts, and feeds into the Monte Carlo simulation already present in the calculator panels.

### 2.3 Step 3: Analyzing the Client's Current Course of Action

**Current State:** The calculator orchestrator provides 49 analysis panels. The `autonomousClientAnalysis` service runs a nightly 5-step AI process (Self-Discover, Self-Process, Self-Critique, Self-Connect, Self-Apply) with a $0.50/client cost guard. The `suitabilityEngine` evaluates 12 dimensions. The `recommendationsLog` table tracks recommendations with reasoning, confidence scores, suitability scores, and compliance notes.

**Gap Analysis:**

| Area | Current | Needed |
|---|---|---|
| Gap analysis integration | Calculator panels are independent | Unified gap analysis that aggregates all calculator outputs into a single "current vs. needed" view |
| Projection consistency | Each calculator uses its own assumptions | Shared assumption set (inflation rate, market return, tax rates) that propagates across all calculations |
| Sensitivity analysis | Monte Carlo panel exists | Sensitivity analysis that shows how each assumption change affects all goals simultaneously |
| Existing plan review | Not structured | Systematic review of existing insurance policies, investment allocations, estate documents against current goals |
| Behavioral analysis | Not present | Spending pattern analysis, savings behavior tracking, adherence history |

### 2.4 Step 4: Developing the Financial Planning Recommendation(s)

**Current State:** The `recommendationsLog` table captures recommendations with type (product, strategy, action, allocation, rebalance), reasoning, factors, confidence score, suitability score, risk level, disclaimers, and COI disclosure IDs. The AI consensus engine provides multi-model validation. The compliance copilot checks recommendations against regulatory requirements.

**Gap Analysis:**

| Area | Current | Needed |
|---|---|---|
| Recommendation reasoning chain | `reasoning` text field | Structured reasoning tree: premise → analysis → conclusion → alternatives considered → why this is best |
| Alternative presentation | Not structured | Side-by-side comparison of 2-3 alternatives per recommendation with pros/cons/costs |
| Implementation sequencing | `timeline` panel exists | Dependency-aware implementation sequence (e.g., "establish emergency fund before increasing retirement contributions") |
| Cost-benefit quantification | `costben` panel exists | Integrated cost-benefit for each recommendation showing NPV, IRR, and breakeven |
| Regulatory citations | `disclaimers` JSON field | Specific regulatory citations (IRC sections, FINRA rules, state insurance codes) |
| Rich references | Not present | Links to carrier illustrations, product fact sheets, academic research, regulatory guidance |

### 2.5 Step 5: Presenting the Financial Planning Recommendation(s)

**Current State:** PDF report generation via `pdfGenerator` service. Audio narration via Edge TTS. Shareable links. The `summary` calculator panel provides a consolidated view. The `AnnualReview` page provides a structured review format.

**Gap Analysis:**

| Area | Current | Needed |
|---|---|---|
| PFR document generation | Not a unified deliverable | Complete Personal Financial Review document that pulls from all calculator outputs, goal hierarchy, gap analysis, and recommendations into a single branded PDF |
| Client portal presentation | `Portal` page exists | Interactive client portal where clients can explore their plan, see projections, and track progress |
| Meeting preparation | Not structured | Pre-meeting brief that highlights changes since last review, action items due, and discussion topics |
| Presentation mode | Not present | Advisor-facing presentation mode that walks through the plan during a client meeting |

### 2.6 Step 6: Implementing the Financial Planning Recommendation(s)

**Current State:** Part G licensed operations (account opening, portfolio implementation, rebalancing, tax-loss harvesting, money movement). E-signature service. Workflow automation with templates. Insurance application tracking.

**Gap Analysis:**

| Area | Current | Needed |
|---|---|---|
| Implementation tracking | `implementationStatus` enum on `clientPlanOutcomes` | Granular implementation tracker per recommendation with sub-steps, responsible parties, and deadlines |
| Product fulfillment | Insurance applications exist | Unified fulfillment pipeline for all product types (insurance, investments, annuities, trusts) |
| Document management | S3 storage exists | Organized document vault per client with categories (applications, policies, statements, correspondence) |
| Third-party coordination | Not present | Referral tracking for CPA, attorney, P&C agent, mortgage broker with status updates |

### 2.7 Monitoring (Ongoing)

**Current State:** `planAdherence` table with adherence scoring and nudge tiers. Scheduled tasks for suitability decay, propagation delivery, and coaching generation. Autonomous client analysis runs nightly.

**Gap Analysis:**

| Area | Current | Needed |
|---|---|---|
| Review cadence management | `reviewDate` on `clientPlanOutcomes` | Automated review scheduling based on client tier (platinum=quarterly, gold=semi-annual, silver=annual) |
| Life event detection | Not present | AI-powered life event detection from communication archive, social signals, and account activity |
| Regulatory review triggers | Not present | Automatic review triggers for regulatory changes (tax law changes, insurance regulation updates) |
| Benchmark reporting | `benchmarkComparison` JSON on `planActualInsights` | Client-facing benchmark reports showing plan performance vs. goals and vs. peers |

---

## 3. Insurance Advisor Workflow Assessment

### 3.1 Needs Analysis

**Current State:** Protection score calculator, life insurance basics education module, IUL vs. traditional investments comparison, quick quotes for LTC, annuity, and protection score.

**Gap Analysis:**

| Workflow | Current | Needed |
|---|---|---|
| Human Life Value calculation | Implicit in protection score | Explicit HLV calculator with income replacement, debt payoff, education funding, and final expenses |
| Needs-based analysis | Single protection score | Multi-method analysis: HLV, income replacement, expense-based, capital retention |
| Policy review | Not structured | Systematic in-force policy review with replacement analysis (1035 exchange evaluation) |
| Underwriting pre-qualification | Not present | Health questionnaire that pre-screens for standard/preferred/substandard ratings |
| Carrier comparison | Comparables page exists | Real-time carrier comparison with illustration integration |

### 3.2 Product Suitability

**Current State:** 12-dimension suitability engine. Product intelligence page. Compliance copilot.

**Gap Analysis:**

| Area | Current | Needed |
|---|---|---|
| Product-specific suitability | Generic suitability dimensions | Product-type-specific suitability checklists (IUL suitability differs from term life suitability) |
| Replacement suitability | Not present | NAIC Model Regulation 613 replacement analysis with comparison of existing vs. proposed |
| Annuity suitability | Generic | NAIC Suitability in Annuity Transactions Model Regulation compliance (best interest standard) |
| Senior-specific | Not present | Senior-specific protections (cooling-off periods, suitability for age 65+) |

### 3.3 Application and Underwriting

**Current State:** Insurance application tracking exists. E-signature service available.

**Gap Analysis:**

| Area | Current | Needed |
|---|---|---|
| Application workflow | Basic tracking | Full application lifecycle: pre-qualification → application → underwriting → policy delivery → placement |
| Underwriting status | Not tracked | Real-time underwriting status with carrier integration (pending, approved, rated, declined, counter-offer) |
| Requirements tracking | Not present | Outstanding requirements tracker (medical exams, financial statements, APS requests) |
| Policy delivery | Not present | Policy delivery confirmation with client acknowledgment and 10-day free look tracking |

### 3.4 Premium Financing

**Current State:** Premium financing calculator panel, premium finance quick quote, premium finance rates page with SOFR-based calculations.

**Assessment:** This is one of the strongest areas of the platform. The premium financing workflow is well-developed with rate intelligence, SOFR integration, and strategy comparison capabilities. The `PremiumFinanceRates` page with carrier rate scraping is a genuine competitive advantage.

**Minor Gap:** Need to add collateral tracking (policy cash value vs. loan balance) and exit strategy modeling (when to unwind the financing arrangement).

---

## 4. Investment Advisor Workflow Assessment

### 4.1 Portfolio Management

**Current State:** Plaid and SnapTrade integrations for account aggregation. Portfolio tracking. Rebalancing (Part G licensed operation). Tax-loss harvesting.

**Gap Analysis:**

| Area | Current | Needed |
|---|---|---|
| IPS (Investment Policy Statement) | `governance` calculator panel exists | Full IPS generator that documents objectives, constraints, asset allocation, rebalancing rules, and benchmarks |
| Asset allocation modeling | Growth calculator panel | Mean-variance optimization, Black-Litterman, or risk-parity allocation modeling |
| Performance attribution | Not present | Returns attribution (asset allocation effect, security selection effect, interaction effect) |
| Fee analysis | Not present | Total cost analysis including advisory fees, fund expense ratios, transaction costs, and tax drag |
| ESG/values alignment | Not present | ESG screening and values-based investment filtering |

### 4.2 Fiduciary Documentation

**Current State:** Compliance copilot, compliance audit, recommendations log with reasoning.

**Gap Analysis:**

| Area | Current | Needed |
|---|---|---|
| Fiduciary file | Scattered across tables | Unified fiduciary file per client that aggregates all suitability assessments, recommendations, reasoning, and client acknowledgments |
| Best interest documentation | `reasoning` text field | Structured best interest documentation per Reg BI: basis for recommendation, cost disclosure, conflicts disclosure, care obligation |
| Form CRS delivery | Not tracked | Form CRS delivery tracking with client acknowledgment |
| ADV Part 2 delivery | Not tracked | ADV Part 2 delivery tracking with material change notifications |

---

## 5. Managing Director / Team Leader Workflow Assessment

### 5.1 Practice Management

**Current State:** 19 practice management calculator panels (My Plan, GDC Brackets, Products, Sales Funnel, Recruiting, Channels, Dashboard, P&L, AUM Override, AUM Pipeline, Affiliate Pipeline, Goal Tracker, Monthly Production, Production Optimization, Channel Diversification, Marketing ROI, Recruiting Funnel, Business P&L, GDC/Override Optimization). Business plans table with role segments, income targets, GDC targets, product mix, funnel targets, and channel budgets.

**Assessment:** This is the most mature area of the platform. The practice management calculator suite is comprehensive, with forward planning (targets), backward planning (back-plan mode), and actual tracking (production actuals). The `planActualInsights` table provides variance analysis with AI-generated recommendations.

### 5.2 Team Management

**Current State:** Manager Dashboard, Recruiting Funnel, Affiliate Pipeline, Organization management.

**Gap Analysis:**

| Area | Current | Needed |
|---|---|---|
| Advisor scorecards | `practiceMetrics` table exists | Individual advisor scorecards with KPIs, trends, and peer benchmarking |
| Coaching workflows | Coaching engine exists | Structured coaching workflows with observation → feedback → action plan → follow-up |
| Compliance oversight | Compliance audit exists | Supervisory review workflow with random sample selection, review documentation, and escalation |
| Succession planning | Not present | Practice valuation, transition planning, and successor identification |

---

## 6. Unified Hierarchical Planning Architecture — Design Specification

### 6.1 The Problem

The platform currently has two parallel but disconnected planning hierarchies:

**Practice Level (Strong):** Business Plans → Production Actuals → Plan/Actual Insights → Practice Metrics → Goal Tracker. This hierarchy supports forward planning (set targets), backward planning (back-plan from income goal), roll-up (team → region → platform), and roll-down (platform benchmarks → individual targets).

**Client Level (Weak):** Client Plan Outcomes → Plan Adherence → Recommendations Log. This hierarchy captures outcomes but lacks the same forward/backward/roll-up/roll-down intelligence. Client planning is a flat list of 13 plan areas without the hierarchical reasoning, rich references, and bidirectional data flow that practice management enjoys.

**The "Also My Client" Bridge:** The `calcClientPracticeOpportunity` function in `PracticeToWealth` creates a cross-cascade where client data rolls up into practice opportunity metrics. But this is one-directional — practice insights do not flow back down to inform client recommendations.

### 6.2 The Unified Architecture

The solution is a **single planning hierarchy** that operates identically at both the practice and client levels, with bidirectional data flow between them.

```
Platform Level (Benchmarks, Regulatory Updates, Market Data)
    ↕ roll-up / roll-down
Region/Firm Level (Aggregate Metrics, Compliance Standards)
    ↕ roll-up / roll-down
Team Level (Team Targets, Coaching Insights)
    ↕ roll-up / roll-down
Advisor/Practice Level (Business Plan, Production, Pipeline)
    ↕ roll-up / roll-down  ←── "Also My Client" bridge
Client Level (Financial Plan, Goals, Recommendations)
    ↕ roll-up / roll-down
Goal Level (Individual Goals with Time Horizons)
    ↕ roll-up / roll-down
Strategy Level (Specific Recommendations per Goal)
    ↕ roll-up / roll-down
Implementation Level (Actions, Products, Documents)
```

### 6.3 Planning Node Model

Every node in the hierarchy shares the same structure:

```typescript
interface PlanningNode {
  // Identity
  id: string;
  parentId: string | null;
  level: PlanningLevel; // 'platform' | 'region' | 'team' | 'advisor' | 'client' | 'goal' | 'strategy' | 'implementation'
  entityType: string;   // 'business_plan' | 'client_plan' | 'goal' | 'recommendation' | 'action'
  entityId: number;

  // Planning Direction
  forwardPlan: {
    target: number;
    targetDate: string;
    milestones: Milestone[];
    assumptions: Assumption[];
  };
  backwardPlan: {
    requiredInputs: number;
    requiredDate: string;
    reverseEngineeredSteps: Step[];
  };

  // Current State
  currentValue: number;
  gapValue: number;
  gapPercentage: number;
  trend: 'improving' | 'stable' | 'declining';
  probabilityOfSuccess: number; // Monte Carlo output

  // Reasoning & References
  reasoning: ReasoningChain;
  references: Reference[];
  alternatives: Alternative[];

  // Roll-up / Roll-down
  childNodes: PlanningNode[];
  aggregateFromChildren(): AggregateMetrics;
  propagateToChildren(directive: Directive): void;

  // Compliance & Audit
  suitabilityScore: number;
  complianceFlags: ComplianceFlag[];
  lastReviewDate: string;
  nextReviewDate: string;
}

interface ReasoningChain {
  premise: string;          // "Client is 55 with $2M net worth and no LTC coverage"
  analysis: string;         // "Based on actuarial data, 70% chance of needing LTC services"
  conclusion: string;       // "Recommend hybrid LTC policy with $500K benefit"
  alternativesConsidered: Alternative[];
  regulatoryBasis: string[];  // ["IRC §7702", "NAIC Model Reg 613"]
  dataSourcesCited: string[]; // ["FRED SOFR rate 4.2%", "SOA mortality table"]
  confidenceLevel: number;
}

interface Reference {
  type: 'regulatory' | 'academic' | 'carrier' | 'market_data' | 'case_law' | 'internal';
  title: string;
  citation: string;
  url?: string;
  relevance: string;
  dateAccessed: string;
}
```

### 6.4 Bidirectional Data Flow

**Roll-Up (Client → Practice):**
When a client's plan changes, the system automatically recalculates:
- Revenue impact on the advisor's business plan (new premiums, AUM changes, fee adjustments)
- Pipeline metrics (cases in progress, expected close dates, product mix)
- Compliance workload (reviews due, documentation requirements)
- Client segment scoring (value score, growth score, engagement score)

**Roll-Down (Practice → Client):**
When practice-level insights emerge, the system propagates:
- Product availability changes (new carrier partnerships, discontinued products)
- Rate changes (SOFR movements affecting premium financing, new carrier rates)
- Regulatory updates (tax law changes affecting estate plans, insurance regulation updates)
- Benchmark data (how this client's plan compares to similar profiles)
- Service model adjustments (tier-based review cadence, communication frequency)

### 6.5 PFR (Personal Financial Review) Integration

The PFR becomes the **client-level equivalent of the business plan** — a comprehensive document that:

1. **Aggregates** all calculator outputs into a unified view
2. **Applies** the reasoning chain to every recommendation
3. **Cites** rich references for every assertion
4. **Sequences** implementation steps with dependencies
5. **Projects** forward with Monte Carlo probability bands
6. **Back-plans** from goals to required actions today
7. **Compares** current state to benchmarks and alternatives
8. **Documents** suitability and compliance for every recommendation

The PFR generation pipeline:

```
Client Profile (FinancialProfile)
  + Goal Hierarchy (ranked, time-bound goals)
  + Calculator Outputs (all 15 client planning panels)
  + Suitability Assessment (12 dimensions)
  + Market Data (FRED rates, carrier rates, benchmarks)
  + Compliance Check (regulatory requirements)
  ↓
PFR Document Generator
  ↓
Sections:
  1. Executive Summary (AI-generated, advisor-reviewed)
  2. Client Profile & Discovery Summary
  3. Goal Hierarchy with Priorities
  4. Current State Analysis (gap analysis per goal)
  5. Recommendations (with reasoning chains & references)
  6. Alternative Strategies Considered
  7. Implementation Timeline (dependency-aware)
  8. Risk Analysis (Monte Carlo projections)
  9. Cost-Benefit Summary
  10. Compliance & Suitability Documentation
  11. Appendices (calculator outputs, illustrations, citations)
```

### 6.6 Database Schema Extensions

The following new tables support the unified hierarchy:

```sql
-- Core planning hierarchy node
CREATE TABLE planning_nodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  parent_id INT,
  level ENUM('platform','region','team','advisor','client','goal','strategy','implementation') NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id INT NOT NULL,
  owner_id INT NOT NULL,
  
  -- Forward planning
  forward_target DECIMAL(14,2),
  forward_target_date DATE,
  forward_milestones JSON,
  forward_assumptions JSON,
  
  -- Backward planning
  backward_required_input DECIMAL(14,2),
  backward_required_date DATE,
  backward_steps JSON,
  
  -- Current state
  current_value DECIMAL(14,2),
  gap_value DECIMAL(14,2),
  gap_percentage DECIMAL(6,2),
  trend ENUM('improving','stable','declining') DEFAULT 'stable',
  probability_of_success DECIMAL(5,2),
  
  -- Reasoning
  reasoning_chain JSON,
  references JSON,
  alternatives_considered JSON,
  
  -- Compliance
  suitability_score DECIMAL(5,2),
  compliance_flags JSON,
  last_review_date DATE,
  next_review_date DATE,
  
  -- Meta
  status ENUM('draft','active','review','archived') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_parent (parent_id),
  INDEX idx_owner (owner_id),
  INDEX idx_level (level),
  INDEX idx_entity (entity_type, entity_id)
);

-- Goal hierarchy with prioritization
CREATE TABLE client_goals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  advisor_id INT,
  planning_node_id INT,
  
  goal_category ENUM('protection','retirement','estate','tax','education','debt','growth','business','cash_flow','premium_finance','ilit','exec_comp','charitable','legacy','healthcare') NOT NULL,
  goal_name VARCHAR(255) NOT NULL,
  goal_description TEXT,
  
  -- Quantification
  target_amount DECIMAL(14,2),
  current_amount DECIMAL(14,2),
  target_date DATE,
  time_horizon_years INT,
  priority_rank INT,
  
  -- Monte Carlo
  probability_of_success DECIMAL(5,2),
  confidence_interval_low DECIMAL(14,2),
  confidence_interval_high DECIMAL(14,2),
  
  -- Dependencies
  depends_on_goals JSON, -- array of goal IDs that must be achieved first
  conflicts_with_goals JSON, -- array of goal IDs that conflict
  
  -- Status
  status ENUM('identified','agreed','in_progress','on_track','at_risk','achieved','deferred','abandoned') DEFAULT 'identified',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_client (client_id),
  INDEX idx_advisor (advisor_id),
  INDEX idx_node (planning_node_id)
);

-- Rich references attached to any planning node
CREATE TABLE planning_references (
  id INT AUTO_INCREMENT PRIMARY KEY,
  planning_node_id INT NOT NULL,
  
  ref_type ENUM('regulatory','academic','carrier','market_data','case_law','internal','illustration','fact_sheet') NOT NULL,
  title VARCHAR(500) NOT NULL,
  citation TEXT,
  url VARCHAR(2000),
  relevance TEXT,
  date_accessed DATE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_node (planning_node_id)
);

-- PFR document tracking
CREATE TABLE personal_financial_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  advisor_id INT NOT NULL,
  planning_node_id INT,
  
  review_type ENUM('initial','annual','life_event','regulatory','ad_hoc') NOT NULL,
  review_date DATE NOT NULL,
  
  -- Document
  document_url VARCHAR(2000),
  document_key VARCHAR(500),
  
  -- Sections included
  sections_included JSON,
  calculator_outputs_snapshot JSON,
  goal_hierarchy_snapshot JSON,
  recommendations_snapshot JSON,
  
  -- Approval
  advisor_approved_at TIMESTAMP,
  client_acknowledged_at TIMESTAMP,
  e_signature_id INT,
  
  -- Compliance
  suitability_documentation JSON,
  compliance_review_status ENUM('pending','approved','flagged','escalated') DEFAULT 'pending',
  compliance_reviewer_id INT,
  compliance_review_date TIMESTAMP,
  
  -- Archival (FINRA 3-year retention)
  retention_expires_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_client (client_id),
  INDEX idx_advisor (advisor_id)
);

-- Discovery layer for comprehensive client understanding
CREATE TABLE client_discovery (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  advisor_id INT,
  
  -- Qualitative discovery
  values_priorities JSON, -- legacy, charitable, family, independence, security
  risk_attitudes JSON, -- psychometric results
  family_dynamics JSON, -- family tree, relationships, special needs
  health_status JSON, -- general health, family longevity, conditions
  employer_benefits JSON, -- 401k match, ESOP, stock options, pension
  existing_documents JSON, -- will, trust, insurance policies, beneficiaries
  
  -- Life events
  anticipated_life_events JSON, -- marriage, retirement, sale of business, inheritance
  
  -- Communication preferences
  preferred_contact_method VARCHAR(50),
  preferred_meeting_frequency VARCHAR(50),
  preferred_report_detail_level ENUM('summary','standard','detailed') DEFAULT 'standard',
  
  -- Discovery completeness
  completeness_score DECIMAL(5,2),
  last_discovery_date DATE,
  next_discovery_date DATE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_client (client_id)
);
```

### 6.7 "Also My Client" Enhanced Roll-Up

The existing `calcClientPracticeOpportunity` function should be extended to:

1. **When a user selects "Also My Client"** in practice management, the system:
   - Creates a `clientAssociation` linking the user to the advisor
   - Copies the user's `FinancialProfile` into the advisor's client data
   - Creates a `planning_node` at the client level linked to the advisor's practice node
   - Generates initial `client_goals` from the profile data
   - Calculates revenue opportunity and adds to the advisor's pipeline

2. **Ongoing synchronization:**
   - When the client updates their profile, the advisor sees the changes
   - When the advisor creates recommendations, the client sees them in their portal
   - Calculator outputs flow bidirectionally — client can run calculators, advisor can run them for the client
   - Compliance documentation is automatically generated for the advisor's fiduciary file

### 6.8 Wealth Engine Alignment

The unified calculator orchestrator should be updated so that:

**Practice Management panels** (19) feed into `planning_nodes` at the advisor level:
- My Plan → advisor-level forward/backward plan
- GDC Brackets → income target decomposition
- Products → product mix optimization
- Sales Funnel → pipeline probability weighting
- Dashboard → aggregate roll-up view

**Client Planning panels** (15) feed into `planning_nodes` at the client level:
- Client Profile → discovery layer population
- Cash Flow → cash_flow goal node
- Retirement → retirement goal node
- Tax Planning → tax goal node
- Estate → estate goal node
- Education → education goal node
- Protection → protection goal node
- Business Client → business goal node
- Growth → growth goal node
- Balance Sheet → net worth tracking
- Debt Management → debt goal node
- Trust Engineering → estate/ilit strategy nodes
- Governance/IPS → investment strategy documentation
- Monte Carlo → probability of success for all goals
- Stock-Based Comp → exec_comp goal node

**Advanced panels** (12) feed into `planning_nodes` at the strategy level:
- Advanced Strategies → strategy alternatives
- Cost-Benefit → strategy evaluation
- Strategy Compare → side-by-side analysis
- Summary → PFR executive summary
- Action Plan → implementation sequencing
- Timeline → implementation scheduling
- Premium Financing → premium_finance strategy node
- ILIT/Trust → ilit strategy node
- Executive Comp → exec_comp strategy node
- Charitable Planning → charitable strategy node

**References & Due Diligence panels** (3) feed into `planning_references`:
- References → regulatory and academic citations
- Due Diligence → carrier and product research

---

## 7. Additional Advisor Workflows Identified

### 7.1 Workflows Currently Missing

| Workflow | Description | Priority |
|---|---|---|
| **Prospect-to-Client Conversion** | Structured workflow from initial contact through fact-finding to engagement letter signing | High |
| **Policy Delivery & Free Look** | Insurance policy delivery with 10-day free look tracking and client acknowledgment | High |
| **1035 Exchange Analysis** | Tax-free insurance policy exchange evaluation with comparison of old vs. new | High |
| **Beneficiary Review** | Systematic beneficiary audit across all accounts and policies | High |
| **Tax Return Review** | Structured analysis of client tax returns to identify planning opportunities | Medium |
| **Estate Document Review** | Will/trust review with gap identification and attorney referral | Medium |
| **Divorce Planning** | Financial analysis for divorce proceedings (QDRO, asset division, support) | Medium |
| **Business Succession** | Structured succession planning beyond the existing business exit plan | Medium |
| **Charitable Planning Workflow** | End-to-end charitable giving strategy (CRT, CLT, DAF, private foundation) | Medium |
| **Special Needs Planning** | ABLE accounts, special needs trusts, government benefit preservation | Low |
| **Elder Care Planning** | Medicaid planning, VA benefits, caregiver coordination | Low |
| **Cross-Border Planning** | International tax, foreign account reporting (FBAR/FATCA), treaty benefits | Low |

### 7.2 Workflows Partially Implemented

| Workflow | Current State | Needed Enhancement |
|---|---|---|
| **Client Onboarding** | Guided intake flow exists | Add engagement letter generation, fee disclosure, Form CRS delivery tracking |
| **Annual Review** | Review page exists | Add year-over-year comparison, goal progress visualization, plan adherence trending |
| **Insurance Application** | Application tracking exists | Add underwriting status, requirements tracking, policy delivery confirmation |
| **Compliance Audit** | Audit page exists | Add random sample selection, supervisory review documentation, exception tracking |
| **Meeting Management** | Video conferencing + transcription | Add pre-meeting brief generation, post-meeting action item extraction, follow-up scheduling |

---

## 8. Adversarial Analysis — Hidden Failure Modes

### 8.1 Silent Failures

| Failure Mode | Description | Risk Level |
|---|---|---|
| **Stale suitability scores** | Suitability decay runs on a schedule but client circumstances can change between runs | Medium |
| **Calculator assumption drift** | Each calculator panel may use different assumptions (inflation, returns) leading to inconsistent projections | High |
| **Recommendation orphaning** | Recommendations in `recommendationsLog` may not be linked to specific goals, making it impossible to track whether the recommendation addresses the identified gap | High |
| **Compliance documentation gaps** | The `reasoning` field is free text — there is no enforcement that it contains the required elements for Reg BI or fiduciary documentation | High |
| **"Also My Client" data staleness** | After initial roll-up, there is no guaranteed synchronization mechanism if the client updates their profile independently | Medium |

### 8.2 Regulatory Risk Areas

| Area | Risk | Mitigation Needed |
|---|---|---|
| **Reg BI documentation** | Free-text reasoning may not satisfy SEC examination requirements | Structured reasoning template with required fields |
| **FINRA 3-year retention** | Communication archive has retention tracking but not all recommendation documents are archived | Automatic archival of all PFR documents and recommendation chains |
| **State insurance replacement** | No structured replacement analysis per NAIC Model Regulation 613 | Replacement analysis workflow with required comparison fields |
| **Senior investor protections** | No age-based suitability enhancements | Age-triggered additional suitability checks and cooling-off period tracking |
| **Privacy (Reg S-P)** | Client data sharing between practice levels needs consent tracking | Explicit consent management for data sharing between advisor and client levels |

---

## 9. Implementation Priority Matrix

### Phase 1 — Foundation (COMPLETED, Pass 115)

1. ~~**Planning Nodes table and API** — Core hierarchy model~~ **DONE** — 6 tables, 25 query helpers
2. ~~**Client Goals table** — Goal hierarchy with prioritization~~ **DONE** — with planning node linkage
3. ~~**Client Discovery table** — Extended client understanding~~ **DONE** — with upsert support
4. ~~**Planning References table** — Rich reference attachment~~ **DONE** — with node linkage
5. ~~**Shared Assumptions propagation** — Consistent calculator inputs~~ **DONE** — 3-tier cascade resolution
6. ~~**Recommendation-to-Goal linking** — Connect recommendations to specific goals~~ **DONE** — with Reg BI reasoning chains

### Phase 2 — PFR Pipeline (COMPLETED, Pass 115)

1. ~~**PFR document generator** — Aggregates all calculator outputs into unified document~~ **DONE** — LLM-powered section-by-section pipeline
2. ~~**Reasoning chain enforcement** — Structured reasoning for every recommendation~~ **DONE** — `ReasoningChain` interface with `validateReasoningChain`
3. ~~**Alternative presentation** — Side-by-side comparison generation~~ **DONE** — via PFR generator alternatives section
4. ~~**Implementation sequencing** — Dependency-aware action plans~~ **DONE** — via PFR generator implementation section
5. ~~**PFR tracking table** — Document lifecycle management~~ **DONE** — `personal_financial_reviews` table with status tracking

### Phase 3 — Bidirectional Flow (COMPLETED, Pass 115)

1. ~~**Enhanced "Also My Client" sync** — Bidirectional profile synchronization~~ **DONE** — `alsoMyClientSync` service
2. ~~**Practice-to-Client propagation** — Rate changes, product updates, regulatory alerts~~ **DONE** — `syncPracticeToClients` function
3. ~~**Client-to-Practice roll-up** — Revenue impact, pipeline updates, compliance workload~~ **DONE** — `verifyRollUpConsistency` function
4. **Benchmark integration** — Client plan vs. peer comparison — *Deferred to Phase 4*

### Phase 4 — Advanced Workflows (Ongoing)

1. **Policy delivery & free look tracking**
2. **1035 exchange analysis**
3. **Beneficiary review workflow**
4. **Tax return review workflow**
5. **Prospect-to-client conversion pipeline**
6. **Supervisory review workflow**

---

## 10. Rating

**Current State: 8.6 / 10** (updated Pass 115, previously 7.8)

The platform is genuinely impressive in scope and ambition. The practice management calculator suite (19 panels with forward/backward planning) is best-in-class for the insurance distribution channel. The AI integration (consensus engine, autonomous client analysis, contextual wiring) is sophisticated. The integration stack (Plaid, SnapTrade, Daily.co, Deepgram, FRED, BLS) is comprehensive.

With the completion of Phases 1-3 of the unified planning hierarchy, the **client planning layer now matches the depth of the practice management hierarchy**. The PFR workflow is implemented with LLM-powered document generation. The unified planning node architecture provides hierarchical reasoning, rich references, and bidirectional data flow. The five silent failure modes identified in Section 8.1 have all been addressed with concrete service implementations.

**Justification for 8.6:** The platform now exceeds expert-level (7) across all domains. The planning hierarchy closes the primary gap identified in the original assessment. Remaining distance to 9.0+ is in Phase 4 advanced workflows (policy delivery tracking, 1035 exchange analysis, beneficiary review) and benchmark integration, which are enhancement-level items rather than architectural gaps.

---

## 11. Next Pass Recommendation

**Phases 1-3 are complete.** The next pass should focus on **Phase 4 advanced workflows**:
1. Policy delivery and free look tracking
2. 1035 exchange analysis
3. Beneficiary review workflow
4. Tax return review workflow
5. Benchmark integration (deferred from Phase 3)

**Re-entry triggers for future passes:**
- DOL Fiduciary Rule 2.0 finalization (regulatory compliance update needed)
- NAIC model regulation changes (insurance suitability workflow update)
- SEC Marketing Rule enforcement actions (compliance documentation enhancement)
- Client feedback on PFR document quality and usefulness
