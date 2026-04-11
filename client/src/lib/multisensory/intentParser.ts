/**
 * intentParser — pure functions that classify a user utterance (typed or
 * spoken) into a structured Intent.
 *
 * Extracted from PlatformIntelligence.tsx in Pass 1 of the multisensory/a11y
 * build so it can be:
 *   - unit-tested without a React tree
 *   - consumed from the Chat input interceptor (text-typed commands)
 *   - consumed from the PIL voice pipeline (spoken commands)
 *   - consumed from any future macro/recording feature
 *
 * Contract: deterministic, side-effect-free, no DOM access. Callers decide
 * what to do with the returned Intent (navigate, dispatch, toast, ignore).
 */

/** The canonical navigation map. Keep in sync with App.tsx route table. */
export const ROUTE_MAP: Record<string, string> = {
  // Chat / home
  "chat": "/chat",
  "home": "/chat",
  "conversation": "/chat",

  // Work / clients
  "clients": "/relationships",
  "my clients": "/relationships",
  "relationships": "/relationships",
  "cases": "/my-work",
  "my work": "/my-work",
  "work": "/my-work",
  "my cases": "/my-work",

  // Compliance / intel
  "compliance": "/compliance-audit",
  "compliance audit": "/compliance-audit",
  "market data": "/market-data",
  "market": "/market-data",
  "stocks": "/market-data",
  "intelligence": "/intelligence-hub",
  "intelligence hub": "/intelligence-hub",
  "insights": "/intelligence-hub",

  // Calculators / wealth
  "calculators": "/calculators",
  "calculator": "/calculators",
  "wealth engine": "/calculators",
  "retirement": "/wealth-engine/retirement",
  "retirement calculator": "/wealth-engine/retirement",
  "strategy comparison": "/wealth-engine/strategy-comparison",
  "practice to wealth": "/wealth-engine/practice-to-wealth",
  "quick quote": "/wealth-engine/quick-quote",

  // Learning
  "learn": "/learning",
  "learning": "/learning",
  "study": "/learning",
  "learning home": "/learning",
  "licenses": "/learning/licenses",
  "license tracker": "/learning/licenses",
  "content studio": "/learning/studio",
  "studio": "/learning/studio",
  "achievements": "/learning/achievements",
  "connection map": "/learning/connections",
  "concept map": "/learning/connections",
  "connections": "/learning/connections",

  // Settings / support
  "settings": "/settings",
  "preferences": "/settings",
  "help": "/help",
  "support": "/help",
  "documents": "/documents",
  "my documents": "/documents",
  "knowledge": "/settings/knowledge",
  "progress": "/proficiency",
  "my progress": "/proficiency",
  "proficiency": "/proficiency",

  // Team / admin
  "team": "/manager",
  "team dashboard": "/manager",
  "manager": "/manager",
  "admin": "/admin",
  "platform admin": "/admin",

  // Financial twin & suitability
  "financial twin": "/financial-twin",
  "my financial twin": "/financial-twin",
  "suitability": "/settings/suitability",
  "financial profile": "/settings/suitability",
  "recommendations": "/insights",

  // Audio
  "audio": "/settings/audio",
  "audio settings": "/settings/audio",
  "voice settings": "/settings/audio",
  "voice": "/settings/audio",

  // Ops / workflows
  "operations": "/operations",
  "ops": "/operations",
  "workflows": "/workflows",

  // Pipeline
  "leads": "/leads",
  "lead pipeline": "/leads",
  "pipeline": "/leads",
};

/** Every distinct destination the intent parser can reach. */
export function routeMapDestinations(): string[] {
  return Array.from(new Set(Object.values(ROUTE_MAP)));
}

