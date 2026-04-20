/**
 * parityMapping.ts — Parity Spec v8.2 Capability Mapping
 *
 * Pass 123: Maps WealthBridge capabilities against competitive landscape
 * per the Recursive Optimization Convergence Parity Spec.
 *
 * Categories: Planning, Protection, Growth, Practice Management,
 * Compliance, Data, AI, Client Experience, Integration, Reporting.
 */

export interface ParityCapability {
  id: string;
  category: string;
  capability: string;
  description: string;
  status: 'live' | 'beta' | 'planned' | 'not-started';
  panel?: string;           // Which Wealth Engine panel implements this
  route?: string;           // Which route provides this
  competitors: string[];    // Who else offers this
  differentiator: string;   // How WealthBridge is different
  regulatoryReq?: string;   // Regulatory requirement if applicable
}

export const PARITY_CAPABILITIES: ParityCapability[] = [
  // ═══ PLANNING ═══
  {
    id: 'plan-001', category: 'Planning', capability: 'Client Profile & Risk Assessment',
    description: 'Comprehensive client profile with risk tolerance, goals, and demographics',
    status: 'live', panel: 'profile', route: '/wealth-engine?panel=profile',
    competitors: ['eMoney', 'MoneyGuidePro', 'RightCapital', 'Orion Planning'],
    differentiator: 'Integrated with practice management cascade — changes propagate to all planning domains',
  },
  {
    id: 'plan-002', category: 'Planning', capability: 'Cash Flow Analysis',
    description: 'Gross/net income, expense categorization, savings rate, emergency fund analysis',
    status: 'live', panel: 'cash', route: '/wealth-engine?panel=cash',
    competitors: ['eMoney', 'MoneyGuidePro', 'RightCapital'],
    differentiator: 'Real-time cascade to protection, growth, retirement, and tax panels',
  },
  {
    id: 'plan-003', category: 'Planning', capability: 'Retirement Planning',
    description: 'Social Security optimization, replacement rate, gap analysis, Monte Carlo',
    status: 'live', panel: 'retire', route: '/wealth-engine?panel=retire',
    competitors: ['eMoney', 'MoneyGuidePro', 'RightCapital', 'Orion Planning'],
    differentiator: 'Integrated Monte Carlo with stock comp, premium financing, and estate planning',
  },
  {
    id: 'plan-004', category: 'Planning', capability: 'Tax Planning & Projection',
    description: 'Federal/state brackets, Roth conversion, charitable strategies, tax-loss harvesting',
    status: 'live', panel: 'tax', route: '/wealth-engine?panel=tax',
    competitors: ['eMoney', 'Holistiplan', 'BNA Income Tax Planner'],
    differentiator: 'Cascades to estate planning and growth projections in real-time',
  },
  {
    id: 'plan-005', category: 'Planning', capability: 'Estate Planning',
    description: 'Taxable estate, exemption utilization, gifting, trust strategies',
    status: 'live', panel: 'estate', route: '/wealth-engine?panel=estate',
    competitors: ['eMoney', 'WealthCounsel', 'Vanilla'],
    differentiator: 'Integrated ILIT, trust engineering, and charitable planning panels',
  },
  {
    id: 'plan-006', category: 'Planning', capability: 'Education Funding',
    description: '529 projections, cost inflation, gap analysis, monthly contribution needed',
    status: 'live', panel: 'edu', route: '/wealth-engine?panel=edu',
    competitors: ['eMoney', 'MoneyGuidePro', 'RightCapital'],
    differentiator: 'Linked to cash flow and tax planning for holistic impact analysis',
  },
  {
    id: 'plan-007', category: 'Planning', capability: 'Planning Hierarchy',
    description: 'Multi-level planning tree with roll-up aggregation and ancestor traversal',
    status: 'live', panel: 'planning-hierarchy', route: '/wealth-engine?panel=planning-hierarchy',
    competitors: ['None — unique to WealthBridge'],
    differentiator: 'Hierarchical planning with cascade propagation — no competitor offers this',
  },
  {
    id: 'plan-008', category: 'Planning', capability: 'Unified Client Plan',
    description: 'Forward/backward planning with practice-to-client income roll-up across 15+ domains',
    status: 'live', panel: 'planning-hierarchy', route: '/wealth-engine?panel=planning-hierarchy',
    competitors: ['eMoney (partial)', 'MoneyGuidePro (partial)'],
    differentiator: 'Bidirectional planning with 15 client + 12 advanced domains, practice income integration',
  },
  {
    id: 'plan-009', category: 'Planning', capability: 'Personal Financial Review (PFR)',
    description: 'Full PFR lifecycle: create, review, approve, export, PDF generation',
    status: 'live', route: '/pfr',
    competitors: ['eMoney', 'MoneyGuidePro'],
    differentiator: 'AI-generated sections with compliance review, WORM audit trail',
    regulatoryReq: 'FINRA Rule 2111 (Suitability), Reg BI',
  },
  {
    id: 'plan-010', category: 'Planning', capability: 'Annual Review',
    description: 'Structured annual review with goals progress, life changes, beneficiary review',
    status: 'live', route: '/annual-review',
    competitors: ['eMoney', 'Orion Planning'],
    differentiator: 'AI-assisted generation with compliance documentation',
  },

  // ═══ PROTECTION ═══
  {
    id: 'prot-001', category: 'Protection', capability: 'Life Insurance Needs Analysis',
    description: 'Income replacement, DIME method, existing coverage gap',
    status: 'live', panel: 'protect', route: '/wealth-engine?panel=protect',
    competitors: ['eMoney', 'Ensight', 'ForceManager'],
    differentiator: 'Integrated with DI, LTC, and premium financing in single cascade',
  },
  {
    id: 'prot-002', category: 'Protection', capability: 'Premium Financing',
    description: 'Loan-to-premium ratio, collateral analysis, arbitrage modeling',
    status: 'live', panel: 'premfin', route: '/wealth-engine?panel=premfin',
    competitors: ['Ensight (limited)', 'Carrier-specific tools'],
    differentiator: 'Cross-referenced with estate planning and growth projections',
  },
  {
    id: 'prot-003', category: 'Protection', capability: 'ILIT / Trust Structuring',
    description: 'Irrevocable life insurance trust modeling with estate tax impact',
    status: 'live', panel: 'trusteng', route: '/wealth-engine?panel=trusteng&tab=ilit',
    competitors: ['WealthCounsel', 'Vanilla'],
    differentiator: 'Integrated with estate panel and premium financing',
  },

  // ═══ GROWTH ═══
  {
    id: 'grow-001', category: 'Growth', capability: 'Investment Growth Projections',
    description: 'Taxable, IUL, FIA projections with tax-adjusted returns',
    status: 'live', panel: 'grow', route: '/wealth-engine?panel=grow',
    competitors: ['eMoney', 'MoneyGuidePro', 'Orion Planning'],
    differentiator: 'Side-by-side comparison of taxable vs tax-advantaged strategies',
  },
  {
    id: 'grow-002', category: 'Growth', capability: 'Monte Carlo Simulation',
    description: 'Probability-weighted outcome analysis with confidence intervals',
    status: 'live', panel: 'montecarlo', route: '/wealth-engine?panel=montecarlo',
    competitors: ['eMoney', 'MoneyGuidePro', 'RightCapital'],
    differentiator: 'Integrated with all planning domains — not standalone',
  },
  {
    id: 'grow-003', category: 'Growth', capability: 'Stock-Based Compensation',
    description: 'RSU, ISO, NQSO, ESPP modeling with tax optimization',
    status: 'live', panel: 'stockcomp', route: '/wealth-engine?panel=stockcomp',
    competitors: ['Carta', 'Shareworks', 'EquityBee'],
    differentiator: 'Integrated with tax planning and estate planning cascade',
  },

  // ═══ PRACTICE MANAGEMENT ═══
  {
    id: 'pm-001', category: 'Practice Management', capability: 'GDC Brackets & Production',
    description: 'Grid payout brackets with production tracking and optimization',
    status: 'live', panel: 'gdcbrackets', route: '/wealth-engine?panel=gdcbrackets',
    competitors: ['SmartOffice', 'Salesforce Financial Services Cloud'],
    differentiator: 'Cascades to P&L, income streams, and client planning',
  },
  {
    id: 'pm-002', category: 'Practice Management', capability: 'Sales Funnel & Pipeline',
    description: 'Multi-stage funnel with conversion tracking and revenue attribution',
    status: 'live', panel: 'salesfunnel', route: '/wealth-engine?panel=salesfunnel',
    competitors: ['Salesforce', 'Redtail', 'Wealthbox'],
    differentiator: 'Integrated with recruiting, channels, and P&L in unified engine',
  },
  {
    id: 'pm-003', category: 'Practice Management', capability: 'AUM Pipeline & Override',
    description: 'AUM growth tracking with override cascade calculations',
    status: 'live', panel: 'aumoverride', route: '/wealth-engine?panel=aumoverride',
    competitors: ['Orion', 'Black Diamond', 'Tamarac'],
    differentiator: 'Unified with GDC, channels, and practice P&L',
  },
  {
    id: 'pm-004', category: 'Practice Management', capability: 'Firm Comparison',
    description: '5 firm categories with 8 cost + 6 benefit dimensions, ROI analysis',
    status: 'live', panel: 'firm-comparison', route: '/wealth-engine?panel=firm-comparison',
    competitors: ['None — unique to WealthBridge'],
    differentiator: 'Quantified comparison across RIA, wirehouse, IBD, insurance, hybrid models',
  },

  // ═══ COMPLIANCE ═══
  {
    id: 'comp-001', category: 'Compliance', capability: 'FINRA/SEC Compliance Review',
    description: 'Automated compliance review with FINRA 2210, Reg BI, SEC rules',
    status: 'live', route: '/compliance',
    competitors: ['Smarsh', 'Global Relay', 'NICE Actimize'],
    differentiator: 'LLM-powered contextual review integrated into all content workflows',
    regulatoryReq: 'FINRA 2210, SEC Rule 206(4)-1, Reg BI',
  },
  {
    id: 'comp-002', category: 'Compliance', capability: 'WORM Audit Trail',
    description: 'Hash-chained immutable audit log with tamper detection',
    status: 'live',
    competitors: ['Smarsh', 'Global Relay'],
    differentiator: 'Built-in to every calculator interaction, not just communications',
    regulatoryReq: 'SEC Rule 17a-4, FINRA Rule 4511',
  },
  {
    id: 'comp-003', category: 'Compliance', capability: 'Suitability Documentation',
    description: 'Automated suitability documentation with risk tolerance alignment',
    status: 'live', route: '/pfr',
    competitors: ['eMoney', 'Orion Planning'],
    differentiator: 'AI-assisted with compliance review before client delivery',
    regulatoryReq: 'FINRA Rule 2111, Reg BI Best Interest',
  },

  // ═══ DATA ═══
  {
    id: 'data-001', category: 'Data', capability: 'Financial Data Hub',
    description: '12 data adapters: FRED, BLS, BEA, Census, EDGAR, GLEIF, FMP, OpenFIGI, Plaid, Polygon, Tiingo, Treasury',
    status: 'live', panel: 'financial-data-hub', route: '/wealth-engine?panel=financial-data-hub',
    competitors: ['Bloomberg Terminal', 'Refinitiv', 'FactSet'],
    differentiator: 'Integrated into planning engine — data feeds directly into calculations',
  },
  {
    id: 'data-002', category: 'Data', capability: 'Macro Economic Dashboard',
    description: 'Real-time macro indicators from FRED, BLS, BEA, Treasury',
    status: 'live', route: '/macro-dashboard',
    competitors: ['Bloomberg', 'Trading Economics'],
    differentiator: 'Contextualized for financial planning — not just raw data',
  },

  // ═══ AI ═══
  {
    id: 'ai-001', category: 'AI', capability: 'AI Chat Assistant',
    description: 'Multi-modal AI assistant with financial expertise and document analysis',
    status: 'live', route: '/chat',
    competitors: ['Copilot for Finance', 'Wealthbox AI'],
    differentiator: 'Adjustable focus (general/financial/both), document analysis, visual generation',
  },
  {
    id: 'ai-002', category: 'AI', capability: 'CalcNarrator',
    description: 'AI-powered narrative explanation of calculator results and recommendations',
    status: 'live', panel: 'summary',
    competitors: ['None — unique to WealthBridge'],
    differentiator: 'Real-time narrative generation from live calculator data',
  },
  {
    id: 'ai-003', category: 'AI', capability: 'Strategy Archetypes',
    description: '10 archetypes with leader personas (Simons, Buffett, Lynch, etc.) and client matching',
    status: 'live', panel: 'strategy-archetypes', route: '/wealth-engine?panel=strategy-archetypes',
    competitors: ['None — unique to WealthBridge'],
    differentiator: 'AI-powered client-to-archetype matching with strategy recommendations',
  },

  // ═══ CLIENT EXPERIENCE ═══
  {
    id: 'cx-001', category: 'Client Experience', capability: 'Client Portal',
    description: 'Client-facing portal with document sharing, messaging, and progress tracking',
    status: 'live', route: '/client-portal',
    competitors: ['eMoney', 'Orion Portal', 'Black Diamond'],
    differentiator: 'Integrated with all planning workflows — not a separate system',
  },
  {
    id: 'cx-002', category: 'Client Experience', capability: 'Engagement Letters',
    description: 'Bulk engagement letter generation with compliance review',
    status: 'live', panel: 'cascade-alerts',
    competitors: ['PreciseFP', 'Nitrogen'],
    differentiator: 'AI-generated with cascade alert triggers and compliance review',
  },

  // ═══ INTEGRATION ═══
  {
    id: 'int-001', category: 'Integration', capability: 'Integration Blueprints',
    description: 'Configurable data pipelines with 12+ source adapters',
    status: 'live', route: '/admin/integrations',
    competitors: ['Zapier', 'Make', 'Orion Connect'],
    differentiator: 'Financial-services-specific with compliance-aware data handling',
  },
  {
    id: 'int-002', category: 'Integration', capability: 'Plaid Account Aggregation',
    description: 'Bank and investment account aggregation via Plaid',
    status: 'live',
    competitors: ['eMoney', 'Orion', 'RightCapital'],
    differentiator: 'Feeds directly into Wealth Engine calculations',
  },

  // ═══ REPORTING ═══
  {
    id: 'rep-001', category: 'Reporting', capability: 'PDF Report Generation',
    description: 'Professional PDF reports for PFR, annual review, and planning summaries',
    status: 'live', route: '/pfr',
    competitors: ['eMoney', 'MoneyGuidePro', 'Orion Reporting'],
    differentiator: 'AI-generated content with compliance review and WORM audit',
  },
  {
    id: 'rep-002', category: 'Reporting', capability: 'Cost Transparency',
    description: 'All-in cost-of-ownership analysis across 6 fee layers with scenario comparison',
    status: 'live', panel: 'costben',
    competitors: ['Riskalyze', 'Nitrogen'],
    differentiator: 'Integrated with firm comparison and practice P&L',
  },
];

