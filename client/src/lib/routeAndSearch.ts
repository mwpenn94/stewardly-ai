/**
 * routeRedirects.ts — Redirect old routes to new destinations
 *
 * Pass 122. When the 5-layer persona nav replaces the old sidebar,
 * many old routes need redirects so bookmarks and links don't break.
 */

export const ROUTE_REDIRECTS: Record<string, string> = {
  "/operations": "/my-work",
  "/advisory": "/my-work",
  "/workflows": "/my-work",
  "/passive-actions": "/my-work",
  "/intelligence-hub": "/learning",
  "/relationships-hub": "/relationships",
  "/learning/tracks": "/learning",
  "/learning/flashcards": "/learning",
  "/settings/suitability": "/suitability",
};

/**
 * commandPaletteSearch.ts — Enhanced search sources for command palette
 */

export interface SearchResult {
  id: string;
  type: "page" | "conversation" | "client" | "learning" | "calculator" | "action";
  title: string;
  subtitle?: string;
  icon: string;
  path: string;
  keywords: string[];
}

export const PAGE_RESULTS: SearchResult[] = [
  { id: "chat", type: "page", title: "Chat", icon: "MessageSquare", path: "/chat", keywords: ["chat", "talk", "ask", "steward", "conversation"] },
  { id: "clients", type: "page", title: "Clients", icon: "Users", path: "/relationships", keywords: ["clients", "relationships", "contacts", "people"] },
  { id: "work", type: "page", title: "My Work", icon: "ClipboardList", path: "/my-work", keywords: ["work", "cases", "tasks", "compliance", "operations", "advisory", "workflows"] },
  { id: "learning", type: "page", title: "Learning Center", icon: "GraduationCap", path: "/learning", keywords: ["learn", "study", "training", "exam", "education"] },
  { id: "documents", type: "page", title: "Documents", icon: "FileText", path: "/documents", keywords: ["documents", "files", "upload", "vault"] },
  { id: "progress", type: "page", title: "My Progress", icon: "BarChart3", path: "/progress", keywords: ["progress", "stats", "analytics"] },
  { id: "twin", type: "page", title: "My Financial Twin", icon: "Fingerprint", path: "/financial-twin", keywords: ["twin", "profile", "financial", "snapshot"] },
  { id: "recs", type: "page", title: "Recommendations", icon: "Star", path: "/recommendations", keywords: ["recommendations", "advice", "suggestions"] },
  { id: "suitability", type: "page", title: "Suitability", icon: "ClipboardList", path: "/suitability", keywords: ["suitability", "risk", "assessment", "profile"] },
  { id: "market", type: "page", title: "Market Data", icon: "TrendingUp", path: "/market-data", keywords: ["market", "data", "bls", "fred", "sec", "edgar", "rates", "sofr"] },
  { id: "calc", type: "page", title: "Calculators", icon: "Calculator", path: "/wealth-engine", keywords: ["calculator", "iul", "estate", "premium", "finance", "wealth", "engine"] },
  { id: "compliance", type: "page", title: "Compliance", icon: "ShieldCheck", path: "/compliance-audit", keywords: ["compliance", "audit", "reg bi", "review"] },
  { id: "integrations", type: "page", title: "Integrations", icon: "Plug", path: "/integrations", keywords: ["integrations", "connect", "ghl", "dripify", "github"] },
  { id: "settings", type: "page", title: "Settings", icon: "Settings", path: "/settings", keywords: ["settings", "preferences", "profile", "appearance"] },
  { id: "audio", type: "page", title: "Audio & Voice Settings", icon: "Volume2", path: "/settings/audio", keywords: ["audio", "voice", "tts", "speech", "hands-free", "sound"] },
  { id: "help", type: "page", title: "Help & Support", icon: "HelpCircle", path: "/help", keywords: ["help", "support", "documentation", "faq"] },
  { id: "achievements", type: "page", title: "Achievements", icon: "Award", path: "/learning/achievements", keywords: ["achievements", "trophies", "streaks", "milestones"] },
  { id: "connections", type: "page", title: "Concept Map", icon: "Brain", path: "/learning/connections", keywords: ["connections", "map", "graph", "concepts", "relationships"] },
];

export const LEARNING_MODULE_RESULTS: SearchResult[] = [
  { id: "mod-sie", type: "learning", title: "SIE Training", subtitle: "Securities Industry Essentials", icon: "BookOpen", path: "/learning/sie", keywords: ["sie", "securities", "industry", "essentials", "finra"] },
  { id: "mod-s7", type: "learning", title: "Series 7", subtitle: "General Securities Representative", icon: "BookOpen", path: "/learning/series7", keywords: ["series 7", "securities", "representative", "equity", "debt", "options"] },
  { id: "mod-s66", type: "learning", title: "Series 66", subtitle: "Investment Adviser Representative", icon: "BookOpen", path: "/learning/series66", keywords: ["series 66", "investment", "adviser", "state law"] },
  { id: "mod-cfp", type: "learning", title: "CFP Training", subtitle: "Certified Financial Planner", icon: "BookOpen", path: "/learning/cfp", keywords: ["cfp", "certified", "financial", "planner", "planning"] },
  { id: "mod-estate", type: "learning", title: "Estate Planning", subtitle: "Trusts, wills, wealth transfer", icon: "BookOpen", path: "/learning/estate-planning", keywords: ["estate", "planning", "trusts", "wills", "wealth transfer"] },
  { id: "mod-pf", type: "learning", title: "Premium Financing", subtitle: "Structure and compliance", icon: "BookOpen", path: "/learning/premium-financing", keywords: ["premium", "financing", "sofr", "structure"] },
];

export const ACTION_RESULTS: SearchResult[] = [
  { id: "act-handsfree", type: "action", title: "Enter Hands-Free Mode", icon: "Mic", path: "__action:handsfree", keywords: ["hands-free", "voice", "handsfree", "audio mode"] },
  { id: "act-newchat", type: "action", title: "New Conversation", icon: "Plus", path: "__action:newchat", keywords: ["new", "conversation", "chat", "start"] },
  { id: "act-exam", type: "action", title: "Start Practice Exam", icon: "ClipboardCheck", path: "__action:exam", keywords: ["exam", "quiz", "test", "practice"] },
  { id: "act-study", type: "action", title: "Start Study Session", icon: "BookOpen", path: "__action:study", keywords: ["study", "flashcards", "review", "srs"] },
];

export function searchAll(query: string, maxResults = 10): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const allResults = [...PAGE_RESULTS, ...LEARNING_MODULE_RESULTS, ...ACTION_RESULTS];

  return allResults
    .map(r => {
      let score = 0;
      if (r.title.toLowerCase().includes(q)) score += 10;
      if (r.subtitle?.toLowerCase().includes(q)) score += 5;
      if (r.keywords.some(k => k.includes(q))) score += 3;
      if (r.keywords.includes(q)) score += 5;
      return { result: r, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(r => r.result);
}
