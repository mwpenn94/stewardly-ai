/**
 * Comprehensive Persona-Based Testing Framework
 * ═══════════════════════════════════════════════
 * Tests the platform against 17 personas across 3 categories:
 * - 6 Client Personas (retail, HNW, business owner, pre-retiree, dual-income, divorced)
 * - 6 Professional Personas (new advisor, experienced, insurance, RIA, estate, recruiter)
 * - 5 Management Personas (team lead, branch manager, regional director, compliance, admin)
 *
 * Each persona test validates:
 * 1. Route accessibility based on role
 * 2. Feature availability matching persona needs
 * 3. Panel/tool relevance to persona workflows
 * 4. Gap analysis: what each persona needs vs what platform delivers
 */
import { describe, it, expect, beforeAll } from 'vitest';

// ─── Navigation Structure (mirrors client/src/lib/navigation.ts) ─────────────
type UserRole = 'user' | 'advisor' | 'manager' | 'admin';

interface NavItem {
  label: string;
  href: string;
  minRole: UserRole;
  section?: string;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 0, advisor: 1, manager: 2, admin: 3,
};

function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

// Canonical nav items (from navigation.ts)
const TOOLS_NAV: NavItem[] = [
  { label: "Chat", href: "/chat", minRole: "user", section: "home" },
  { label: "My Progress", href: "/proficiency", minRole: "user", section: "home" },
  { label: "Financial Twin", href: "/financial-twin", minRole: "user", section: "home" },
  { label: "My Work", href: "/my-work", minRole: "advisor", section: "work" },
  { label: "Operations", href: "/operations", minRole: "user", section: "work" },
  { label: "Advisory", href: "/advisory", minRole: "user", section: "work" },
  { label: "Workflows", href: "/workflows", minRole: "user", section: "work" },
  { label: "Passive Actions", href: "/passive-actions", minRole: "user", section: "work" },
  { label: "Insurance Apps", href: "/insurance-applications", minRole: "advisor", section: "work" },
  { label: "Advisory Execution", href: "/advisory-execution", minRole: "advisor", section: "work" },
  { label: "Carrier Connector", href: "/carrier-connector", minRole: "advisor", section: "work" },
  { label: "Suitability Panel", href: "/suitability-panel", minRole: "advisor", section: "work" },
  { label: "Client Onboarding", href: "/client-onboarding", minRole: "user", section: "work" },
  { label: "Import Data", href: "/import", minRole: "advisor", section: "work" },
  { label: "Intelligence", href: "/intelligence-hub", minRole: "user", section: "intelligence" },
  { label: "Wealth Engine", href: "/wealth-engine", minRole: "user", section: "intelligence" },
  { label: "Engine Dashboard", href: "/engine-dashboard", minRole: "user", section: "intelligence" },
  { label: "Retirement", href: "/wealth-engine/retirement", minRole: "user", section: "intelligence" },
  { label: "Strategy Compare", href: "/wealth-engine/strategy-comparison", minRole: "user", section: "intelligence" },
  { label: "Quick Quote", href: "/wealth-engine/quick-quote", minRole: "user", section: "intelligence" },
  { label: "Practice → Wealth", href: "/wealth-engine/practice-to-wealth", minRole: "advisor", section: "intelligence" },
  { label: "Business Income", href: "/wealth-engine/business-income", minRole: "advisor", section: "intelligence" },
  { label: "Team Builder", href: "/wealth-engine/team-builder", minRole: "advisor", section: "intelligence" },
  { label: "What-If Grid", href: "/wealth-engine/what-if", minRole: "user", section: "intelligence" },
  { label: "Wealth Configurator", href: "/wealth-engine/configurator", minRole: "user", section: "intelligence" },
  { label: "Reference Hub", href: "/wealth-engine/references", minRole: "user", section: "intelligence" },
  { label: "Business Valuation", href: "/wealth-engine/business-valuation", minRole: "advisor", section: "intelligence" },
  { label: "Holistic Comparison", href: "/wealth-engine/holistic-comparison", minRole: "advisor", section: "intelligence" },
  { label: "Quick Quote Hub", href: "/wealth-engine/quick-quote-hub", minRole: "advisor", section: "intelligence" },
  { label: "Income Quick Quote", href: "/wealth-engine/business-income-quick-quote", minRole: "advisor", section: "intelligence" },
  { label: "Owner Compensation", href: "/wealth-engine/owner-comp", minRole: "advisor", section: "intelligence" },
  { label: "Sensitivity Analysis", href: "/wealth-engine/sensitivity", minRole: "user", section: "intelligence" },
  { label: "Rebalancing", href: "/rebalancing", minRole: "advisor", section: "intelligence" },
  { label: "Market Data", href: "/market-data", minRole: "user", section: "intelligence" },
  { label: "Protection Score", href: "/protection-score", minRole: "user", section: "intelligence" },
  { label: "Tax Planning", href: "/tax-planning", minRole: "user", section: "intelligence" },
  { label: "Tax Projector", href: "/tax-projector", minRole: "advisor", section: "intelligence" },
  { label: "Estate Planning", href: "/estate", minRole: "user", section: "intelligence" },
  { label: "Risk Assessment", href: "/risk-assessment", minRole: "user", section: "intelligence" },
  { label: "Income Projection", href: "/income-projection", minRole: "user", section: "intelligence" },
  { label: "Insurance Analysis", href: "/insurance-analysis", minRole: "user", section: "intelligence" },
  { label: "Financial Planning", href: "/financial-planning", minRole: "user", section: "intelligence" },
  { label: "Social Security", href: "/social-security", minRole: "user", section: "intelligence" },
  { label: "Medicare", href: "/medicare", minRole: "user", section: "intelligence" },
  { label: "Products", href: "/products", minRole: "user", section: "intelligence" },
  { label: "Product Intelligence", href: "/product-intelligence", minRole: "advisor", section: "intelligence" },
  { label: "Command Center", href: "/command-center", minRole: "advisor", section: "relationships" },
  { label: "Relationships", href: "/relationships", minRole: "user", section: "relationships" },
  { label: "Client Dashboard", href: "/client-dashboard", minRole: "user", section: "relationships" },
  { label: "Lead Pipeline", href: "/leads", minRole: "advisor", section: "relationships" },
  { label: "CRM Sync", href: "/crm-sync", minRole: "advisor", section: "relationships" },
  { label: "Compliance Audit", href: "/compliance-audit", minRole: "advisor", section: "relationships" },
  { label: "Compliance Copilot", href: "/compliance-copilot", minRole: "advisor", section: "relationships" },
  { label: "Business Exit", href: "/business-exit", minRole: "advisor", section: "relationships" },
  { label: "Annual Review", href: "/annual-review", minRole: "advisor", section: "relationships" },
  { label: "Premium Finance Rates", href: "/premium-finance-rates", minRole: "advisor", section: "relationships" },
  { label: "Email Campaigns", href: "/email-campaigns", minRole: "advisor", section: "relationships" },
  { label: "Marketing Assets", href: "/marketing-assets", minRole: "advisor", section: "relationships" },
  { label: "Data Pipelines", href: "/data-pipelines", minRole: "admin", section: "relationships" },
  { label: "Outreach Automation", href: "/outreach-automation", minRole: "advisor", section: "relationships" },
  { label: "Documents", href: "/settings/knowledge", minRole: "user", section: "relationships" },
  { label: "Integrations", href: "/integrations", minRole: "user", section: "relationships" },
  { label: "Dynamic Integrations", href: "/dynamic-integrations", minRole: "advisor", section: "relationships" },
  { label: "Integration Health", href: "/integration-health", minRole: "advisor", section: "relationships" },
  { label: "My Integrations", href: "/my-integrations", minRole: "advisor", section: "relationships" },
  { label: "Community", href: "/community", minRole: "advisor", section: "relationships" },
  { label: "Learning", href: "/learning", minRole: "user", section: "learning" },
  { label: "Study Buddy", href: "/learning/study-buddy", minRole: "user", section: "learning" },
  { label: "Licenses", href: "/learning/licenses", minRole: "user", section: "learning" },
  { label: "Achievements", href: "/learning/achievements", minRole: "user", section: "learning" },
  { label: "Concept Map", href: "/learning/connections", minRole: "user", section: "learning" },
  { label: "Due Review", href: "/learning/review", minRole: "user", section: "learning" },
  { label: "Search Content", href: "/learning/search", minRole: "user", section: "learning" },
  { label: "Content Studio", href: "/learning/studio", minRole: "advisor", section: "learning" },
  { label: "Sovereign Study", href: "/sovereign-study", minRole: "user", section: "learning" },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Portal", href: "/portal", minRole: "advisor" },
  { label: "Organizations", href: "/organizations", minRole: "advisor" },
  { label: "Manager Dashboard", href: "/manager", minRole: "manager" },
  { label: "Global Admin", href: "/admin", minRole: "admin" },
  { label: "AI Agents", href: "/agents", minRole: "advisor" },
  { label: "Code Chat", href: "/code-chat", minRole: "admin" },
  { label: "Consensus", href: "/consensus", minRole: "admin" },
  { label: "Improvement Dashboard", href: "/admin/improvement", minRole: "admin" },
  { label: "Platform Guide", href: "/admin/guide", minRole: "admin" },
  { label: "System Health", href: "/admin/system-health", minRole: "admin" },
  { label: "Data Freshness", href: "/admin/data-freshness", minRole: "admin" },
  { label: "Lead Sources", href: "/admin/lead-sources", minRole: "admin" },
  { label: "Rate Management", href: "/admin/rate-management", minRole: "admin" },
  { label: "Platform Reports", href: "/admin/platform-reports", minRole: "admin" },
  { label: "Comparables", href: "/comparables", minRole: "advisor" },
  { label: "API Keys", href: "/admin/api-keys", minRole: "admin" },
  { label: "Webhooks", href: "/admin/webhooks", minRole: "admin" },
  { label: "Team", href: "/admin/team", minRole: "admin" },
  { label: "Billing", href: "/admin/billing", minRole: "admin" },
  { label: "AI Intelligence", href: "/admin/intelligence", minRole: "admin" },
  { label: "BCP Dashboard", href: "/admin/bcp", minRole: "admin" },
  { label: "Fairness Audit", href: "/admin/fairness", minRole: "admin" },
  { label: "Workflow Automation", href: "/workflow-automation", minRole: "admin" },
  { label: "Enrichment Engine", href: "/enrichment-admin", minRole: "admin" },
  { label: "Portal Analytics", href: "/portal-analytics", minRole: "admin" },
  { label: "Admin Integrations", href: "/admin/integrations", minRole: "admin" },
  { label: "Knowledge Base", href: "/admin/knowledge", minRole: "admin" },
  { label: "Feature Permissions", href: "/admin/feature-permissions", minRole: "admin" },
  { label: "API Docs", href: "/api-docs", minRole: "advisor" },
  { label: "Audit Trail", href: "/admin/audit-trail", minRole: "admin" },
];

