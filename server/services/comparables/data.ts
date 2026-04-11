/**
 * Competitive comparables — curated catalog of existing and planned apps
 * in the financial-advisor / wealth-management / AI-copilot space.
 *
 * This is the authoritative data source for the `/comparables` admin
 * dashboard (Pass 1 of the hybrid build loop, scope:
 * "best existing and planned comparables overall to stewardly repo as
 * an app per comprehensive guide").
 *
 * Every comparable is scored on the same 18-feature rubric so the
 * gap matrix can surface exactly which axes Stewardly leads, matches,
 * or trails on. Feature support is 0..3:
 *   0 = not offered
 *   1 = shallow / marketing
 *   2 = real but limited / niche
 *   3 = first-class, widely used
 *
 * `stewardlyScore` per feature reflects current code in this repo per
 * STEWARDLY_COMPREHENSIVE_GUIDE.md — reviewed each build loop pass.
 *
 * IMPORTANT: This file is DATA. All scoring logic lives in scoring.ts.
 * When adjusting a comparable score, leave a dated note in sourceNotes
 * so the assessment loop can verify.
 */

export type ComparableCategory =
  | "ai_meeting_assistant"
  | "financial_planning"
  | "portfolio_mgmt"
  | "advisor_copilot"
  | "robo_advisor"
  | "tax_estate_specialist"
  | "compliance_crm"
  | "consumer_finance";

export type LaunchStatus =
  | "shipping" // GA, customers using it today
  | "beta" // public beta / waitlist open
  | "planned" // announced roadmap, not yet public
  | "rumored"; // credible reporting, unconfirmed

export type FeatureAxisId =
  | "chat_native_ux"
  | "multi_model_ai"
  | "meeting_transcription"
  | "crm_sync"
  | "compliance_archive"
  | "portfolio_mgmt"
  | "rebalancing"
  | "tax_planning"
  | "estate_planning"
  | "insurance_analysis"
  | "premium_finance"
  | "lead_capture"
  | "client_portal"
  | "mobile_app"
  | "white_label"
  | "api_first"
  | "agent_framework"
  | "wealth_calculators";

export interface FeatureAxis {
  id: FeatureAxisId;
  label: string;
  description: string;
  /** Stewardly's current score on this axis (0..3). */
  stewardlyScore: number;
  /** Where the supporting code lives (for auditing). */
  stewardlyEvidence: string;
}

