/**
 * Shared navigation configuration — single source of truth for sidebar nav items.
 *
 * Both AppShell (non-chat pages) and Chat (conversation page) consume these
 * arrays so navigation stays consistent across the entire application.
 *
 * Icons are NOT included here because they are React elements that depend on
 * the rendering context (icon size may differ between collapsed/expanded sidebar).
 * Instead, each consumer maps `iconName` to the corresponding Lucide component.
 *
 * Pass 83 (UI/UX optimization): introduced a `section` field to group the
 * 19-item TOOLS_NAV into 5 semantic subsections (Home / Work / Intelligence /
 * Relationships / Learning). This is pure metadata — it does not change routes,
 * hrefs, or role gates. AppShell renders a small section header between items
 * when the section changes. Command Palette + keyboard shortcuts are
 * unaffected. navReachability.test.ts continues to pass because every href is
 * still in the array.
 */
import type { UserRole } from "@shared/types";

// Re-export for convenience
export type { UserRole } from "@shared/types";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 0,
  advisor: 1,
  manager: 2,
  admin: 3,
};

export function hasMinRole(
  userRole: string | undefined,
  minRole: UserRole,
): boolean {
  return (
    ROLE_HIERARCHY[(userRole as UserRole) ?? "user"] >=
    ROLE_HIERARCHY[minRole]
  );
}

/**
 * Semantic sections for the main Navigate list. Each section groups related
 * features so the sidebar reads as 5 discrete "where am I going" buckets
 * instead of a flat 19-item list. See pass 83 notes in REMAINING_ITEMS.md.
 */
export type NavSection =
  | "home"
  | "work"
  | "intelligence"
  | "relationships"
  | "learning";

export const NAV_SECTION_LABELS: Record<NavSection, string> = {
  home: "Home",
  work: "Work",
  intelligence: "Intelligence",
  relationships: "Relationships",
  learning: "Learning",
};

/** Canonical order — AppShell iterates in this order when rendering. */
export const NAV_SECTION_ORDER: NavSection[] = [
  "home",
  "work",
  "intelligence",
  "relationships",
  "learning",
];

/** Serializable nav item — icon rendering is the consumer's responsibility. */
export interface NavItemDef {
  /** Lucide icon name (PascalCase) used as a stable key for icon lookup */
  iconName: string;
  label: string;
  href: string;
  minRole: UserRole;
  /** Semantic section for the Navigate sidebar group (TOOLS_NAV only).
   *  Admin + utility nav arrays don't use sections. */
  section?: NavSection;
}

// ─── NAVIGATE section ────────────────────────────────────────────────────────
// Note: Chat page omits "Chat" from its own tools list (it IS the chat page).
// Consumers can filter by href if needed.

