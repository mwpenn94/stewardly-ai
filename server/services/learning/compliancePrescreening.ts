/**
 * §P1-4 Compliant Professional Peer Groups — Compliance Pre-screening
 * Extends the existing compliance copilot with peer group-specific screening.
 * Catches solicitation, investment advice, and regulatory violations.
 */
import { logger } from "../../_core/logger";

const log = logger.child({ service: "compliancePrescreening" });

/** Flagged phrase categories for peer group content */
const FLAGGED_PATTERNS: Array<{ pattern: RegExp; category: string; severity: "block" | "warn" }> = [
  // Solicitation patterns
  { pattern: /\b(buy|sell|invest in|purchase)\s+(my|our|this)\s+(fund|product|insurance|annuity|policy)/i, category: "solicitation", severity: "block" },
  { pattern: /\b(guaranteed|risk-free|no-risk)\s+(return|income|profit)/i, category: "misleading_claims", severity: "block" },
  { pattern: /\b(call me|contact me|reach out).*(discuss|talk about).*(invest|portfolio|insurance)/i, category: "solicitation", severity: "block" },
  { pattern: /\b(exclusive|limited time|act now|don't miss).*(opportunity|offer|deal)/i, category: "high_pressure", severity: "warn" },

  // Investment advice patterns
  { pattern: /\byou should (buy|sell|invest|allocate|move)/i, category: "unsolicited_advice", severity: "warn" },
  { pattern: /\b(hot tip|insider|sure thing|can't lose)/i, category: "misleading_claims", severity: "block" },
  { pattern: /\b(past performance|historical returns).*(guarantee|predict|ensure)/i, category: "misleading_claims", severity: "block" },

  // PII/confidential patterns
  { pattern: /\b(SSN|social security|account number|routing number)\b/i, category: "pii_exposure", severity: "block" },
  { pattern: /\b(client|customer)\s+(name|info|data|details|account)/i, category: "confidential_info", severity: "warn" },

  // Regulatory violations
  { pattern: /\b(FINRA|SEC|DOL|NAIC)\s+(doesn't|won't|can't)\s+(catch|find|know)/i, category: "regulatory_evasion", severity: "block" },
  { pattern: /\b(off the record|between us|don't tell|keep this quiet)/i, category: "concealment", severity: "warn" },

  // Compensation disclosure
  { pattern: /\b(commission|referral fee|kickback|finder's fee)\b/i, category: "undisclosed_compensation", severity: "warn" },
];

export interface ScreeningResult {
  approved: boolean;
  flagged: boolean;
  violations: Array<{
    category: string;
    severity: "block" | "warn";
    matchedText: string;
    position: number;
  }>;
  sanitizedContent?: string;
  reviewRequired: boolean;
}

/**
 * Pre-screen peer group content for compliance violations.
 * Returns screening result with any flagged content.
 */
export function prescreenContent(content: string): ScreeningResult {
  const violations: ScreeningResult["violations"] = [];

  for (const { pattern, category, severity } of FLAGGED_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      violations.push({
        category,
        severity,
        matchedText: match[0],
        position: match.index ?? 0,
      });
    }
  }

  const hasBlocking = violations.some(v => v.severity === "block");
  const hasWarning = violations.some(v => v.severity === "warn");

  const result: ScreeningResult = {
    approved: !hasBlocking,
    flagged: violations.length > 0,
    violations,
    reviewRequired: hasWarning && !hasBlocking,
  };

  if (violations.length > 0) {
    log.info({
      violationCount: violations.length,
      categories: [...new Set(violations.map(v => v.category))],
      blocked: hasBlocking,
    }, "Peer group content flagged");
  }

  return result;
}

/**
 * Batch pre-screen multiple posts (e.g., for testing with 200-post test set).
 * Returns aggregate stats.
 */
export function batchPrescreen(posts: string[]): {
  total: number;
  blocked: number;
  warned: number;
  approved: number;
  flagRate: number;
  results: ScreeningResult[];
} {
  const results = posts.map(prescreenContent);
  const blocked = results.filter(r => !r.approved).length;
  const warned = results.filter(r => r.reviewRequired).length;
  const approved = results.filter(r => r.approved && !r.flagged).length;

  return {
    total: posts.length,
    blocked,
    warned,
    approved,
    flagRate: (blocked + warned) / posts.length,
    results,
  };
}

/**
 * Check if a user has the required role for peer group access.
 * Peer groups are advisor+ only (compliance-gated variant).
 */
export function isAdvisorOrAbove(role: string): boolean {
  const allowedRoles = ["advisor", "admin", "owner", "compliance_officer"];
  return allowedRoles.includes(role.toLowerCase());
}
