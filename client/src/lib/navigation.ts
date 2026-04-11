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

  // ── INTELLIGENCE — multi-model AI + analysis tools
  { iconName: "Brain", label: "Intelligence", href: "/intelligence-hub", minRole: "user", section: "intelligence" },
  { iconName: "Calculator", label: "Engine Dashboard", href: "/engine-dashboard", minRole: "user", section: "intelligence" },
  { iconName: "TrendingUp", label: "Market Data", href: "/market-data", minRole: "user", section: "intelligence" },
  { iconName: "Shield", label: "Protection Score", href: "/protection-score", minRole: "user", section: "intelligence" },

  // ── RELATIONSHIPS — client + document + integration management
  { iconName: "Users", label: "Relationships", href: "/relationships", minRole: "user", section: "relationships" },
  { iconName: "LayoutDashboard", label: "Client Dashboard", href: "/client-dashboard", minRole: "user", section: "relationships" },
  { iconName: "FileText", label: "Documents", href: "/documents", minRole: "user", section: "relationships" },
  { iconName: "Link2", label: "Integrations", href: "/integrations", minRole: "user", section: "relationships" },
  { iconName: "HeartPulse", label: "Integration Health", href: "/integration-health", minRole: "advisor", section: "relationships" },
  { iconName: "Users2", label: "Community", href: "/community", minRole: "advisor", section: "relationships" },

  // ── LEARNING — EMBA tracks, licenses, content authoring
  { iconName: "GraduationCap", label: "Learning", href: "/learning", minRole: "user", section: "learning" },
  { iconName: "Shield", label: "Licenses", href: "/learning/licenses", minRole: "user", section: "learning" },
  { iconName: "Award", label: "Achievements", href: "/learning/achievements", minRole: "user", section: "learning" },
  { iconName: "Brain", label: "Concept Map", href: "/learning/connections", minRole: "user", section: "learning" },
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
  { iconName: "Wrench", label: "Improvement Engine", href: "/improvement", minRole: "advisor" },
  { iconName: "BookOpen", label: "Platform Guide", href: "/admin/guide", minRole: "admin" },
  { iconName: "Activity", label: "System Health", href: "/admin/system-health", minRole: "admin" },
  { iconName: "Database", label: "Data Freshness", href: "/admin/data-freshness", minRole: "admin" },
  { iconName: "Target", label: "Lead Sources", href: "/admin/lead-sources", minRole: "admin" },
  { iconName: "TrendingUp", label: "Rate Management", href: "/admin/rate-management", minRole: "admin" },
  { iconName: "FileText", label: "Platform Reports", href: "/admin/platform-reports", minRole: "admin" },
  { iconName: "Compass", label: "Comparables", href: "/comparables", minRole: "advisor" },
];

// ─── UTILITY section (always visible at bottom) ──────────────────────────────

export const UTILITY_NAV: NavItemDef[] = [
  { iconName: "HelpCircle", label: "Help & Support", href: "/help", minRole: "user" },
  { iconName: "Settings", label: "Settings", href: "/settings/profile", minRole: "user" },
];