export const TOOLS_NAV: NavItemDef[] = [
  // ── HOME — the entry points a user returns to most often.
  // Per prompt v10.0 (Pass 85 revert): Chat IS the landing page and
  // the feature gateway. There is NO /dashboard route — the chat
  // empty state surfaces activity, insights, and feature discovery.
  // This matches the pattern every conversational AI product uses
  // (ChatGPT, Claude, Gemini) and saves the user a click on every
  // login.
  { iconName: "MessageSquare", label: "Chat", href: "/chat", minRole: "user", section: "home" },
  { iconName: "Activity", label: "My Progress", href: "/proficiency", minRole: "user", section: "home" },
  { iconName: "Fingerprint", label: "Financial Twin", href: "/financial-twin", minRole: "user", section: "home" },

  // ── WORK — the Hub architecture from STEWARDLY_COMPREHENSIVE_GUIDE §5
  { iconName: "Briefcase", label: "My Work", href: "/my-work", minRole: "advisor", section: "work" },
  { iconName: "Zap", label: "Operations", href: "/operations", minRole: "user", section: "work" },
  { iconName: "Package", label: "Advisory", href: "/advisory", minRole: "user", section: "work" },
  { iconName: "GitBranch", label: "Workflows", href: "/workflows", minRole: "user", section: "work" },
  { iconName: "RefreshCw", label: "Passive Actions", href: "/passive-actions", minRole: "user", section: "work" },
  { iconName: "FileCheck", label: "Insurance Apps", href: "/insurance-applications", minRole: "advisor", section: "work" },
  { iconName: "Play", label: "Advisory Execution", href: "/advisory-execution", minRole: "advisor", section: "work" },
  { iconName: "Truck", label: "Carrier Connector", href: "/carrier-connector", minRole: "advisor", section: "work" },
  { iconName: "ClipboardCheck", label: "Suitability Panel", href: "/suitability-panel", minRole: "advisor", section: "work" },
  { iconName: "UserPlus", label: "Client Onboarding", href: "/client-onboarding", minRole: "user", section: "work" },
  { iconName: "Upload", label: "Import Data", href: "/import", minRole: "advisor", section: "work" },

  // ── INTELLIGENCE — multi-model AI + analysis tools + calculators
  { iconName: "Brain", label: "Intelligence", href: "/intelligence-hub", minRole: "user", section: "intelligence" },
  { iconName: "Sparkles", label: "Wealth Engine", href: "/wealth-engine", minRole: "user", section: "intelligence" },
  { iconName: "Calculator", label: "Calculators", href: "/calculators", minRole: "user", section: "intelligence" },
  { iconName: "Calculator", label: "Engine Dashboard", href: "/engine-dashboard", minRole: "user", section: "intelligence" },
  { iconName: "Target", label: "Retirement", href: "/wealth-engine/retirement", minRole: "user", section: "intelligence" },
  { iconName: "BarChart3", label: "Strategy Compare", href: "/wealth-engine/strategy-comparison", minRole: "user", section: "intelligence" },
  { iconName: "Zap", label: "Quick Quote", href: "/wealth-engine/quick-quote", minRole: "user", section: "intelligence" },
  { iconName: "Briefcase", label: "Practice → Wealth", href: "/wealth-engine/practice-to-wealth", minRole: "advisor", section: "intelligence" },
  { iconName: "DollarSign", label: "Business Income", href: "/wealth-engine/business-income", minRole: "advisor", section: "intelligence" },
  { iconName: "Users", label: "Team Builder", href: "/wealth-engine/team-builder", minRole: "advisor", section: "intelligence" },
  { iconName: "Grid3X3", label: "What-If Grid", href: "/wealth-engine/what-if", minRole: "user", section: "intelligence" },
  { iconName: "ShieldCheck", label: "Wealth Configurator", href: "/wealth-engine/configurator", minRole: "user", section: "intelligence" },
  { iconName: "BookOpen", label: "Reference Hub", href: "/wealth-engine/references", minRole: "user", section: "intelligence" },
  { iconName: "Rocket", label: "Business Valuation", href: "/wealth-engine/business-valuation", minRole: "advisor", section: "intelligence" },
  { iconName: "BarChart3", label: "Holistic Comparison", href: "/wealth-engine/holistic-comparison", minRole: "advisor", section: "intelligence" },
  { iconName: "Sparkles", label: "Quick Quote Hub", href: "/wealth-engine/quick-quote-hub", minRole: "advisor", section: "intelligence" },
  { iconName: "DollarSign", label: "Income Quick Quote", href: "/wealth-engine/business-income-quick-quote", minRole: "advisor", section: "intelligence" },
  { iconName: "BarChart3", label: "Owner Compensation", href: "/wealth-engine/owner-comp", minRole: "advisor", section: "intelligence" },
  { iconName: "Grid3X3", label: "Sensitivity Analysis", href: "/wealth-engine/sensitivity", minRole: "user", section: "intelligence" },
  { iconName: "Scale", label: "Rebalancing", href: "/rebalancing", minRole: "advisor", section: "intelligence" },
  { iconName: "TrendingUp", label: "Market Data", href: "/market-data", minRole: "user", section: "intelligence" },
  { iconName: "Shield", label: "Protection Score", href: "/protection-score", minRole: "user", section: "intelligence" },
  { iconName: "DollarSign", label: "Tax Planning", href: "/tax-planning", minRole: "user", section: "intelligence" },
  { iconName: "Scale", label: "Estate Planning", href: "/estate", minRole: "user", section: "intelligence" },
  { iconName: "BarChart3", label: "Risk Assessment", href: "/risk-assessment", minRole: "user", section: "intelligence" },
  { iconName: "TrendingUp", label: "Income Projection", href: "/income-projection", minRole: "user", section: "intelligence" },
  { iconName: "Heart", label: "Insurance Analysis", href: "/insurance-analysis", minRole: "user", section: "intelligence" },
  { iconName: "LineChart", label: "Financial Planning", href: "/financial-planning", minRole: "user", section: "intelligence" },
  { iconName: "HeartPulse", label: "Social Security", href: "/social-security", minRole: "user", section: "intelligence" },
  { iconName: "Stethoscope", label: "Medicare", href: "/medicare", minRole: "user", section: "intelligence" },
  { iconName: "Package", label: "Products", href: "/products", minRole: "user", section: "intelligence" },
  { iconName: "Lightbulb", label: "Product Intelligence", href: "/product-intelligence", minRole: "advisor", section: "intelligence" },

  // ── RELATIONSHIPS — client + document + integration management
  { iconName: "Users", label: "Relationships", href: "/relationships", minRole: "user", section: "relationships" },
  { iconName: "LayoutDashboard", label: "Client Dashboard", href: "/client-dashboard", minRole: "user", section: "relationships" },
  { iconName: "Target", label: "Lead Pipeline", href: "/leads", minRole: "advisor", section: "relationships" },
  { iconName: "Mail", label: "Email Campaigns", href: "/email-campaigns", minRole: "advisor", section: "relationships" },
  { iconName: "RefreshCw", label: "CRM Sync", href: "/crm-sync", minRole: "advisor", section: "relationships" },
  { iconName: "ShieldCheck", label: "Compliance Audit", href: "/compliance-audit", minRole: "advisor", section: "relationships" },
  { iconName: "FileText", label: "Documents", href: "/settings/knowledge", minRole: "user", section: "relationships" },
  { iconName: "Link2", label: "Integrations", href: "/integrations", minRole: "user", section: "relationships" },
  { iconName: "Plug", label: "Dynamic Integrations", href: "/dynamic-integrations", minRole: "advisor", section: "relationships" },
  { iconName: "HeartPulse", label: "Integration Health", href: "/integration-health", minRole: "advisor", section: "relationships" },
  { iconName: "Link", label: "My Integrations", href: "/my-integrations", minRole: "advisor", section: "relationships" },
  { iconName: "Users2", label: "Community", href: "/community", minRole: "advisor", section: "relationships" },

  // ── LEARNING — EMBA tracks, licenses, content authoring
  { iconName: "GraduationCap", label: "Learning", href: "/learning", minRole: "user", section: "learning" },
  { iconName: "Shield", label: "Licenses", href: "/learning/licenses", minRole: "user", section: "learning" },
  { iconName: "Award", label: "Achievements", href: "/learning/achievements", minRole: "user", section: "learning" },
  { iconName: "GitBranch", label: "Concept Map", href: "/learning/connections", minRole: "user", section: "learning" },
  { iconName: "RefreshCw", label: "Due Review", href: "/learning/review", minRole: "user", section: "learning" },
  { iconName: "Search", label: "Search Content", href: "/learning/search", minRole: "user", section: "learning" },
  { iconName: "Sparkles", label: "Content Studio", href: "/learning/studio", minRole: "advisor", section: "learning" },
];