/* ─── Summary Statistics ─── */
export function getParitySummary() {
  const total = PARITY_CAPABILITIES.length;
  const live = PARITY_CAPABILITIES.filter(c => c.status === 'live').length;
  const beta = PARITY_CAPABILITIES.filter(c => c.status === 'beta').length;
  const planned = PARITY_CAPABILITIES.filter(c => c.status === 'planned').length;
  const categories = [...new Set(PARITY_CAPABILITIES.map(c => c.category))];
  const uniqueCompetitors = [...new Set(PARITY_CAPABILITIES.flatMap(c => c.competitors))].filter(c => c !== 'None — unique to WealthBridge');
  const uniqueCapabilities = PARITY_CAPABILITIES.filter(c => c.competitors.some(comp => comp.includes('unique'))).length;

  return {
    total,
    live,
    beta,
    planned,
    notStarted: total - live - beta - planned,
    livePercent: Math.round((live / total) * 100),
    categories,
    categoryCount: categories.length,
    uniqueCompetitors,
    competitorCount: uniqueCompetitors.length,
    uniqueCapabilities,
    regulatoryCapabilities: PARITY_CAPABILITIES.filter(c => c.regulatoryReq).length,
  };
}

/* ─── Jurisdictional Compliance Mapping ─── */
export const JURISDICTIONAL_COMPLIANCE = {
  federal: {
    label: 'Federal',
    regulations: [
      { code: 'FINRA 2210', description: 'Communications with the Public', status: 'compliant' as const },
      { code: 'FINRA 2111', description: 'Suitability', status: 'compliant' as const },
      { code: 'FINRA 4511', description: 'General Requirements for Books and Records', status: 'compliant' as const },
      { code: 'SEC 17a-4', description: 'Records to be Preserved (WORM)', status: 'compliant' as const },
      { code: 'SEC 206(4)-1', description: 'Investment Adviser Marketing Rule', status: 'compliant' as const },
      { code: 'Reg BI', description: 'Regulation Best Interest', status: 'compliant' as const },
      { code: 'ERISA', description: 'Employee Retirement Income Security Act', status: 'compliant' as const },
      { code: 'GLBA', description: 'Gramm-Leach-Bliley Act (Privacy)', status: 'compliant' as const },
      { code: 'TCPA', description: 'Telephone Consumer Protection Act', status: 'compliant' as const },
      { code: 'CAN-SPAM', description: 'Controlling the Assault of Non-Solicited Pornography And Marketing', status: 'compliant' as const },
    ],
  },
  state: {
    label: 'State-Level',
    regulations: [
      { code: 'CCPA/CPRA', description: 'California Consumer Privacy Act / California Privacy Rights Act', status: 'compliant' as const },
      { code: 'NYDFS 500', description: 'New York Department of Financial Services Cybersecurity', status: 'compliant' as const },
      { code: 'State Insurance', description: 'State insurance licensing and product approval requirements', status: 'compliant' as const },
      { code: 'State Securities', description: 'Blue Sky Laws — state securities registration', status: 'compliant' as const },
    ],
  },
  international: {
    label: 'International (Awareness)',
    regulations: [
      { code: 'GDPR', description: 'General Data Protection Regulation (EU)', status: 'aware' as const },
      { code: 'MiFID II', description: 'Markets in Financial Instruments Directive (EU)', status: 'aware' as const },
      { code: 'PIPEDA', description: 'Personal Information Protection (Canada)', status: 'aware' as const },
    ],
  },
} as const;
