/**
 * commandPaletteData.ts — pure data + helpers for CommandPalette
 *
 * Build Loop Pass 7. Extracted from CommandPalette.tsx so the data
 * shape + role-filter decision logic is testable without pulling JSX
 * into the test environment.
 */

import {
  TOOLS_NAV,
  ADMIN_NAV,
  UTILITY_NAV,
  type NavItemDef,
  type UserRole,
} from "@/lib/navigation";

export interface PageEntry {
  label: string;
  href: string;
  iconName?: string;
  keywords: string[];
  shortcut?: string;
  minRole: UserRole;
}

/** Only routes that MAP TO A WIRED g-chord in useKeyboardShortcuts.ts. */
export const WIRED_G_CHORDS: Record<string, string> = {
  "/chat": "G C",
  "/settings/profile": "G S",
  "/intelligence-hub": "G I",
  "/leads": "G L",
  "/operations": "G O",
  "/help": "G H",
};

/**
 * Routes that SHOULD appear in the palette but don't live in the
 * sidebar (settings sub-pages, beyond-parity features, utilities).
 */
export const EXTRA_PAGES: PageEntry[] = [
  {
    label: "My Work",
    href: "/my-work",
    iconName: "Briefcase",
    keywords: ["tasks", "queue", "pending", "inbox"],
    minRole: "advisor",
  },
  {
    label: "Financial Twin",
    href: "/financial-twin",
    iconName: "Fingerprint",
    keywords: ["portfolio", "goals", "risk", "twin"],
    minRole: "user",
  },
  {
    label: "Workflows",
    href: "/workflows",
    iconName: "GitBranch",
    keywords: ["automation", "flows", "onboarding", "annual review"],
    minRole: "user",
  },
  {
    label: "Code Chat",
    href: "/code-chat",
    iconName: "Terminal",
    keywords: ["code", "develop", "github", "files", "edit"],
    minRole: "admin",
  },
  {
    label: "Consensus",
    href: "/consensus",
    iconName: "Brain",
    keywords: ["multi-model", "agreement", "consensus"],
    minRole: "user",
  },
  {
    label: "Achievements",
    href: "/learning/achievements",
    iconName: "Award",
    keywords: ["badges", "milestones", "gamification", "streak"],
    minRole: "user",
  },
  {
    label: "Concept Map",
    href: "/learning/connections",
    iconName: "Brain",
    keywords: ["graph", "relationships", "concepts", "map"],
    minRole: "user",
  },
  {
    label: "Content Studio",
    href: "/learning/studio",
    iconName: "Sparkles",
    keywords: ["author", "publish", "definitions", "emba"],
    minRole: "advisor",
  },
  {
    label: "Licenses",
    href: "/learning/licenses",
    iconName: "Shield",
    keywords: ["ce", "credits", "series", "cfp", "license"],
    minRole: "user",
  },
  {
    label: "Engine Dashboard",
    href: "/engine-dashboard",
    iconName: "Calculator",
    keywords: ["wealth", "engine", "retirement", "calculators"],
    minRole: "user",
  },
  {
    label: "Protection Score",
    href: "/protection-score",
    iconName: "Shield",
    keywords: ["suitability", "protection", "risk", "fps"],
    minRole: "user",
  },
  {
    label: "Audio Preferences",
    href: "/settings/audio",
    iconName: "Sparkles",
    keywords: ["voice", "tts", "edge tts", "speed", "pitch"],
    minRole: "user",
  },
  {
    label: "AI Tuning",
    href: "/settings/ai-tuning",
    iconName: "Sparkles",
    keywords: ["personalize", "model", "cascade"],
    minRole: "user",
  },
  {
    label: "Appearance",
    href: "/settings/appearance",
    iconName: "Sparkles",
    keywords: ["theme", "light", "dark", "font size", "density", "a11y"],
    minRole: "user",
  },
  {
    label: "Knowledge & Documents",
    href: "/settings/knowledge",
    iconName: "FileText",
    keywords: ["docs", "knowledge base", "upload"],
    minRole: "user",
  },
  {
    label: "Suitability",
    href: "/settings/suitability",
    iconName: "Scale",
    keywords: ["profile", "risk", "questionnaire"],
    minRole: "user",
  },
  {
    label: "Public Calculators",
    href: "/public-calculators",
    iconName: "Calculator",
    keywords: ["embed", "public", "lead capture", "guest"],
    minRole: "user",
  },
  {
    label: "Embed Widget",
    href: "/embed",
    iconName: "Code",
    keywords: ["embed", "widget", "iframe", "calculator"],
    minRole: "advisor",
  },
  {
    label: "Welcome Landing",
    href: "/welcome-landing",
    iconName: "Globe",
    keywords: ["landing", "marketing", "public", "homepage"],
    minRole: "user",
  },
  {
    label: "Due Review",
    href: "/learning/review",
    iconName: "RefreshCw",
    keywords: ["srs", "spaced repetition", "flashcard", "review"],
    minRole: "user",
  },
  {
    label: "Search Content",
    href: "/learning/search",
    iconName: "Search",
    keywords: ["search", "definitions", "content", "find"],
    minRole: "user",
  },
  {
    label: "Improvement Engine",
    href: "/improvement",
    iconName: "Brain",
    keywords: ["improvement", "optimization", "suggestions"],
    minRole: "advisor",
  },
];

/**
 * Pure builder — derives PageEntry[] from the navigation.ts arrays +
 * EXTRA_PAGES. Dedupes by href with sidebar entries winning.
 *
 * Role filtering is NOT applied here — callers use `hasMinRole` from
 * navigation.ts at render time because the user role isn't available
 * at module scope.
 */
export function buildPages(): PageEntry[] {
  const fromSidebar: PageEntry[] = [
    ...TOOLS_NAV,
    ...ADMIN_NAV,
    ...UTILITY_NAV,
  ].map((n: NavItemDef) => ({
    label: n.label,
    href: n.href,
    iconName: n.iconName,
    keywords: [n.label.toLowerCase(), ...(n.section ? [n.section] : [])],
    shortcut: WIRED_G_CHORDS[n.href],
    minRole: n.minRole,
  }));

  const seen = new Set<string>();
  const combined: PageEntry[] = [];
  for (const p of [...fromSidebar, ...EXTRA_PAGES]) {
    if (seen.has(p.href)) continue;
    seen.add(p.href);
    combined.push(p);
  }
  return combined;
}