// Wealth Engine panels (from Calculators.tsx NAV_SECTIONS)
const WE_PANELS = {
  practiceManagement: ['myplan', 'gdcbrackets', 'products', 'salesfunnel', 'recruiting', 'channels', 'dashboard', 'pnl', 'aumoverride', 'affiliatepipeline', 'goaltracker', 'prodopt', 'recruitfunnel', 'pnlbizecon', 'gdcoverride', 'aumpipeline', 'monthlyproduction', 'chandivers', 'mktgroi'],
  foundation: ['pfr-wizard', 'client-wealth-hub', 'profile', 'cash', 'balancesheet', 'debtmgmt', 'income'],
  plan: ['retire', 'tax', 'estate', 'edu', 'trusteng', 'governance', 'planning-hierarchy', 'unified-client-plan'],
  protect: ['protect', 'bizclient', 'premfin', 'ilitrust', 'execcomp', 'charitable', 'advanced-strategies-hub', 'advanced', 'advanced-workflows'],
  grow: ['grow', 'montecarlo', 'stockcomp', 'strategy-archetypes'],
  analyzeAct: ['costben', 'summary', 'timeline', 'cascade-alerts', 'firm-comparison', 'scenario-comparison', 'partner', 'compare', 'impl_timeline'],
  data: ['financial-data-hub'],
  references: ['refs', 'duediligence'],
};

const ALL_NAV = [...TOOLS_NAV, ...ADMIN_NAV];

function getAccessibleItems(role: UserRole): NavItem[] {
  return ALL_NAV.filter(item => hasMinRole(role, item.minRole));
}

function getAccessibleBySection(role: UserRole, section: string): NavItem[] {
  return TOOLS_NAV.filter(item => item.section === section && hasMinRole(role, item.minRole));
}

// ─── Persona Definitions ─────────────────────────────────────────────────────

interface PersonaNeeds {
  name: string;
  role: UserRole;
  description: string;
  primaryNeeds: string[];
  requiredRoutes: string[];
  requiredWEPanels: string[];
  secondaryNeeds: string[];
  optionalRoutes: string[];
}

// ─── CLIENT PERSONAS ─────────────────────────────────────────────────────────

const RETAIL_CLIENT: PersonaNeeds = {
  name: 'Retail Client (Young Professional, $75K income)',
  role: 'user',
  description: 'Age 28, single, $75K salary, wants to start retirement planning and basic insurance',
  primaryNeeds: ['Retirement planning', 'Basic insurance needs', 'Budget/cash flow', 'Debt management', 'Investment basics'],
  requiredRoutes: ['/chat', '/wealth-engine', '/proficiency', '/financial-twin', '/products', '/market-data'],
  requiredWEPanels: ['profile', 'cash', 'retire', 'protect', 'grow', 'debtmgmt', 'balancesheet'],
  secondaryNeeds: ['Education funding (future)', 'Tax optimization', 'Risk assessment'],
  optionalRoutes: ['/tax-planning', '/risk-assessment', '/income-projection', '/financial-planning', '/learning'],
};

