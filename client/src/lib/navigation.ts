/**
 * Shared navigation configuration — single source of truth for sidebar nav items.
 *
 * Both AppShell (non-chat pages) and Chat (conversation page) consume these
 * arrays so navigation stays consistent across the entire application.
 *
 * Icons are NOT included here because they are React elements that depend on
 * the rendering context (icon size may differ between collapsed/expanded sidebar).
 * Instead, each consumer maps `iconName` to the corresponding Lucide component.
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

/** Serializable nav item — icon rendering is the consumer's responsibility. */
export interface NavItemDef {
  /** Lucide icon name (PascalCase) used as a stable key for icon lookup */
  iconName: string;
  label: string;
  href: string;
  minRole: UserRole;
}

// ─── NAVIGATE section ────────────────────────────────────────────────────────
// Note: Chat page omits "Chat" from its own tools list (it IS the chat page).
// Consumers can filter by href if needed.

export const TOOLS_NAV: NavItemDef[] = [
  { iconName: "MessageSquare", label: "Chat", href: "/chat", minRole: "user" },
  { iconName: "Zap", label: "Operations", href: "/operations", minRole: "user" },
  { iconName: "GitBranch", label: "Workflows", href: "/workflows", minRole: "user" },
  { iconName: "Brain", label: "Intelligence", href: "/intelligence-hub", minRole: "user" },
  { iconName: "Package", label: "Advisory", href: "/advisory", minRole: "user" },
  { iconName: "Users", label: "Relationships", href: "/relationships", minRole: "user" },
  { iconName: "TrendingUp", label: "Market Data", href: "/market-data", minRole: "user" },
  { iconName: "FileText", label: "Documents", href: "/documents", minRole: "user" },
  { iconName: "Link2", label: "Integrations", href: "/integrations", minRole: "user" },
  { iconName: "HeartPulse", label: "Integration Health", href: "/integration-health", minRole: "advisor" },
  { iconName: "RefreshCw", label: "Passive Actions", href: "/passive-actions", minRole: "user" },
  { iconName: "Activity", label: "My Progress", href: "/proficiency", minRole: "user" },
  { iconName: "Shield", label: "Protection Score", href: "/protection-score", minRole: "user" },
  { iconName: "Users2", label: "Community", href: "/community", minRole: "advisor" },
  { iconName: "LayoutDashboard", label: "Client Dashboard", href: "/client-dashboard", minRole: "user" },
];

// ─── ADMIN section ───────────────────────────────────────────────────────────

export const ADMIN_NAV: NavItemDef[] = [
  { iconName: "Briefcase", label: "Portal", href: "/portal", minRole: "advisor" },
  { iconName: "Building2", label: "Organizations", href: "/organizations", minRole: "advisor" },
  { iconName: "BarChart3", label: "Manager Dashboard", href: "/manager", minRole: "manager" },
  { iconName: "Globe", label: "Global Admin", href: "/admin", minRole: "admin" },
  { iconName: "Wrench", label: "Improvement Engine", href: "/improvement", minRole: "advisor" },
  { iconName: "BookOpen", label: "Platform Guide", href: "/admin/guide", minRole: "admin" },
  { iconName: "Activity", label: "System Health", href: "/admin/system-health", minRole: "admin" },
  { iconName: "Database", label: "Data Freshness", href: "/admin/data-freshness", minRole: "admin" },
  { iconName: "Target", label: "Lead Sources", href: "/admin/lead-sources", minRole: "admin" },
  { iconName: "TrendingUp", label: "Rate Management", href: "/admin/rate-management", minRole: "admin" },
  { iconName: "FileText", label: "Platform Reports", href: "/admin/platform-reports", minRole: "admin" },
];

// ─── UTILITY section (always visible at bottom) ──────────────────────────────

export const UTILITY_NAV: NavItemDef[] = [
  { iconName: "HelpCircle", label: "Help & Support", href: "/help", minRole: "user" },
  { iconName: "Settings", label: "Settings", href: "/settings/profile", minRole: "user" },
];