export const FEATURE_AXES: readonly FeatureAxis[] = [
  {
    id: "chat_native_ux",
    label: "Chat-native UX",
    description: "Conversation IS the primary interface, not a chat bubble stapled to a legacy dashboard.",
    stewardlyScore: 3,
    stewardlyEvidence: "client/src/pages/Chat.tsx is the landing page and feature gateway (pass 85/90).",
  },
  {
    id: "multi_model_ai",
    label: "Multi-model consensus",
    description: "Can query multiple frontier models in parallel and surface agreement/disagreement.",
    stewardlyScore: 3,
    stewardlyEvidence: "server/services/consensusStream.ts + /consensus page + Round C/D/E.",
  },
  {
    id: "meeting_transcription",
    label: "Meeting transcription + AI notes",
    description: "Records advisor-client calls, transcribes, extracts action items, pushes to CRM.",
    stewardlyScore: 1,
    stewardlyEvidence: "server/routers/meetings.ts exists; transcription + structured note extraction not yet automated.",
  },
  {
    id: "crm_sync",
    label: "CRM integrations",
    description: "Two-way sync with Wealthbox / Redtail / Salesforce / GHL / HubSpot.",
    stewardlyScore: 3,
    stewardlyEvidence: "server/services/ghl/ + server/routers/serviceRouters.ts (crmRouter) — GHL v2, Wealthbox, Redtail adapters.",
  },
  {
    id: "compliance_archive",
    label: "FINRA 17a-4 archive",
    description: "WORM-compliant communication archive for SEC/FINRA recordkeeping.",
    stewardlyScore: 3,
    stewardlyEvidence: "server/services/compliance/ + FINRA 17a-4 communication archive per CLAUDE.md.",
  },
  {
    id: "portfolio_mgmt",
    label: "Portfolio accounting",
    description: "Aggregates held-away + managed accounts, positions, performance.",
    stewardlyScore: 1,
    stewardlyEvidence: "Plaid perception in server/services/improvement/; no dedicated portfolio accounting ledger.",
  },
  {
    id: "rebalancing",
    label: "Rebalancing / drift alerts",
    description: "Detects portfolio drift vs target allocation and proposes trades.",
    stewardlyScore: 1,
    stewardlyEvidence: "server/services/portfolio/rebalancing.ts — pure drift engine + cash-neutral trade proposals + tax-aware sell ordering + cash-buffer rule (Pass 2). Live portfolio ingestion pending.",
  },
  {
    id: "tax_planning",
    label: "Tax planning / projection",
    description: "Multi-year tax projections, Roth conversion analysis, TLH, basis tracking.",
    stewardlyScore: 2,
    stewardlyEvidence: "client/src/pages/TaxPlanning.tsx + /tax-planning calculator route exist; basis tracking + multi-year projection limited.",
  },
  {
    id: "estate_planning",
    label: "Estate planning",
    description: "Document tracking, beneficiary mapping, trust structure modeling.",
    stewardlyScore: 2,
    stewardlyEvidence: "client/src/pages/EstatePlanning.tsx + calculators; no automated doc intake / flowchart.",
  },
  {
    id: "insurance_analysis",
    label: "Insurance analysis + quoting",
    description: "Coverage gap analysis, carrier APIs, auto-quotes for life/DI/LTC.",
    stewardlyScore: 3,
    stewardlyEvidence: "/insurance-analysis + carrierConnector + 8-part agentic execution (agent_quotes, agent_applications, agent_carrier).",
  },
  {
    id: "premium_finance",
    label: "Premium finance",
    description: "Non-recourse premium-finance structuring for high-net-worth life.",
    stewardlyScore: 3,
    stewardlyEvidence: "server/routers/premiumFinanceRouter.ts + SOFR rates via FRED + dedicated wealth engines.",
  },
  {
    id: "lead_capture",
    label: "Lead capture + propensity",
    description: "Multi-source ingestion, enrichment, propensity scoring, pipeline.",
    stewardlyScore: 3,
    stewardlyEvidence: "server/routers/leadPipeline.ts + propensity.ts + import engines (CSV, Dripify, Sales Nav).",
  },
  {
    id: "client_portal",
    label: "Client portal",
    description: "Branded client-facing portal with docs, statements, secure messaging.",
    stewardlyScore: 2,
    stewardlyEvidence: "/portal + clientPortal router; branded doc/message flows limited.",
  },
  {
    id: "mobile_app",
    label: "Native mobile app",
    description: "Shipping iOS / Android native app (not just a mobile web view).",
    stewardlyScore: 0,
    stewardlyEvidence: "Responsive web only. No React Native / Capacitor shell yet.",
  },
  {
    id: "white_label",
    label: "White-label / multi-tenant",
    description: "Per-org branding + multi-tenant isolation for enterprise resellers.",
    stewardlyScore: 3,
    stewardlyEvidence: "tenantContext.ts + organizations router + OrgBrandingEditor.tsx.",
  },
  {
    id: "api_first",
    label: "Public API / webhooks",
    description: "Developer-facing API with stable contract + webhook events.",
    stewardlyScore: 2,
    stewardlyEvidence: "tRPC internally; webhook routers (dripify/ghl/smsit) exist; no versioned external REST yet.",
  },
  {
    id: "agent_framework",
    label: "Agent framework",
    description: "Multi-step autonomous agents with human-in-the-loop graduated autonomy.",
    stewardlyScore: 3,
    stewardlyEvidence: "server/routers/openClaw.ts + agent_autonomy_levels + ReAct loop in shared/intelligence.",
  },
  {
    id: "wealth_calculators",
    label: "Wealth calculators",
    description: "UWE / BIE / HE / retirement Monte Carlo suite.",
    stewardlyScore: 3,
    stewardlyEvidence: "server/shared/calculators/ + wealth-engine pages — fully ported from WealthBridge v7.",
  },
] as const;

export interface ComparableAppFeature {
  axis: FeatureAxisId;
  /** 0..3 — see rubric in the module doc. */
  score: number;
  /** Optional one-line evidence — where the feature lives in the comparable. */
  note?: string;
}

