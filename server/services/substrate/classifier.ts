/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Substrate Primitive: Classifier
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Rule-based content classifier. Deterministic, no network calls, no ML model.
 * Classifies content for:
 *   - Sensitivity level (determines routing tier: LOCAL > AUTO > CLOUD)
 *   - Task type (determines model selection)
 *   - Complexity (determines cost tier)
 *   - Domain (determines engine routing)
 *
 * Design decisions:
 *   - Rule-based (not ML) for auditability and determinism
 *   - No network calls — runs entirely in-process
 *   - Extensible via pattern registry
 *   - False-negative-safe: when in doubt, classify as MORE sensitive
 *
 * @substrate-primitive: classifier
 * @absorbed-from: manus-next-app/server/services/aegis.ts (classifyTask)
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "substrate:classifier" });

// ─── Types ───────────────────────────────────────────────────────────────────

export type SensitivityLevel = "public" | "internal" | "confidential" | "restricted";
export type RoutingTier = "LOCAL" | "AUTO" | "CLOUD";
export type TaskType = "chat" | "analysis" | "research" | "planning" | "compliance" | "code" | "creative" | "quick" | "reasoning";
export type Complexity = "trivial" | "simple" | "moderate" | "complex" | "expert";
export type Domain = "wealth" | "learning" | "people" | "intelligence" | "general";

export interface ClassificationResult {
  sensitivity: SensitivityLevel;
  routingTier: RoutingTier;
  taskType: TaskType;
  complexity: Complexity;
  domain: Domain;
  confidence: number;
  flags: string[];
}

// ─── Sensitivity Patterns ────────────────────────────────────────────────────

interface SensitivityPattern {
  name: string;
  pattern: RegExp;
  level: SensitivityLevel;
}