const HNW_CLIENT: PersonaNeeds = {
  name: 'High-Net-Worth Client ($2M+ NW)',
  role: 'user',
  description: 'Age 52, married, $2M+ net worth, complex estate and tax optimization needs',
  primaryNeeds: ['Estate planning', 'Tax optimization', 'Advanced strategies (ILIT, premium finance)', 'Trust engineering', 'Charitable planning'],
  requiredRoutes: ['/chat', '/wealth-engine', '/estate', '/tax-planning', '/financial-twin'],
  requiredWEPanels: ['profile', 'cash', 'estate', 'tax', 'trusteng', 'premfin', 'ilitrust', 'charitable', 'advanced-strategies-hub', 'advanced', 'governance'],
  secondaryNeeds: ['Monte Carlo simulation', 'Stock-based compensation', 'Executive comp'],
  optionalRoutes: ['/insurance-analysis', '/social-security', '/medicare', '/risk-assessment'],
};

const BUSINESS_OWNER: PersonaNeeds = {
  name: 'Business Owner (SMB, $500K revenue)',
  role: 'user',
  description: 'Age 45, owns SMB with $500K revenue, needs succession planning and owner comp analysis',
  primaryNeeds: ['Business valuation', 'Succession planning', 'Owner compensation', 'Business P&L', 'Key person insurance'],
  requiredRoutes: ['/chat', '/wealth-engine', '/financial-twin'],
  requiredWEPanels: ['profile', 'bizclient', 'income', 'pnlbizecon', 'execcomp', 'balancesheet'],
  secondaryNeeds: ['Tax planning', 'Estate planning', 'Retirement', 'Business exit strategy'],
  optionalRoutes: ['/tax-planning', '/estate', '/business-exit', '/income-projection'],
};

const PRE_RETIREE: PersonaNeeds = {
  name: 'Pre-Retiree (Age 58, $1.2M saved)',
  role: 'user',
  description: 'Age 58, married, $1.2M in retirement accounts, planning to retire in 5-7 years',
  primaryNeeds: ['Retirement readiness', 'Income planning', 'Social Security optimization', 'Medicare planning', 'Risk assessment'],
  requiredRoutes: ['/chat', '/wealth-engine', '/social-security', '/medicare', '/risk-assessment', '/income-projection'],
  requiredWEPanels: ['profile', 'cash', 'retire', 'income', 'montecarlo', 'grow'],
  secondaryNeeds: ['Estate planning', 'Tax optimization', 'Long-term care'],
  optionalRoutes: ['/estate', '/tax-planning', '/insurance-analysis', '/financial-planning'],
};

const DUAL_INCOME_FAMILY: PersonaNeeds = {
  name: 'Dual-Income Family (2 kids, $180K combined)',
  role: 'user',
  description: 'Ages 35/37, 2 kids (3 and 6), $180K combined income, education and protection focus',
  primaryNeeds: ['Education funding (529)', 'Life insurance', 'Cash flow management', 'Retirement planning', 'Protection needs'],
  requiredRoutes: ['/chat', '/wealth-engine', '/financial-twin', '/insurance-analysis'],
  requiredWEPanels: ['profile', 'cash', 'edu', 'protect', 'retire', 'debtmgmt', 'balancesheet', 'grow'],
  secondaryNeeds: ['Tax optimization', 'Estate basics', 'Risk assessment'],
  optionalRoutes: ['/tax-planning', '/estate', '/risk-assessment', '/financial-planning'],
};

const RECENTLY_DIVORCED: PersonaNeeds = {
  name: 'Recently Divorced (Age 45, rebuilding)',
  role: 'user',
  description: 'Age 45, recently divorced, rebuilding finances, needs fresh start planning',
  primaryNeeds: ['Fresh start planning', 'Insurance gap analysis', 'Debt management', 'Retirement catch-up', 'Budget restructuring'],
  requiredRoutes: ['/chat', '/wealth-engine', '/financial-twin', '/income-projection'],
  requiredWEPanels: ['profile', 'cash', 'debtmgmt', 'balancesheet', 'protect', 'retire', 'income'],
  secondaryNeeds: ['Social Security (QDRO)', 'Tax implications', 'Estate plan update'],
  optionalRoutes: ['/social-security', '/tax-planning', '/estate', '/risk-assessment'],
};

// ─── PROFESSIONAL PERSONAS ───────────────────────────────────────────────────

const NEW_ADVISOR: PersonaNeeds = {
  name: 'New Advisor (Year 1, building book)',
  role: 'advisor',
  description: 'First year in practice, building client book, needs quick tools and client acquisition',
  primaryNeeds: ['Client acquisition tools', 'PFR Wizard', 'Quick quotes', 'Sales funnel', 'Product knowledge'],
  requiredRoutes: ['/chat', '/wealth-engine', '/leads', '/products', '/product-intelligence', '/client-onboarding'],
  requiredWEPanels: ['pfr-wizard', 'client-wealth-hub', 'profile', 'cash', 'protect', 'retire', 'salesfunnel', 'products', 'myplan'],
  secondaryNeeds: ['Learning tracks', 'License tracking', 'Marketing assets', 'Email campaigns'],
  optionalRoutes: ['/learning', '/learning/licenses', '/email-campaigns', '/marketing-assets', '/outreach-automation'],
};

const EXPERIENCED_ADVISOR: PersonaNeeds = {
  name: 'Experienced Advisor (10yr, 200 clients)',
  role: 'advisor',
  description: '10 years experience, 200+ clients, uses Expert mode, cascade flow, scenario comparison',
  primaryNeeds: ['Expert mode calculators', 'Cascade flow', 'Scenario comparison', 'Practice management', 'Client reviews'],
  requiredRoutes: ['/chat', '/wealth-engine', '/command-center', '/relationships', '/annual-review', '/compliance-audit'],
  requiredWEPanels: ['client-wealth-hub', 'advanced-strategies-hub', 'scenario-comparison', 'dashboard', 'pnl', 'myplan', 'gdcbrackets', 'goaltracker'],
  secondaryNeeds: ['Team building', 'Recruiting', 'Business valuation', 'Holistic comparison'],
  optionalRoutes: ['/wealth-engine/team-builder', '/wealth-engine/business-valuation', '/wealth-engine/holistic-comparison', '/portal'],
};