export interface ComparableApp {
  id: string;
  name: string;
  vendor: string;
  category: ComparableCategory;
  status: LaunchStatus;
  /** Year the product / company launched or was announced. */
  since: number;
  /** External site if publicly listed. */
  url?: string;
  /** One-sentence positioning claim. */
  pitch: string;
  /** Free-text snapshot of strengths. */
  strengths: string[];
  /** Free-text snapshot of gaps. */
  gaps: string[];
  /** Per-feature scores — omitted axes default to 0. */
  features: ComparableAppFeature[];
  /** Who it competes with Stewardly over. */
  overlapsWith: FeatureAxisId[];
  /** Dated notes so assessment loop can verify. */
  sourceNotes: string;
}

export const CATEGORY_LABELS: Record<ComparableCategory, string> = {
  ai_meeting_assistant: "AI meeting assistant",
  financial_planning: "Financial planning",
  portfolio_mgmt: "Portfolio management",
  advisor_copilot: "Advisor copilot",
  robo_advisor: "Robo-advisor",
  tax_estate_specialist: "Tax / estate specialist",
  compliance_crm: "Compliance / CRM",
  consumer_finance: "Consumer finance",
};

/**
 * Seeded catalog — 18 apps across 8 categories. Scored based on public
 * marketing material + trade-press coverage as of April 2026. When a
 * comparable ships a new feature, add a dated line to sourceNotes.
 */