/** Friendly spoken name for a route. */
export function friendlyRouteName(path: string): string {
  const exact: Record<string, string> = {
    "/chat": "Chat",
    "/relationships": "Relationships",
    "/my-work": "My Work",
    "/compliance-audit": "Compliance",
    "/market-data": "Market Data",
    "/calculators": "Calculators",
    "/wealth-engine/retirement": "Retirement Calculator",
    "/wealth-engine/strategy-comparison": "Strategy Comparison",
    "/wealth-engine/practice-to-wealth": "Practice to Wealth",
    "/wealth-engine/quick-quote": "Quick Quote",
    "/learning": "Learning Center",
    "/learning/licenses": "License Tracker",
    "/learning/studio": "Content Studio",
    "/learning/achievements": "Achievements",
    "/learning/connections": "Connection Map",
    "/settings": "Settings",
    "/settings/audio": "Audio Settings",
    "/settings/knowledge": "Knowledge Base",
    "/settings/suitability": "Financial Profile",
    "/help": "Help",
    "/documents": "Documents",
    "/proficiency": "My Progress",
    "/manager": "Team Dashboard",
    "/admin": "Platform Admin",
    "/financial-twin": "Financial Twin",
    "/insights": "Insights",
    "/intelligence-hub": "Intelligence Hub",
    "/operations": "Operations",
    "/workflows": "Workflows",
    "/leads": "Lead Pipeline",
  };
  if (exact[path]) return exact[path];
  const tail = path.split("/").filter(Boolean).pop() || "page";
  return tail
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** Result of parsing an utterance. */
export type ParsedIntent =
  | { kind: "navigate"; route: string; label: string; matched: string }
  | { kind: "audio"; action: AudioAction; value?: number }
  | { kind: "hands_free"; action: "enter" | "exit" }
  | { kind: "learning"; action: "next" | "reveal" | "rate"; rating?: LearningRating }
  | { kind: "read_page" }
  | { kind: "focus_chat" }
  | { kind: "open_palette" }
  | { kind: "help" }
  | { kind: "unknown"; input: string };

export type AudioAction =
  | "pause"
  | "resume"
  | "speed_up"
  | "slow_down"
  | "skip"
  | "restart";

export type LearningRating = "again" | "hard" | "good" | "easy";

/** Whether to treat bare words as navigation (voice/hands-free) or only require an
 *  explicit verb prefix like "go to". Default: require prefix in text mode. */
export interface ParseOptions {
  /** If true, "learning" alone is enough to navigate. Otherwise requires "go to learning". */
  allowBareNav: boolean;
}

const NAV_VERB_PATTERNS: RegExp[] = [
  /^(?:go(?: to)?|open|show(?: me)?|navigate(?: to)?|take me(?: to)?|bring up|jump to|visit)\s+(.+)$/i,
];

const PAUSE_PATTERNS = [/^(?:pause|stop(?: audio)?|hold on|hush|quiet|be quiet)$/i];
const RESUME_PATTERNS = [/^(?:resume|continue|play|keep going|unpause)$/i];
const FASTER_PATTERNS = [/^(?:speed up|faster|go faster)$/i];
const SLOWER_PATTERNS = [/^(?:slow down|slower|go slower)$/i];
const SKIP_PATTERNS = [/^(?:skip|next audio|skip this)$/i];
const RESTART_PATTERNS = [/^(?:restart|start over|from the top)$/i];

const READ_PATTERNS = [
  /^read$/i,
  /^(?:read (?:this|it)(?: to me)?|read (?:this )?(?:page|aloud)|narrate(?: this(?: page)?)?)$/i,
];
const FOCUS_CHAT = [/^(?:focus(?: the)? (?:chat|input)|select (?:chat|input)|type(?: here)?)$/i];
const OPEN_PALETTE = [/^(?:open (?:the )?(?:palette|command palette)|search pages|command palette)$/i];

const ENTER_HF = [/^(?:enter|start|activate|turn on) hands[- ]?free$/i, /^hands[- ]?free(?: mode)?(?: on)?$/i];
const EXIT_HF = [/^(?:exit|stop|deactivate|leave|turn off) hands[- ]?free$/i, /^hands[- ]?free(?: mode)? off$/i];

const NEXT_PATTERNS = [/^(?:next|next (?:card|flashcard|question|item))$/i];
const REVEAL_PATTERNS = [/^(?:show(?: the)?(?: answer)?|flip|reveal(?: answer)?|turn over)$/i];
const RATE_PATTERNS = [/^(?:rate |mark )?(?:as )?(easy|good|hard|again)$/i];

const HELP_PATTERNS = [/^(?:help|what can (?:you|i) (?:do|say)|shortcuts|what can you do)$/i];

/**
 * Parse a free-form utterance into a structured intent.
 *
 * This is the single ground-truth parser — both the voice pipeline and the
 * Chat slash-command interceptor call it, so navigation + audio + learning
 * behaviour stays consistent across input modalities.
 */
export function parseIntent(raw: string, opts: ParseOptions = { allowBareNav: false }): ParsedIntent {
  const input = (raw ?? "").trim();
  if (!input) return { kind: "unknown", input };

  // Strip a leading slash so "/go learning" and "go learning" behave the same
  const normalized = input.replace(/^\/+/, "").toLowerCase().trim();

  // 1. Audio playback controls (highest priority — bare verbs)
  if (matchesAny(normalized, PAUSE_PATTERNS)) return { kind: "audio", action: "pause" };
  if (matchesAny(normalized, RESUME_PATTERNS)) return { kind: "audio", action: "resume" };
  if (matchesAny(normalized, FASTER_PATTERNS)) return { kind: "audio", action: "speed_up" };
  if (matchesAny(normalized, SLOWER_PATTERNS)) return { kind: "audio", action: "slow_down" };
  if (matchesAny(normalized, SKIP_PATTERNS)) return { kind: "audio", action: "skip" };
  if (matchesAny(normalized, RESTART_PATTERNS)) return { kind: "audio", action: "restart" };

  // 2. Read-page / focus-chat / palette shortcuts (bare verbs)
  if (matchesAny(normalized, READ_PATTERNS)) return { kind: "read_page" };
  if (matchesAny(normalized, FOCUS_CHAT)) return { kind: "focus_chat" };
  if (matchesAny(normalized, OPEN_PALETTE)) return { kind: "open_palette" };
  if (matchesAny(normalized, HELP_PATTERNS)) return { kind: "help" };

  // 3. Hands-free mode toggles
  if (matchesAny(normalized, ENTER_HF)) return { kind: "hands_free", action: "enter" };
  if (matchesAny(normalized, EXIT_HF)) return { kind: "hands_free", action: "exit" };

  // 4. Learning actions
  if (matchesAny(normalized, NEXT_PATTERNS)) return { kind: "learning", action: "next" };
  if (matchesAny(normalized, REVEAL_PATTERNS)) return { kind: "learning", action: "reveal" };
  {
    const ratingMatch = firstCapture(normalized, RATE_PATTERNS);
    if (ratingMatch) {
      return {
        kind: "learning",
        action: "rate",
        rating: ratingMatch.toLowerCase() as LearningRating,
      };
    }
  }

  // 5. Navigation: try explicit verb patterns, then bare words if allowed
  for (const pattern of NAV_VERB_PATTERNS) {
    const m = normalized.match(pattern);
    if (m) {
      const nav = resolveNavTarget(m[1]);
      if (nav) return nav;
    }
  }

  if (opts.allowBareNav) {
    const nav = resolveNavTarget(normalized);
    if (nav) return nav;
  }

  return { kind: "unknown", input };
}

/** Find the best matching route for a free-text target like "learning center". */
export function resolveNavTarget(target: string): ParsedIntent | null {
  const t = target
    .toLowerCase()
    .trim()
    .replace(/^the\s+/, "")
    .replace(/\s+page$/, "")
    .replace(/\s+section$/, "")
    .replace(/[?!.]+$/, "");
  if (!t) return null;

  // Exact match first (fastest, most predictable)
  if (ROUTE_MAP[t]) {
    return { kind: "navigate", route: ROUTE_MAP[t], label: friendlyRouteName(ROUTE_MAP[t]), matched: t };
  }

  // Starts-with match (user said "learning center" and we have "learning")
  for (const key of Object.keys(ROUTE_MAP)) {
    if (t.startsWith(key + " ") || t === key) {
      return { kind: "navigate", route: ROUTE_MAP[key], label: friendlyRouteName(ROUTE_MAP[key]), matched: key };
    }
  }

  // Substring match on route segments ("open my clients page" → clients)
  for (const key of Object.keys(ROUTE_MAP)) {
    if (t.includes(key)) {
      return { kind: "navigate", route: ROUTE_MAP[key], label: friendlyRouteName(ROUTE_MAP[key]), matched: key };
    }
  }

  return null;
}

function matchesAny(input: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(input));
}

function firstCapture(input: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = input.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}