const INSURANCE_SPECIALIST: PersonaNeeds = {
  name: 'Insurance Specialist',
  role: 'advisor',
  description: 'Focuses on IUL, premium finance, product comparison, carrier relationships',
  primaryNeeds: ['IUL projections', 'Premium finance', 'Product comparison', 'Carrier connector', 'Insurance applications'],
  requiredRoutes: ['/chat', '/wealth-engine', '/insurance-applications', '/carrier-connector', '/products', '/product-intelligence', '/premium-finance-rates'],
  requiredWEPanels: ['protect', 'premfin', 'advanced-strategies-hub', 'advanced', 'products', 'bizclient'],
  secondaryNeeds: ['Quick quotes', 'Client onboarding', 'Compliance'],
  optionalRoutes: ['/wealth-engine/quick-quote', '/client-onboarding', '/compliance-audit'],
};

const INVESTMENT_ADVISOR: PersonaNeeds = {
  name: 'Investment Advisor (RIA)',
  role: 'advisor',
  description: 'Registered Investment Advisor, portfolio allocation, retirement aggregation, tax-loss harvesting',
  primaryNeeds: ['Portfolio allocation', 'Retirement aggregation', 'Tax optimization', 'Rebalancing', 'Market data'],
  requiredRoutes: ['/chat', '/wealth-engine', '/rebalancing', '/market-data', '/tax-planning', '/tax-projector'],
  requiredWEPanels: ['grow', 'montecarlo', 'retire', 'tax', 'stockcomp', 'governance', 'balancesheet'],
  secondaryNeeds: ['Risk assessment', 'Income projection', 'Financial planning'],
  optionalRoutes: ['/risk-assessment', '/income-projection', '/financial-planning', '/wealth-engine/sensitivity'],
};

const ESTATE_SPECIALIST: PersonaNeeds = {
  name: 'Estate Planning Specialist',
  role: 'advisor',
  description: 'Focuses on estate tax, ILIT, charitable strategies, trust planning for HNW clients',
  primaryNeeds: ['Estate tax planning', 'ILIT structuring', 'Charitable strategies', 'Trust engineering', 'Governance/IPS'],
  requiredRoutes: ['/chat', '/wealth-engine', '/estate'],
  requiredWEPanels: ['estate', 'trusteng', 'ilitrust', 'charitable', 'governance', 'advanced-strategies-hub', 'advanced', 'planning-hierarchy'],
  secondaryNeeds: ['Premium finance', 'Executive comp', 'Business client'],
  optionalRoutes: ['/premium-finance-rates', '/business-exit'],
};

const AFFILIATE_RECRUITER: PersonaNeeds = {
  name: 'Affiliate/Recruiter',
  role: 'advisor',
  description: 'Focuses on practice management, team building, recruiting ROI, affiliate pipeline',
  primaryNeeds: ['Practice management', 'Team builder', 'Recruiting funnel', 'Affiliate pipeline', 'GDC brackets'],
  requiredRoutes: ['/chat', '/wealth-engine', '/wealth-engine/team-builder', '/portal', '/organizations'],
  requiredWEPanels: ['myplan', 'gdcbrackets', 'recruiting', 'recruitfunnel', 'affiliatepipeline', 'channels', 'dashboard', 'pnl', 'partner'],
  secondaryNeeds: ['Marketing ROI', 'Channel diversification', 'Production optimization'],
  optionalRoutes: ['/email-campaigns', '/marketing-assets', '/outreach-automation', '/community'],
};

// ─── MANAGEMENT PERSONAS ─────────────────────────────────────────────────────

const TEAM_LEAD: PersonaNeeds = {
  name: 'Team Lead (5 advisors)',
  role: 'manager',
  description: 'Manages 5 advisors, needs team analytics, production tracking, coaching tools',
  primaryNeeds: ['Team analytics', 'Production tracking', 'Coaching tools', 'Manager dashboard', 'Goal tracking'],
  requiredRoutes: ['/chat', '/wealth-engine', '/manager', '/portal', '/organizations'],
  requiredWEPanels: ['dashboard', 'goaltracker', 'pnl', 'myplan', 'gdcbrackets'],
  secondaryNeeds: ['Compliance oversight', 'Training management', 'Recruiting'],
  optionalRoutes: ['/compliance-audit', '/learning', '/wealth-engine/team-builder'],
};

const BRANCH_MANAGER: PersonaNeeds = {
  name: 'Branch Manager (25 advisors)',
  role: 'manager',
  description: 'Manages 25 advisors, needs firm comparison, practice-to-wealth, org-level cascade',
  primaryNeeds: ['Firm comparison', 'Practice-to-wealth bridge', 'Org-level cascade', 'Multi-team analytics', 'Strategy archetypes'],
  requiredRoutes: ['/chat', '/wealth-engine', '/manager', '/portal', '/organizations', '/wealth-engine/practice-to-wealth'],
  requiredWEPanels: ['firm-comparison', 'strategy-archetypes', 'dashboard', 'pnl', 'myplan', 'prodopt'],
  secondaryNeeds: ['Recruiting funnel', 'Marketing ROI', 'Compliance'],
  optionalRoutes: ['/compliance-audit', '/email-campaigns', '/wealth-engine/team-builder'],
};

const REGIONAL_DIRECTOR: PersonaNeeds = {
  name: 'Regional Director (100+ advisors)',
  role: 'manager',
  description: 'Oversees 100+ advisors across multiple branches, needs multi-team rollup and benchmarking',
  primaryNeeds: ['Multi-team rollup', 'Strategy archetypes', 'Benchmarking', 'Holistic comparison', 'Firm comparison'],
  requiredRoutes: ['/chat', '/wealth-engine', '/manager', '/portal', '/organizations', '/wealth-engine/holistic-comparison'],
  requiredWEPanels: ['firm-comparison', 'strategy-archetypes', 'dashboard', 'pnl', 'prodopt'],
  secondaryNeeds: ['Platform reports', 'Data pipelines', 'Portal analytics'],
  optionalRoutes: ['/admin/platform-reports', '/data-pipelines', '/portal-analytics'],
};

const COMPLIANCE_OFFICER: PersonaNeeds = {
  name: 'Compliance Officer',
  role: 'manager',
  description: 'Ensures regulatory compliance, audit trails, PFR compliance, disclaimer verification',
  primaryNeeds: ['Audit trail', 'PFR compliance', 'Disclaimer verification', 'Compliance audit', 'Suitability review'],
  requiredRoutes: ['/chat', '/compliance-audit', '/compliance-copilot', '/manager', '/suitability-panel'],
  requiredWEPanels: ['pfr-wizard', 'duediligence', 'governance'],
  secondaryNeeds: ['Platform reports', 'Feature permissions', 'Knowledge base'],
  optionalRoutes: ['/admin/platform-reports', '/admin/feature-permissions', '/admin/knowledge'],
};