export const COMPARABLES: readonly ComparableApp[] = [
  // ── AI meeting assistants ──────────────────────────────────────────
  {
    id: "jump-ai",
    name: "Jump",
    vendor: "Jump AI, Inc.",
    category: "ai_meeting_assistant",
    status: "shipping",
    since: 2023,
    url: "https://jumpapp.com",
    pitch: "AI meeting notes + CRM sync purpose-built for financial advisors.",
    strengths: [
      "Industry-tuned transcription with advisor-specific action-item schema",
      "Native Wealthbox + Redtail + Salesforce push",
      "Automated compliance-friendly note summaries",
    ],
    gaps: [
      "Single-purpose — no planning, portfolio, or lead engine",
      "No multi-model consensus; single LLM backend",
    ],
    features: [
      { axis: "meeting_transcription", score: 3, note: "Core product" },
      { axis: "crm_sync", score: 3, note: "Wealthbox / Redtail / Salesforce" },
      { axis: "compliance_archive", score: 2 },
      { axis: "chat_native_ux", score: 1 },
    ],
    overlapsWith: ["meeting_transcription", "crm_sync", "compliance_archive"],
    sourceNotes: "2026-04 jumpapp.com marketing + Riskalyze podcast interview.",
  },
  {
    id: "zocks",
    name: "Zocks",
    vendor: "Zocks, Inc.",
    category: "ai_meeting_assistant",
    status: "shipping",
    since: 2023,
    url: "https://zocks.io",
    pitch: "Advisor meeting intelligence that reconciles notes to CRM fields.",
    strengths: [
      "Structured-field extraction (risk tolerance, time horizon, dependents)",
      "Compliance redaction pass on every transcript",
    ],
    gaps: [
      "No AI chat surface",
      "Limited calculator / planning integration",
    ],
    features: [
      { axis: "meeting_transcription", score: 3 },
      { axis: "crm_sync", score: 3 },
      { axis: "compliance_archive", score: 2 },
    ],
    overlapsWith: ["meeting_transcription", "crm_sync"],
    sourceNotes: "2026-04 zocks.io product page + T3 2025 launch coverage.",
  },
  {
    id: "zeplyn",
    name: "Zeplyn",
    vendor: "Zeplyn (Ex-Google Wealth)",
    category: "ai_meeting_assistant",
    status: "shipping",
    since: 2023,
    pitch: "AI assistant that joins client meetings and fills out CRM forms automatically.",
    strengths: [
      "Deep CRM write-back (notes, tasks, custom fields)",
      "Strong founder pedigree from Google Wealth",
    ],
    gaps: [
      "Narrow scope (meetings only)",
    ],
    features: [
      { axis: "meeting_transcription", score: 3 },
      { axis: "crm_sync", score: 3 },
    ],
    overlapsWith: ["meeting_transcription", "crm_sync"],
    sourceNotes: "2026-04 Financial Planning magazine startup profile.",
  },

  // ── Financial planning software ───────────────────────────────────
  {
    id: "rightcapital",
    name: "RightCapital",
    vendor: "RightCapital, Inc.",
    category: "financial_planning",
    status: "shipping",
    since: 2015,
    url: "https://rightcapital.com",
    pitch: "Modern financial planning software with tax-focused projections.",
    strengths: [
      "Multi-year tax projection + Roth conversion analysis",
      "Social Security optimizer",
      "Interactive client portal",
    ],
    gaps: [
      "Traditional GUI — no chat-native mode",
      "No meeting transcription, no agent framework",
    ],
    features: [
      { axis: "tax_planning", score: 3 },
      { axis: "estate_planning", score: 2 },
      { axis: "client_portal", score: 3 },
      { axis: "wealth_calculators", score: 3 },
      { axis: "chat_native_ux", score: 0 },
    ],
    overlapsWith: ["tax_planning", "wealth_calculators", "client_portal"],
    sourceNotes: "2026-04 rightcapital.com features page.",
  },
  {
    id: "moneyguidepro",
    name: "MoneyGuidePro",
    vendor: "Envestnet",
    category: "financial_planning",
    status: "shipping",
    since: 2001,
    url: "https://moneyguidepro.com",
    pitch: "Goal-based planning software with broad advisor install base.",
    strengths: [
      "Largest planning-software advisor footprint",
      "Envestnet platform integration",
    ],
    gaps: [
      "Legacy desktop DNA in the web port",
      "Minimal AI presence",
    ],
    features: [
      { axis: "tax_planning", score: 2 },
      { axis: "estate_planning", score: 2 },
      { axis: "client_portal", score: 2 },
      { axis: "wealth_calculators", score: 2 },
    ],
    overlapsWith: ["tax_planning", "wealth_calculators"],
    sourceNotes: "2026-04 Envestnet MGP product page.",
  },
  {
    id: "emoney",
    name: "eMoney",
    vendor: "Fidelity (eMoney Advisor)",
    category: "financial_planning",
    status: "shipping",
    since: 2000,
    url: "https://emoneyadvisor.com",
    pitch: "Cash-flow-based planning with account aggregation and client vault.",
    strengths: [
      "Strong account aggregation",
      "Document vault + client portal",
      "Fidelity distribution",
    ],
    gaps: [
      "Traditional UI",
      "No agentic automation",
    ],
    features: [
      { axis: "portfolio_mgmt", score: 3 },
      { axis: "tax_planning", score: 2 },
      { axis: "estate_planning", score: 2 },
      { axis: "client_portal", score: 3 },
      { axis: "wealth_calculators", score: 3 },
    ],
    overlapsWith: ["portfolio_mgmt", "client_portal", "wealth_calculators"],
    sourceNotes: "2026-04 emoneyadvisor.com features page.",
  },

  // ── Tax / estate specialists ──────────────────────────────────────
  {
    id: "holistiplan",
    name: "Holistiplan",
    vendor: "Holistiplan, LLC",
    category: "tax_estate_specialist",
    status: "shipping",
    since: 2019,
    url: "https://holistiplan.com",
    pitch: "Tax return scanning + observation letters for advisors.",
    strengths: [
      "1040 OCR + automated tax observation letters",
      "Bracket optimization visualizer",
    ],
    gaps: [
      "Tax-only scope",
      "No conversational interface",
    ],
    features: [
      { axis: "tax_planning", score: 3 },
      { axis: "wealth_calculators", score: 1 },
    ],
    overlapsWith: ["tax_planning"],
    sourceNotes: "2026-04 holistiplan.com marketing.",
  },
  {
    id: "fpalpha",
    name: "FP Alpha",
    vendor: "FP Alpha",
    category: "tax_estate_specialist",
    status: "shipping",
    since: 2019,
    url: "https://fpalpha.com",
    pitch: "AI-powered holistic advice across tax, estate, insurance, property.",
    strengths: [
      "Document OCR for tax returns + estate docs + insurance policies",
      "Module-based expansion",
    ],
    gaps: [
      "Report-first workflow (not chat)",
    ],
    features: [
      { axis: "tax_planning", score: 3 },
      { axis: "estate_planning", score: 3 },
      { axis: "insurance_analysis", score: 2 },
    ],
    overlapsWith: ["tax_planning", "estate_planning", "insurance_analysis"],
    sourceNotes: "2026-04 fpalpha.com product page.",
  },
  {
    id: "vanilla",
    name: "Vanilla",
    vendor: "Vanilla Technologies",
    category: "tax_estate_specialist",
    status: "shipping",
    since: 2020,
    url: "https://justvanilla.com",
    pitch: "Estate advisory platform for financial advisors.",
    strengths: [
      "Interactive estate diagrams",
      "Scenario modeling for estate tax",
    ],
    gaps: [
      "Estate-only scope",
    ],
    features: [
      { axis: "estate_planning", score: 3 },
    ],
    overlapsWith: ["estate_planning"],
    sourceNotes: "2026-04 justvanilla.com.",
  },

  // ── Portfolio management ──────────────────────────────────────────
  {
    id: "orion",
    name: "Orion",
    vendor: "Orion Advisor Solutions",
    category: "portfolio_mgmt",
    status: "shipping",
    since: 1999,
    url: "https://orion.com",
    pitch: "Portfolio accounting + rebalancing + advisor tech stack.",
    strengths: [
      "Mature portfolio accounting ledger",
      "Rebalancing engine (Orion Eclipse)",
      "Risk analytics (Risk Intelligence post-Riskalyze merge)",
    ],
    gaps: [
      "Legacy architecture in some modules",
    ],
    features: [
      { axis: "portfolio_mgmt", score: 3 },
      { axis: "rebalancing", score: 3 },
      { axis: "client_portal", score: 2 },
      { axis: "crm_sync", score: 2 },
    ],
    overlapsWith: ["portfolio_mgmt", "rebalancing", "client_portal"],
    sourceNotes: "2026-04 orion.com product suite.",
  },
  {
    id: "envestnet",
    name: "Envestnet",
    vendor: "Envestnet (Bain acquired)",
    category: "portfolio_mgmt",
    status: "shipping",
    since: 1999,
    url: "https://envestnet.com",
    pitch: "Unified wealth platform for RIAs, broker-dealers, banks.",
    strengths: [
      "End-to-end platform (plan, invest, advise)",
      "Owns MoneyGuidePro + Tamarac + Yodlee",
    ],
    gaps: [
      "Enterprise only",
      "Slow innovation cycle",
    ],
    features: [
      { axis: "portfolio_mgmt", score: 3 },
      { axis: "rebalancing", score: 3 },
      { axis: "tax_planning", score: 2 },
      { axis: "wealth_calculators", score: 2 },
    ],
    overlapsWith: ["portfolio_mgmt", "rebalancing"],
    sourceNotes: "2026-04 envestnet.com.",
  },
  {
    id: "altruist",
    name: "Altruist",
    vendor: "Altruist Corp",
    category: "portfolio_mgmt",
    status: "shipping",
    since: 2019,
    url: "https://altruist.com",
    pitch: "All-in-one modern custodian + portfolio software for RIAs.",
    strengths: [
      "Modern UI + API",
      "Combined custody + portfolio accounting",
      "Strong VC funding cycle",
    ],
    gaps: [
      "Custody lock-in",
    ],
    features: [
      { axis: "portfolio_mgmt", score: 3 },
      { axis: "rebalancing", score: 2 },
      { axis: "client_portal", score: 3 },
      { axis: "api_first", score: 3 },
    ],
    overlapsWith: ["portfolio_mgmt", "client_portal"],
    sourceNotes: "2026-04 altruist.com.",
  },

  // ── Advisor copilots ──────────────────────────────────────────────
  {
    id: "finmate",
    name: "FinMate AI",
    vendor: "FinMate",
    category: "advisor_copilot",
    status: "shipping",
    since: 2023,
    url: "https://finmate.ai",
    pitch: "AI assistant for advisor meetings + follow-up emails + compliance.",
    strengths: [
      "Meeting transcription + follow-up automation",
      "Compliance-aware drafting",
    ],
    gaps: [
      "Narrow scope",
    ],
    features: [
      { axis: "meeting_transcription", score: 3 },
      { axis: "compliance_archive", score: 2 },
    ],
    overlapsWith: ["meeting_transcription", "compliance_archive"],
    sourceNotes: "2026-04 finmate.ai.",
  },
  {
    id: "pulse-orion",
    name: "Pulse",
    vendor: "Orion Advisor Solutions",
    category: "advisor_copilot",
    status: "beta",
    since: 2024,
    url: "https://orion.com/pulse",
    pitch: "Orion's AI assistant layered across the advisor tech stack.",
    strengths: [
      "Embedded in existing Orion install base",
    ],
    gaps: [
      "Tied to Orion platform",
      "Limited outside-Orion data",
    ],
    features: [
      { axis: "multi_model_ai", score: 1 },
      { axis: "portfolio_mgmt", score: 3 },
      { axis: "rebalancing", score: 2 },
    ],
    overlapsWith: ["multi_model_ai", "portfolio_mgmt"],
    sourceNotes: "2026-04 Orion T3 announcement.",
  },

  // ── Robo-advisors ─────────────────────────────────────────────────
  {
    id: "wealthfront",
    name: "Wealthfront",
    vendor: "Wealthfront Advisers",
    category: "robo_advisor",
    status: "shipping",
    since: 2008,
    url: "https://wealthfront.com",
    pitch: "Automated investment management and banking for DIY investors.",
    strengths: [
      "Tax-loss harvesting",
      "Direct indexing",
      "Cash management",
    ],
    gaps: [
      "No human advisor layer",
      "No advisor distribution",
    ],
    features: [
      { axis: "portfolio_mgmt", score: 3 },
      { axis: "rebalancing", score: 3 },
      { axis: "tax_planning", score: 2 },
      { axis: "mobile_app", score: 3 },
    ],
    overlapsWith: ["portfolio_mgmt", "rebalancing", "mobile_app"],
    sourceNotes: "2026-04 wealthfront.com.",
  },
  {
    id: "betterment",
    name: "Betterment",
    vendor: "Betterment Holdings",
    category: "robo_advisor",
    status: "shipping",
    since: 2010,
    url: "https://betterment.com",
    pitch: "Goal-based automated investing with optional human advice.",
    strengths: [
      "Betterment for Advisors custody platform",
      "Goal framework",
    ],
    gaps: [
      "Thin planning layer",
    ],
    features: [
      { axis: "portfolio_mgmt", score: 3 },
      { axis: "rebalancing", score: 3 },
      { axis: "mobile_app", score: 3 },
      { axis: "client_portal", score: 3 },
    ],
    overlapsWith: ["portfolio_mgmt", "rebalancing", "mobile_app"],
    sourceNotes: "2026-04 betterment.com.",
  },

  // ── Consumer finance — hybrid ────────────────────────────────────
  {
    id: "farther",
    name: "Farther",
    vendor: "Farther Finance",
    category: "consumer_finance",
    status: "shipping",
    since: 2019,
    url: "https://farther.com",
    pitch: "Technology-forward wealth management with human advisors.",
    strengths: [
      "Native digital advisor experience",
      "High-net-worth positioning",
    ],
    gaps: [
      "Captive advisor model (closed platform)",
    ],
    features: [
      { axis: "portfolio_mgmt", score: 3 },
      { axis: "tax_planning", score: 2 },
      { axis: "estate_planning", score: 2 },
      { axis: "mobile_app", score: 3 },
      { axis: "client_portal", score: 3 },
    ],
    overlapsWith: ["portfolio_mgmt", "client_portal"],
    sourceNotes: "2026-04 farther.com.",
  },
  {
    id: "range",
    name: "Range",
    vendor: "Range Finance",
    category: "consumer_finance",
    status: "shipping",
    since: 2021,
    url: "https://range.com",
    pitch: "Flat-fee tech-enabled wealth management for high earners.",
    strengths: [
      "All-in-one dashboard",
      "Flat-fee pricing",
    ],
    gaps: [
      "Limited to Range's captive advisors",
    ],
    features: [
      { axis: "portfolio_mgmt", score: 2 },
      { axis: "tax_planning", score: 2 },
      { axis: "estate_planning", score: 2 },
      { axis: "client_portal", score: 3 },
    ],
    overlapsWith: ["portfolio_mgmt", "client_portal"],
    sourceNotes: "2026-04 range.com.",
  },
];