const SENSITIVITY_PATTERNS: SensitivityPattern[] = [
  // Restricted — PII, credentials, financial account numbers
  { name: "ssn", pattern: /\b\d{3}-?\d{2}-?\d{4}\b/, level: "restricted" },
  { name: "credit_card", pattern: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, level: "restricted" },
  { name: "account_number", pattern: /\b(?:account|acct)[#: ]*\d{8,17}\b/i, level: "restricted" },
  { name: "routing_number", pattern: /\b\d{9}\b(?=.*(?:routing|ABA|transit))/i, level: "restricted" },
  { name: "api_key", pattern: /(?:sk|pk|api)[_-][a-zA-Z0-9]{20,}/i, level: "restricted" },

  // Confidential — personal financial details, health, legal
  { name: "salary", pattern: /\b(?:salary|income|compensation|earnings)\b.*\$[\d,]+/i, level: "confidential" },
  { name: "net_worth", pattern: /\b(?:net\s*worth|total\s*assets|portfolio\s*value)\b.*\$[\d,]+/i, level: "confidential" },
  { name: "medical", pattern: /\b(?:diagnosis|prescription|medical\s*record|health\s*condition|disability)\b/i, level: "confidential" },
  { name: "legal_case", pattern: /\b(?:lawsuit|litigation|settlement|court\s*order|subpoena)\b/i, level: "confidential" },
  { name: "tax_return", pattern: /\b(?:tax\s*return|1040|W-?2|1099|K-?1)\b/i, level: "confidential" },
  { name: "estate_plan", pattern: /\b(?:trust\s*document|will\s*and\s*testament|beneficiary|power\s*of\s*attorney)\b/i, level: "confidential" },

  // Internal — business-specific, client names, strategies
  { name: "client_name", pattern: /\b(?:client|prospect|lead)\s*(?:name|:)\s*[A-Z][a-z]+/i, level: "internal" },
  { name: "strategy", pattern: /\b(?:proprietary|confidential|internal\s*only|not\s*for\s*distribution)\b/i, level: "internal" },
  { name: "aum", pattern: /\b(?:AUM|assets\s*under\s*management)\b/i, level: "internal" },
];

// ─── Task Type Keywords ──────────────────────────────────────────────────────

const TASK_TYPE_KEYWORDS: Record<TaskType, string[]> = {
  code: ["code", "function", "implement", "debug", "refactor", "typescript", "javascript", "python", "api", "endpoint"],
  research: ["research", "analyze", "compare", "investigate", "study", "review", "survey", "literature"],
  analysis: ["data", "csv", "json", "parse", "transform", "aggregate", "statistics", "chart", "financial analysis"],
  planning: ["plan", "roadmap", "strategy", "timeline", "milestone", "schedule", "retirement", "goal"],
  compliance: ["compliance", "regulatory", "audit", "disclosure", "fiduciary", "suitability", "ADV"],
  creative: ["write", "draft", "compose", "essay", "article", "blog", "report", "marketing"],
  reasoning: ["explain", "why", "reason", "deduce", "prove", "logic", "complex", "multi-step"],
  chat: ["chat", "help", "what", "how", "tell me", "hi", "hello", "thanks"],
  quick: ["quick", "simple", "yes or no", "one word", "brief"],
};

// ─── Domain Keywords ─────────────────────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  wealth: ["investment", "invest", "portfolio", "retirement", "estate", "tax", "insurance", "annuity", "401k", "IRA", "Roth", "stock", "bond", "mutual fund", "ETF", "rebalance", "allocation", "financial plan", "account", "balance", "capital gains", "wealth", "bitcoin", "crypto", "money", "savings", "budget", "income", "dividend", "financial"],
  learning: ["study", "course", "exam", "certification", "CFP", "CFA", "Series", "CE credit", "curriculum", "lesson", "quiz", "assessment", "training"],
  people: ["client", "prospect", "lead", "contact", "relationship", "referral", "team", "organization", "CRM", "pipeline", "meeting", "appointment"],
  intelligence: ["search", "research", "market", "trend", "news", "analysis", "compare", "benchmark", "data"],
  general: [],
};

// ─── Complexity Thresholds ───────────────────────────────────────────────────

const COMPLEXITY_THRESHOLDS: Record<Complexity, number> = {
  trivial: 30,
  simple: 100,
  moderate: 300,
  complex: 800,
  expert: Infinity,
};

// ─── Core Classification ─────────────────────────────────────────────────────

/**
 * Classify a text input across all dimensions.
 * Deterministic, no network, no side effects.
 */
export function classify(text: string): ClassificationResult {
  const flags: string[] = [];

  // 1. Sensitivity classification
  let sensitivity: SensitivityLevel = "public";
  for (const { name, pattern, level } of SENSITIVITY_PATTERNS) {
    if (pattern.test(text)) {
      flags.push(`sensitivity:${name}`);
      const levels: SensitivityLevel[] = ["public", "internal", "confidential", "restricted"];
      if (levels.indexOf(level) > levels.indexOf(sensitivity)) {
        sensitivity = level;
      }
    }
  }

  // 2. Routing tier (derived from sensitivity)
  const routingTier = sensitivityToTier(sensitivity);

  // 3. Task type classification
  const lower = text.toLowerCase();
  let taskType: TaskType = "chat";
  let bestScore = 0;
  for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
    const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      taskType = type as TaskType;
    }
  }

  // 4. Complexity classification
  const wordCount = text.split(/\s+/).length;
  let complexity: Complexity = "trivial";
  for (const [level, threshold] of Object.entries(COMPLEXITY_THRESHOLDS)) {
    if (wordCount <= threshold) {
      complexity = level as Complexity;
      break;
    }
  }

  // 5. Domain classification
  let domain: Domain = "general";
  let domainBestScore = 0;
  for (const [d, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw.toLowerCase()) ? 1 : 0), 0);
    if (score > domainBestScore) {
      domainBestScore = score;
      domain = d as Domain;
    }
  }

  // 6. Confidence (higher when more patterns match)
  const confidence = Math.min(1, 0.5 + bestScore * 0.1 + domainBestScore * 0.05);

  return { sensitivity, routingTier, taskType, complexity, domain, confidence, flags };
}

/**
 * Map sensitivity level to routing tier.
 * restricted/confidential → LOCAL (never leaves user's environment)
 * internal → AUTO (platform decides based on BYO availability)
 * public → CLOUD (safe for any provider)
 */
function sensitivityToTier(sensitivity: SensitivityLevel): RoutingTier {
  switch (sensitivity) {
    case "restricted":
    case "confidential":
      return "LOCAL";
    case "internal":
      return "AUTO";
    case "public":
      return "CLOUD";
  }
}

/**
 * Quick sensitivity check — returns true if content should NOT be sent to cloud.
 */
export function isSensitive(text: string): boolean {
  const result = classify(text);
  return result.routingTier === "LOCAL";
}

/**
 * Get the routing tier for a text without full classification.
 */
export function getRoutingTier(text: string): RoutingTier {
  return classify(text).routingTier;
}
