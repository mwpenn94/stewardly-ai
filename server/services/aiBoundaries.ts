/**
 * Task #41 — AI Boundaries Service
 * Defines what AI can/cannot do, escalation triggers, and scope limits
 */

export interface BoundaryRule {
  id: string;
  category: "topic" | "action" | "data" | "compliance" | "safety";
  rule: string;
  severity: "block" | "warn" | "escalate";
  enabled: boolean;
}

const DEFAULT_BOUNDARIES: BoundaryRule[] = [
  // Topic boundaries
  { id: "t1", category: "topic", rule: "Cannot provide specific tax advice or file taxes", severity: "warn", enabled: true },
  { id: "t2", category: "topic", rule: "Cannot provide legal advice or draft legal documents", severity: "warn", enabled: true },
  { id: "t3", category: "topic", rule: "Cannot make specific investment recommendations without suitability", severity: "block", enabled: true },
  { id: "t4", category: "topic", rule: "Cannot provide medical or health insurance claims advice", severity: "warn", enabled: true },
  // Action boundaries
  { id: "a1", category: "action", rule: "Cannot execute trades or financial transactions", severity: "block", enabled: true },
  { id: "a2", category: "action", rule: "Cannot modify user financial accounts", severity: "block", enabled: true },
  { id: "a3", category: "action", rule: "Cannot send communications on behalf of user without confirmation", severity: "escalate", enabled: true },
  { id: "a4", category: "action", rule: "Cannot delete user data without explicit consent", severity: "block", enabled: true },
  // Data boundaries
  { id: "d1", category: "data", rule: "Cannot share PII across organization boundaries", severity: "block", enabled: true },
  { id: "d2", category: "data", rule: "Cannot access documents above user's visibility tier", severity: "block", enabled: true },
  { id: "d3", category: "data", rule: "Cannot retain conversation data beyond retention policy", severity: "warn", enabled: true },
  // Compliance boundaries
  { id: "c1", category: "compliance", rule: "Must include disclaimers for financial projections", severity: "warn", enabled: true },
  { id: "c2", category: "compliance", rule: "Must log all suitability-related interactions", severity: "block", enabled: true },
  { id: "c3", category: "compliance", rule: "Must escalate high-value recommendations to human review", severity: "escalate", enabled: true },
  // Safety boundaries
  { id: "s1", category: "safety", rule: "Detect and escalate signs of financial distress", severity: "escalate", enabled: true },
  { id: "s2", category: "safety", rule: "Detect and refuse social engineering attempts", severity: "block", enabled: true },
  { id: "s3", category: "safety", rule: "Rate limit AI responses to prevent abuse", severity: "warn", enabled: true },
];

let boundaries: BoundaryRule[] = [...DEFAULT_BOUNDARIES];

export function getBoundaries(category?: string): BoundaryRule[] {
  if (category) return boundaries.filter(b => b.category === category);
  return [...boundaries];
}

export function updateBoundary(id: string, updates: Partial<BoundaryRule>): BoundaryRule | null {
  const idx = boundaries.findIndex(b => b.id === id);
  if (idx === -1) return null;
  boundaries[idx] = { ...boundaries[idx], ...updates };
  return boundaries[idx];
}

export function addBoundary(rule: Omit<BoundaryRule, "id">): BoundaryRule {
  const newRule: BoundaryRule = { ...rule, id: `custom_${Date.now()}` };
  boundaries.push(newRule);
  return newRule;
}

export interface BoundaryCheckResult {
  passed: boolean;
  violations: Array<{ rule: BoundaryRule; context: string }>;
  warnings: Array<{ rule: BoundaryRule; context: string }>;
  escalations: Array<{ rule: BoundaryRule; context: string }>;
}

export function checkBoundaries(content: string, action?: string): BoundaryCheckResult {
  const result: BoundaryCheckResult = { passed: true, violations: [], warnings: [], escalations: [] };
  const lc = content.toLowerCase();

  for (const b of boundaries) {
    if (!b.enabled) continue;

    let violated = false;
    let context = "";

    // Topic checks
    if (b.id === "t1" && /\b(file.*tax|tax.*return|irs.*form|w-?2|1099)\b/.test(lc)) {
      violated = true; context = "Tax filing advice detected";
    }
    if (b.id === "t2" && /\b(legal.*advice|draft.*contract|sue|lawsuit|attorney)\b/.test(lc)) {
      violated = true; context = "Legal advice detected";
    }
    if (b.id === "t3" && /\b(you should (buy|sell|invest)|recommend.*stock|guaranteed.*return)\b/.test(lc)) {
      violated = true; context = "Specific investment recommendation without suitability";
    }

    // Action checks
    if (b.id === "a1" && action === "execute_trade") {
      violated = true; context = "Trade execution attempted";
    }
    if (b.id === "a3" && action === "send_communication") {
      violated = true; context = "Communication sending without confirmation";
    }

    // Safety checks
    if (b.id === "s1" && /\b(can't pay|bankrupt|desperate|no money|debt collector|foreclos)\b/.test(lc)) {
      violated = true; context = "Financial distress indicators detected";
    }

    if (violated) {
      if (b.severity === "block") {
        result.passed = false;
        result.violations.push({ rule: b, context });
      } else if (b.severity === "warn") {
        result.warnings.push({ rule: b, context });
      } else if (b.severity === "escalate") {
        result.escalations.push({ rule: b, context });
      }
    }
  }

  return result;
}

export function getBoundaryPromptInstructions(): string {
  const active = boundaries.filter(b => b.enabled);
  const lines = active.map(b => `- [${b.severity.toUpperCase()}] ${b.rule}`);
  return `## AI Boundaries\nYou MUST respect these boundaries:\n${lines.join("\n")}`;
}