// ─── ADMIN section ───────────────────────────────────────────────────────────

export const ADMIN_NAV: NavItemDef[] = [
  { iconName: "Briefcase", label: "Portal", href: "/portal", minRole: "advisor" },
  { iconName: "Building2", label: "Organizations", href: "/organizations", minRole: "advisor" },
  { iconName: "BarChart3", label: "Manager Dashboard", href: "/manager", minRole: "manager" },
  { iconName: "Globe", label: "Global Admin", href: "/admin", minRole: "admin" },
  { iconName: "Bot", label: "AI Agents", href: "/agents", minRole: "advisor" },
  { iconName: "Terminal", label: "Code Chat", href: "/code-chat", minRole: "admin" },
  { iconName: "GitMerge", label: "Consensus", href: "/consensus", minRole: "admin" },
  { iconName: "Brain", label: "Improvement Dashboard", href: "/admin/improvement", minRole: "admin" },
  { iconName: "Activity", label: "Improvement Engine", href: "/admin/improvement-engine", minRole: "admin" },
  { iconName: "BookOpen", label: "Platform Guide", href: "/admin/guide", minRole: "admin" },
  { iconName: "Activity", label: "System Health", href: "/admin/system-health", minRole: "admin" },
  { iconName: "Database", label: "Data Freshness", href: "/admin/data-freshness", minRole: "admin" },
  { iconName: "Target", label: "Lead Sources", href: "/admin/lead-sources", minRole: "admin" },
  { iconName: "TrendingUp", label: "Rate Management", href: "/admin/rate-management", minRole: "admin" },
  { iconName: "FileText", label: "Platform Reports", href: "/admin/platform-reports", minRole: "admin" },
  { iconName: "Compass", label: "Comparables", href: "/comparables", minRole: "advisor" },
  { iconName: "Key", label: "API Keys", href: "/admin/api-keys", minRole: "admin" },
  { iconName: "Webhook", label: "Webhooks", href: "/admin/webhooks", minRole: "admin" },
  { iconName: "Users", label: "Team", href: "/admin/team", minRole: "admin" },
  { iconName: "CreditCard", label: "Billing", href: "/admin/billing", minRole: "admin" },
  { iconName: "Cpu", label: "AI Intelligence", href: "/admin/intelligence", minRole: "admin" },
  { iconName: "Shield", label: "BCP Dashboard", href: "/admin/bcp", minRole: "admin" },
  { iconName: "Scale", label: "Fairness Audit", href: "/admin/fairness", minRole: "admin" },
  { iconName: "Link2", label: "Admin Integrations", href: "/admin/integrations", minRole: "admin" },
  { iconName: "BookOpen", label: "Knowledge Base", href: "/admin/knowledge", minRole: "admin" },
  { iconName: "Palette", label: "Org Branding", href: "/org-branding", minRole: "admin" },
];

// ─── UTILITY section (always visible at bottom) ──────────────────────────────

export const UTILITY_NAV: NavItemDef[] = [
  { iconName: "HelpCircle", label: "Help & Support", href: "/help", minRole: "user" },
  { iconName: "FileText", label: "Changelog", href: "/changelog", minRole: "user" },
  { iconName: "Settings", label: "Settings", href: "/settings/profile", minRole: "user" },
];