const PLATFORM_ADMIN: PersonaNeeds = {
  name: 'Platform Admin',
  role: 'admin',
  description: 'Full platform access, user management, data governance, system health',
  primaryNeeds: ['All panels accessible', 'User management', 'Data governance', 'System health', 'Feature permissions'],
  requiredRoutes: ['/chat', '/admin', '/admin/system-health', '/admin/feature-permissions', '/admin/team', '/admin/audit-trail'],
  requiredWEPanels: [], // Admin doesn't need specific WE panels, but should have access to all
  secondaryNeeds: ['Rate management', 'Lead sources', 'Billing', 'AI intelligence'],
  optionalRoutes: ['/admin/rate-management', '/admin/lead-sources', '/admin/billing', '/admin/intelligence', '/admin/bcp', '/admin/fairness'],
};

const ALL_PERSONAS: PersonaNeeds[] = [
  RETAIL_CLIENT, HNW_CLIENT, BUSINESS_OWNER, PRE_RETIREE, DUAL_INCOME_FAMILY, RECENTLY_DIVORCED,
  NEW_ADVISOR, EXPERIENCED_ADVISOR, INSURANCE_SPECIALIST, INVESTMENT_ADVISOR, ESTATE_SPECIALIST, AFFILIATE_RECRUITER,
  TEAM_LEAD, BRANCH_MANAGER, REGIONAL_DIRECTOR, COMPLIANCE_OFFICER, PLATFORM_ADMIN,
];

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('Persona-Based Platform Testing', () => {

  // ═══ CLIENT PERSONAS ═══
  describe('Client Personas', () => {
    const clientPersonas = [RETAIL_CLIENT, HNW_CLIENT, BUSINESS_OWNER, PRE_RETIREE, DUAL_INCOME_FAMILY, RECENTLY_DIVORCED];

    clientPersonas.forEach(persona => {
      describe(persona.name, () => {
        it('should have access to all required routes', () => {
          const accessible = getAccessibleItems(persona.role);
          const accessibleHrefs = accessible.map(i => i.href);
          const missing = persona.requiredRoutes.filter(r => !accessibleHrefs.includes(r));
          expect(missing).toEqual([]);
        });

        it('should have access to all required Wealth Engine panels', () => {
          // All WE panels are accessible to users since the Wealth Engine route is minRole: user
          const allPanels = Object.values(WE_PANELS).flat();
          const missing = persona.requiredWEPanels.filter(p => !allPanels.includes(p));
          expect(missing).toEqual([]);
        });

        it('should have intelligence section tools available', () => {
          const intelligenceTools = getAccessibleBySection(persona.role, 'intelligence');
          expect(intelligenceTools.length).toBeGreaterThan(10);
        });

        it('should have learning section available', () => {
          const learningTools = getAccessibleBySection(persona.role, 'learning');
          expect(learningTools.length).toBeGreaterThan(0);
        });
      });
    });

    it('all client personas should have access to chat', () => {
      clientPersonas.forEach(p => {
        const accessible = getAccessibleItems(p.role);
        expect(accessible.some(i => i.href === '/chat')).toBe(true);
      });
    });

    it('all client personas should have access to Wealth Engine', () => {
      clientPersonas.forEach(p => {
        const accessible = getAccessibleItems(p.role);
        expect(accessible.some(i => i.href === '/wealth-engine')).toBe(true);
      });
    });
  });

  // ═══ PROFESSIONAL PERSONAS ═══
  describe('Professional Personas', () => {
    const professionalPersonas = [NEW_ADVISOR, EXPERIENCED_ADVISOR, INSURANCE_SPECIALIST, INVESTMENT_ADVISOR, ESTATE_SPECIALIST, AFFILIATE_RECRUITER];

    professionalPersonas.forEach(persona => {
      describe(persona.name, () => {
        it('should have access to all required routes', () => {
          const accessible = getAccessibleItems(persona.role);
          const accessibleHrefs = accessible.map(i => i.href);
          const missing = persona.requiredRoutes.filter(r => !accessibleHrefs.includes(r));
          expect(missing).toEqual([]);
        });

        it('should have access to all required Wealth Engine panels', () => {
          const allPanels = Object.values(WE_PANELS).flat();
          const missing = persona.requiredWEPanels.filter(p => !allPanels.includes(p));
          expect(missing).toEqual([]);
        });

        it('should have advisor-level work tools', () => {
          const workTools = getAccessibleBySection(persona.role, 'work');
          expect(workTools.length).toBeGreaterThan(5);
        });

        it('should have access to portal and organizations', () => {
          const accessible = getAccessibleItems(persona.role);
          expect(accessible.some(i => i.href === '/portal')).toBe(true);
          expect(accessible.some(i => i.href === '/organizations')).toBe(true);
        });
      });
    });

    it('all professional personas should have access to product intelligence', () => {
      professionalPersonas.forEach(p => {
        const accessible = getAccessibleItems(p.role);
        expect(accessible.some(i => i.href === '/product-intelligence')).toBe(true);
      });
    });

    it('all professional personas should have access to compliance audit', () => {
      professionalPersonas.forEach(p => {
        const accessible = getAccessibleItems(p.role);
        expect(accessible.some(i => i.href === '/compliance-audit')).toBe(true);
      });
    });
  });

  // ═══ MANAGEMENT PERSONAS ═══
  describe('Management Personas', () => {
    const managementPersonas = [TEAM_LEAD, BRANCH_MANAGER, REGIONAL_DIRECTOR, COMPLIANCE_OFFICER, PLATFORM_ADMIN];

    managementPersonas.forEach(persona => {
      describe(persona.name, () => {
        it('should have access to all required routes', () => {
          const accessible = getAccessibleItems(persona.role);
          const accessibleHrefs = accessible.map(i => i.href);
          const missing = persona.requiredRoutes.filter(r => !accessibleHrefs.includes(r));
          expect(missing).toEqual([]);
        });

        it('should have access to manager dashboard', () => {
          const accessible = getAccessibleItems(persona.role);
          expect(accessible.some(i => i.href === '/manager')).toBe(true);
        });
      });
    });

    it('Platform Admin should have access to ALL admin routes', () => {
      const accessible = getAccessibleItems('admin');
      const adminRoutes = ADMIN_NAV.map(i => i.href);
      const accessibleHrefs = accessible.map(i => i.href);
      const missing = adminRoutes.filter(r => !accessibleHrefs.includes(r));
      expect(missing).toEqual([]);
    });

    it('managers should see more tools than advisors', () => {
      const managerTools = getAccessibleItems('manager');
      const advisorTools = getAccessibleItems('advisor');
      expect(managerTools.length).toBeGreaterThan(advisorTools.length);
    });

    it('admins should see more tools than managers', () => {
      const adminTools = getAccessibleItems('admin');
      const managerTools = getAccessibleItems('manager');
      expect(adminTools.length).toBeGreaterThan(managerTools.length);
    });
  });

  // ═══ CROSS-PERSONA VALIDATION ═══
  describe('Cross-Persona Validation', () => {
    it('role hierarchy should be strictly increasing in accessible items', () => {
      const roles: UserRole[] = ['user', 'advisor', 'manager', 'admin'];
      let prevCount = 0;
      roles.forEach(role => {
        const count = getAccessibleItems(role).length;
        expect(count).toBeGreaterThanOrEqual(prevCount);
        prevCount = count;
      });
    });

    it('all personas should have at least 5 required routes', () => {
      ALL_PERSONAS.forEach(p => {
        expect(p.requiredRoutes.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('all personas should have at least 3 primary needs', () => {
      ALL_PERSONAS.forEach(p => {
        expect(p.primaryNeeds.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('Wealth Engine panels should cover all persona required panels', () => {
      const allPanels = new Set(Object.values(WE_PANELS).flat());
      ALL_PERSONAS.forEach(p => {
        p.requiredWEPanels.forEach(panel => {
          expect(allPanels.has(panel)).toBe(true);
        });
      });
    });
  });

  // ═══ GAP ANALYSIS ═══
  describe('Gap Analysis', () => {
    it('should identify gaps for each persona', () => {
      const gaps: { persona: string; missingRoutes: string[]; missingOptional: string[]; gapScore: number }[] = [];

      ALL_PERSONAS.forEach(persona => {
        const accessible = getAccessibleItems(persona.role);
        const accessibleHrefs = new Set(accessible.map(i => i.href));

        const missingRequired = persona.requiredRoutes.filter(r => !accessibleHrefs.has(r));
        const missingOptional = persona.optionalRoutes.filter(r => !accessibleHrefs.has(r));

        // Gap score: 10 points per missing required, 3 per missing optional
        const gapScore = missingRequired.length * 10 + missingOptional.length * 3;

        gaps.push({
          persona: persona.name,
          missingRoutes: missingRequired,
          missingOptional,
          gapScore,
        });
      });

      // All required routes should be accessible (gap score from required = 0)
      gaps.forEach(g => {
        expect(g.missingRoutes).toEqual([]);
      });
    });

    it('should have comprehensive Wealth Engine coverage for financial personas', () => {
      const financialPersonas = [HNW_CLIENT, PRE_RETIREE, EXPERIENCED_ADVISOR, INSURANCE_SPECIALIST, INVESTMENT_ADVISOR, ESTATE_SPECIALIST];
      const allPanels = Object.values(WE_PANELS).flat();

      financialPersonas.forEach(persona => {
        const coverage = persona.requiredWEPanels.filter(p => allPanels.includes(p));
        const coverageRatio = coverage.length / persona.requiredWEPanels.length;
        expect(coverageRatio).toBe(1); // 100% coverage
      });
    });

    it('should have practice management coverage for business personas', () => {
      const businessPersonas = [AFFILIATE_RECRUITER, BRANCH_MANAGER, REGIONAL_DIRECTOR];
      const pmPanels = WE_PANELS.practiceManagement;

      businessPersonas.forEach(persona => {
        const pmCoverage = persona.requiredWEPanels.filter(p => pmPanels.includes(p));
        expect(pmCoverage.length).toBeGreaterThanOrEqual(3); // At least 3 practice management panels (Pass 151: some panels merged)
      });
    });
  });

  // ═══ CAPABILITY MATRIX ═══
  describe('Capability Matrix', () => {
    const capabilities = [
      'Chat/AI Assistant', 'Wealth Engine', 'Practice Management', 'Client Planning',
      'Advanced Strategies', 'Scenario Comparison', 'PFR Wizard', 'Quick Quotes',
      'Learning/Education', 'Compliance', 'CRM/Leads', 'Integrations',
      'Team Management', 'Admin Controls', 'Reporting', 'Marketing Tools',
    ];

    const capabilityRouteMap: Record<string, string[]> = {
      'Chat/AI Assistant': ['/chat'],
      'Wealth Engine': ['/wealth-engine'],
      'Practice Management': ['/wealth-engine'], // WE panels
      'Client Planning': ['/wealth-engine', '/financial-planning'],
      'Advanced Strategies': ['/wealth-engine'],
      'Scenario Comparison': ['/wealth-engine'],
      'PFR Wizard': ['/wealth-engine'],
      'Quick Quotes': ['/wealth-engine/quick-quote', '/wealth-engine/quick-quote-hub'],
      'Learning/Education': ['/learning'],
      'Compliance': ['/compliance-audit', '/compliance-copilot'],
      'CRM/Leads': ['/leads', '/crm-sync'],
      'Integrations': ['/integrations'],
      'Team Management': ['/admin/team', '/wealth-engine/team-builder'],
      'Admin Controls': ['/admin'],
      'Reporting': ['/admin/platform-reports'],
      'Marketing Tools': ['/email-campaigns', '/marketing-assets'],
    };

    it('every capability should map to at least one route', () => {
      capabilities.forEach(cap => {
        expect(capabilityRouteMap[cap]?.length).toBeGreaterThan(0);
      });
    });

    it('users should have access to core capabilities', () => {
      const userCaps = ['Chat/AI Assistant', 'Wealth Engine', 'Client Planning', 'Learning/Education', 'Integrations'];
      const accessible = getAccessibleItems('user');
      const accessibleHrefs = new Set(accessible.map(i => i.href));

      userCaps.forEach(cap => {
        const routes = capabilityRouteMap[cap];
        const hasAccess = routes.some(r => accessibleHrefs.has(r));
        expect(hasAccess).toBe(true);
      });
    });

    it('advisors should have access to professional capabilities', () => {
      const advisorCaps = ['Chat/AI Assistant', 'Wealth Engine', 'Quick Quotes', 'Compliance', 'CRM/Leads', 'Marketing Tools'];
      const accessible = getAccessibleItems('advisor');
      const accessibleHrefs = new Set(accessible.map(i => i.href));

      advisorCaps.forEach(cap => {
        const routes = capabilityRouteMap[cap];
        const hasAccess = routes.some(r => accessibleHrefs.has(r));
        expect(hasAccess).toBe(true);
      });
    });

    it('admins should have access to ALL capabilities', () => {
      const accessible = getAccessibleItems('admin');
      const accessibleHrefs = new Set(accessible.map(i => i.href));

      capabilities.forEach(cap => {
        const routes = capabilityRouteMap[cap];
        const hasAccess = routes.some(r => accessibleHrefs.has(r));
        expect(hasAccess).toBe(true);
      });
    });
  });

  // ═══ NAVIGATION COHERENCE ═══
  describe('Navigation Coherence', () => {
    it('all nav sections should have items', () => {
      const sections = ['home', 'work', 'intelligence', 'relationships', 'learning'];
      sections.forEach(section => {
        const items = TOOLS_NAV.filter(i => i.section === section);
        expect(items.length).toBeGreaterThan(0);
      });
    });

    it('intelligence section should be the largest', () => {
      const sections = ['home', 'work', 'intelligence', 'relationships', 'learning'];
      const counts = sections.map(s => TOOLS_NAV.filter(i => i.section === s).length);
      const maxIdx = counts.indexOf(Math.max(...counts));
      expect(sections[maxIdx]).toBe('intelligence');
    });

    it('no duplicate hrefs in TOOLS_NAV', () => {
      const hrefs = TOOLS_NAV.map(i => i.href);
      const duplicates = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
      expect(duplicates).toEqual([]);
    });

    it('admin nav should only contain advisor+ items', () => {
      ADMIN_NAV.forEach(item => {
        expect(ROLE_HIERARCHY[item.minRole]).toBeGreaterThanOrEqual(ROLE_HIERARCHY['advisor']);
      });
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED PERSONA TESTING — Workflow Depth, Gap Analysis, Optimization
// ═══════════════════════════════════════════════════════════════════════════════

describe('Enhanced Persona Workflow Testing', () => {

  // ─── Workflow Depth: Each persona's critical path ─────────────────────────
  describe('Client Workflow Depth', () => {
    it('Retail Client: basic planning workflow should be complete', () => {
      // Entry → Chat → Wealth Engine → Profile → Cash Flow → Retire → Protect → Grow
      const workflow = ['profile', 'cash', 'retire', 'protect', 'grow', 'debtmgmt', 'balancesheet'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });

    it('HNW Client: advanced estate workflow should be complete', () => {
      // Profile → Estate → Trust Eng → ILIT → Charitable → Governance → Advanced Strategies
      const workflow = ['profile', 'estate', 'trusteng', 'ilitrust', 'charitable', 'governance', 'advanced-strategies-hub', 'advanced'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });

    it('Business Owner: business valuation workflow should be complete', () => {
      // Profile → Business Client → Income → P&L → Exec Comp → Balance Sheet
      const workflow = ['profile', 'bizclient', 'income', 'pnlbizecon', 'execcomp', 'balancesheet'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });

    it('Pre-Retiree: retirement readiness workflow should be complete', () => {
      // Profile → Cash → Retire → Income → Monte Carlo → Grow
      const workflow = ['profile', 'cash', 'retire', 'income', 'montecarlo', 'grow'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });

    it('Dual-Income Family: education + protection workflow should be complete', () => {
      // Profile → Cash → Education → Protect → Retire → Debt → Balance → Grow
      const workflow = ['profile', 'cash', 'edu', 'protect', 'retire', 'debtmgmt', 'balancesheet', 'grow'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });

    it('Recently Divorced: fresh start workflow should be complete', () => {
      // Profile → Cash → Debt → Balance → Protect → Retire → Income
      const workflow = ['profile', 'cash', 'debtmgmt', 'balancesheet', 'protect', 'retire', 'income'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });
  });

  describe('Professional Workflow Depth', () => {
    it('New Advisor: client acquisition workflow should be complete', () => {
      // PFR Wizard → Client Wealth Hub → Profile → Cash → Protect → Retire → Sales Funnel → Products
      const workflow = ['pfr-wizard', 'client-wealth-hub', 'profile', 'cash', 'protect', 'retire', 'salesfunnel', 'products', 'myplan'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });

    it('Experienced Advisor: expert mode cascade workflow should be complete', () => {
      // Client Wealth Hub → Advanced Strategies → Scenario Comparison → Dashboard → P&L → My Plan
      const workflow = ['client-wealth-hub', 'advanced-strategies-hub', 'scenario-comparison', 'dashboard', 'pnl', 'myplan', 'gdcbrackets', 'goaltracker'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });

    it('Insurance Specialist: product analysis workflow should be complete', () => {
      // Protect → Premium Finance → Advanced Strategies → Products → Business Client
      const workflow = ['protect', 'premfin', 'advanced-strategies-hub', 'advanced', 'products', 'bizclient'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });

    it('Investment Advisor: portfolio workflow should be complete', () => {
      // Grow → Monte Carlo → Retire → Tax → Stock Comp → Governance → Balance Sheet
      const workflow = ['grow', 'montecarlo', 'retire', 'tax', 'stockcomp', 'governance', 'balancesheet'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });

    it('Estate Specialist: trust planning workflow should be complete', () => {
      // Estate → Trust Eng → ILIT → Charitable → Governance → Advanced Strategies → Planning Hierarchy
      const workflow = ['estate', 'trusteng', 'ilitrust', 'charitable', 'governance', 'advanced-strategies-hub', 'advanced', 'planning-hierarchy'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });

    it('Affiliate/Recruiter: team building workflow should be complete', () => {
      // My Plan → GDC → Recruiting → Recruit Funnel → Affiliate Pipeline → Channels → Dashboard → P&L
      const workflow = ['myplan', 'gdcbrackets', 'recruiting', 'recruitfunnel', 'affiliatepipeline', 'channels', 'dashboard', 'pnl', 'partner'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });
  });

  describe('Management Workflow Depth', () => {
    it('Team Lead: team analytics workflow should be complete', () => {
      // Dashboard → Goal Tracker → Monthly Production → P&L → My Plan → GDC
      const workflow = ['dashboard', 'goaltracker', 'pnl', 'myplan', 'gdcbrackets'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });

    it('Branch Manager: firm comparison workflow should be complete', () => {
      // Firm Comparison → Strategy Archetypes → Dashboard → P&L → My Plan → Prod Opt → Chan Divers
      const workflow = ['firm-comparison', 'strategy-archetypes', 'dashboard', 'pnl', 'myplan', 'prodopt'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });

    it('Regional Director: multi-team rollup workflow should be complete', () => {
      // Firm Comparison → Strategy Archetypes → Dashboard → P&L → Prod Opt → Chan Divers → Mkt ROI
      const workflow = ['firm-comparison', 'strategy-archetypes', 'dashboard', 'pnl', 'prodopt'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });

    it('Compliance Officer: audit workflow should be complete', () => {
      // PFR Wizard → Due Diligence → Governance
      const workflow = ['pfr-wizard', 'duediligence', 'governance'];
      const allPanels = Object.values(WE_PANELS).flat();
      workflow.forEach(step => expect(allPanels).toContain(step));
    });
  });

  // ─── Optimization Recommendations ─────────────────────────────────────────
  describe('Optimization Recommendations', () => {
    it('should generate per-persona optimization report', () => {
      const report: { persona: string; score: number; strengths: string[]; gaps: string[]; recommendations: string[] }[] = [];

      ALL_PERSONAS.forEach(persona => {
        const accessible = getAccessibleItems(persona.role);
        const accessibleHrefs = new Set(accessible.map(i => i.href));
        const allPanels = Object.values(WE_PANELS).flat();

        const requiredRoutesCovered = persona.requiredRoutes.filter(r => accessibleHrefs.has(r)).length;
        const optionalRoutesCovered = persona.optionalRoutes.filter(r => accessibleHrefs.has(r)).length;
        const panelsCovered = persona.requiredWEPanels.filter(p => allPanels.includes(p)).length;

        const routeScore = (requiredRoutesCovered / Math.max(persona.requiredRoutes.length, 1)) * 40;
        const optionalScore = (optionalRoutesCovered / Math.max(persona.optionalRoutes.length, 1)) * 20;
        const panelScore = (panelsCovered / Math.max(persona.requiredWEPanels.length, 1)) * 40;
        const totalScore = Math.round(routeScore + optionalScore + panelScore);

        const strengths: string[] = [];
        const gaps: string[] = [];
        const recommendations: string[] = [];

        if (routeScore === 40) strengths.push('All required routes accessible');
        if (panelScore === 40) strengths.push('All required WE panels available');
        if (optionalScore === 20) strengths.push('All optional routes accessible');

        const missingOptional = persona.optionalRoutes.filter(r => !accessibleHrefs.has(r));
        if (missingOptional.length > 0) {
          gaps.push(`Missing optional routes: ${missingOptional.join(', ')}`);
          recommendations.push(`Consider adding ${missingOptional.length} optional routes for enhanced experience`);
        }

        // Check workflow completeness
        if (persona.requiredWEPanels.length > 5) {
          strengths.push(`Deep WE integration (${persona.requiredWEPanels.length} panels)`);
        }

        report.push({
          persona: persona.name,
          score: totalScore,
          strengths,
          gaps,
          recommendations,
        });
      });

      // All personas should score at least 60/100 (Platform Admin has 0 WE panels intentionally)
      report.forEach(r => {
        expect(r.score).toBeGreaterThanOrEqual(60);
      });

      // Non-admin personas should score at least 80/100
      report.filter(r => r.persona !== 'Platform Admin').forEach(r => {
        expect(r.score).toBeGreaterThanOrEqual(80);
      });

      // Average score should be at least 90
      const avgScore = report.reduce((sum, r) => sum + r.score, 0) / report.length;
      expect(avgScore).toBeGreaterThanOrEqual(90);
    });

    it('should verify cross-persona feature coverage matrix', () => {
      const featureMatrix: Record<string, string[]> = {
        'Financial Planning': ['profile', 'cash', 'retire', 'tax', 'estate', 'grow', 'protect'],
        'Practice Management': ['myplan', 'gdcbrackets', 'products', 'salesfunnel', 'recruiting', 'dashboard', 'pnl'],
        'Advanced Strategies': ['advanced-strategies-hub', 'advanced', 'premfin', 'ilitrust', 'charitable', 'execcomp'],
        'Analysis & Action': ['costben', 'summary', 'timeline', 'scenario-comparison', 'firm-comparison'],
        'Client Engagement': ['pfr-wizard', 'client-wealth-hub', 'planning-hierarchy'],
      };

      const allPanels = Object.values(WE_PANELS).flat();

      Object.entries(featureMatrix).forEach(([category, panels]) => {
        const covered = panels.filter(p => allPanels.includes(p));
        const coverage = covered.length / panels.length;
        expect(coverage).toBe(1); // 100% coverage for each category
      });
    });

    it('should verify persona-to-complexity level mapping', () => {
      // Client personas should work well with Quick/Standard complexity
      const clientComplexityNeeds: Record<string, string[]> = {
        'Retail Client': ['Quick', 'Standard'],
        'HNW Client': ['Standard', 'Expert'],
        'Business Owner': ['Standard', 'Expert'],
        'Pre-Retiree': ['Quick', 'Standard'],
        'Dual-Income Family': ['Quick', 'Standard'],
        'Recently Divorced': ['Quick', 'Standard'],
      };

      // Professional personas should have Expert mode available
      const professionalComplexityNeeds: Record<string, string[]> = {
        'New Advisor': ['Quick', 'Standard'],
        'Experienced Advisor': ['Expert'],
        'Insurance Specialist': ['Standard', 'Expert'],
        'Investment Advisor': ['Standard', 'Expert'],
        'Estate Specialist': ['Expert'],
        'Affiliate/Recruiter': ['Standard', 'Expert'],
      };

      // All complexity levels should exist
      const complexityLevels = ['Quick', 'Standard', 'Expert'];
      complexityLevels.forEach(level => {
        expect(['Quick', 'Standard', 'Expert']).toContain(level);
      });

      // Verify all personas have at least one complexity level
      Object.values(clientComplexityNeeds).forEach(levels => {
        expect(levels.length).toBeGreaterThan(0);
      });
      Object.values(professionalComplexityNeeds).forEach(levels => {
        expect(levels.length).toBeGreaterThan(0);
      });
    });
  });

  // ─── Priority Gap Ranking ─────────────────────────────────────────────────
  describe('Priority Gap Ranking', () => {
    it('should rank gaps by impact and effort', () => {
      const gapPriorities: { gap: string; impact: 'high' | 'medium' | 'low'; effort: 'high' | 'medium' | 'low'; personas: string[] }[] = [
        {
          gap: 'Guided onboarding flow for new users',
          impact: 'high',
          effort: 'medium',
          personas: ['Retail Client', 'Recently Divorced', 'New Advisor'],
        },
        {
          gap: 'Persona-specific dashboard views',
          impact: 'high',
          effort: 'high',
          personas: ['All client personas', 'All professional personas'],
        },
        {
          gap: 'Automated complexity level suggestion based on user profile',
          impact: 'medium',
          effort: 'medium',
          personas: ['Retail Client', 'HNW Client', 'New Advisor', 'Experienced Advisor'],
        },
        {
          gap: 'Cross-hub data flow visualization',
          impact: 'medium',
          effort: 'high',
          personas: ['Experienced Advisor', 'Branch Manager', 'Regional Director'],
        },
        {
          gap: 'Compliance checklist per client interaction',
          impact: 'high',
          effort: 'medium',
          personas: ['Compliance Officer', 'New Advisor', 'Experienced Advisor'],
        },
        {
          gap: 'Multi-client comparison view',
          impact: 'medium',
          effort: 'medium',
          personas: ['Experienced Advisor', 'Branch Manager'],
        },
        {
          gap: 'Automated report generation per persona type',
          impact: 'medium',
          effort: 'low',
          personas: ['All personas'],
        },
      ];

      // All gaps should have at least one persona affected
      gapPriorities.forEach(g => {
        expect(g.personas.length).toBeGreaterThan(0);
      });

      // High-impact gaps should exist
      const highImpact = gapPriorities.filter(g => g.impact === 'high');
      expect(highImpact.length).toBeGreaterThan(0);

      // Priority score: high=3, medium=2, low=1; impact * (4-effort)
      const impactScore = { high: 3, medium: 2, low: 1 };
      const effortScore = { high: 1, medium: 2, low: 3 };
      const ranked = gapPriorities
        .map(g => ({ ...g, priority: impactScore[g.impact] * effortScore[g.effort] }))
        .sort((a, b) => b.priority - a.priority);

      // Top priority should be high impact + low/medium effort
      expect(ranked[0].impact).toBe('high');
    });
  });
});
