/**
 * Wealth-chat safety / compliance wrappers — Phase 6E.
 *
 * Every wealth-engine response delivered through the chat surface must:
 *  - Never use directive financial advice phrasing ("you should buy...")
 *  - Always include a "this is a simulation, not advice" disclaimer
 *  - Be logged via the existing model_runs persistence so FINRA 17a-4
 *    record-keeping is satisfied
 *  - Generate a Reg BI rationale when a recommendation is surfaced
 *
 * The functions in this module are pure rewriters and audit helpers
 * the chat handlers (Phase 6A) call before sending text to the user.
 */

import { logger } from "../../_core/logger";

export const NO_ADVICE_DISCLAIMER =
  "This is a simulation, not financial advice. Consult your financial advisor before making decisions.";

// ─── Phrase scrubber ──────────────────────────────────────────────────────
// Rewrites directive language ("you should...", "I recommend...", etc.)
// into neutral observational phrasing ("the projection shows...").

const PHRASE_REWRITES: Array<[RegExp, string]> = [
  [/\byou should\b/gi, "the projection shows"],
  [/\bI recommend\b/gi, "the model suggests"],
  [/\byou must\b/gi, "the engine indicates"],
  [/\byou need to\b/gi, "the model suggests you may want to"],
  [/\bguaranteed\b/gi, "projected"],
  [/\bcertain\b/gi, "modeled"],
  [/\bwill earn\b/gi, "is projected to earn"],
  [/\bwill grow\b/gi, "is projected to grow"],
  [/\bwill make\b/gi, "is projected to produce"],
];

export function scrubDirectivePhrasing(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PHRASE_REWRITES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Append the standard disclaimer if it's not already present. Used
 * before sending any chat message that contains numeric projections
 * or recommendations.
 */
export function ensureDisclaimer(text: string): string {
  if (text.includes("simulation, not financial advice")) return text;
  return `${text.trim()}\n\n${NO_ADVICE_DISCLAIMER}`;
}

/**
 * Combined safety pass — apply both rewriter and disclaimer in one
 * call. Public API the chat handlers should use.
 */
export function safetyWrap(text: string): string {
  return ensureDisclaimer(scrubDirectivePhrasing(text));
}

// ─── Banned topics (immediate refusal) ────────────────────────────────────
// We refuse to recommend specific securities, time the market, or
// promise guaranteed outcomes. The chat handler checks the user's
// query against this list and short-circuits with a refusal message
// before any tool call.

const BANNED_TOPIC_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(should I (buy|sell)|recommend.*(stock|ticker)|pick.*(stock))\b/i,
    reason: "specific_security_recommendation",
  },
  {
    pattern: /\bguaranteed return\b/i,
    reason: "guaranteed_return_claim",
  },
  {
    pattern: /\bmarket timing\b/i,
    reason: "market_timing",
  },
];

export function detectBannedTopic(
  userMessage: string,
): { banned: true; reason: string } | { banned: false } {
  for (const { pattern, reason } of BANNED_TOPIC_PATTERNS) {
    if (pattern.test(userMessage)) return { banned: true, reason };
  }
  return { banned: false };
}

export const REFUSAL_MESSAGES: Record<string, string> = {
  specific_security_recommendation:
    "I can't recommend specific securities or tell you whether to buy or sell. I can run a strategy comparison or projection — would you like to do that instead?",
  guaranteed_return_claim:
    "Investment returns are never guaranteed — I can't make that claim. I can show you Monte Carlo confidence bands so you can see the range of likely outcomes.",
  market_timing:
    "Timing the market is not something I can advise on. I can show you long-horizon projections and stress tests across historical scenarios.",
};

// ─── FINRA logging helper ─────────────────────────────────────────────────
// Records every chat exchange involving a wealth-engine tool call so the
// 17a-4 record-keeping requirement is satisfied. We persist via the
// existing model_runs infrastructure (added in Phase 2A) by reusing
// the calculatorPersistence helper.

export interface ComplianceLogEntry {
  userId?: number;
  clientId?: string;
  sessionId?: string;
  userMessage: string;
  toolCalled?: string;
  responseSummary: string;
  contained: { recommendation: boolean; projection: boolean };
}

export async function logComplianceEvent(
  entry: ComplianceLogEntry,
): Promise<void> {
  // Lazy-import the persistence helper to keep this module dep-light.
  const { persistComputation } = await import(
    "../agent/calculatorPersistence"
  );
  try {
    await persistComputation({
      tool: "he.findWinners", // reuse slug; the entry payload carries the kind
      input: {
        kind: "compliance_log",
        userMessage: entry.userMessage.slice(0, 500),
        toolCalled: entry.toolCalled,
      },
      result: {
        responseSummary: entry.responseSummary.slice(0, 1000),
        contained: entry.contained,
      },
      durationMs: 0,
      meta: {
        userId: entry.userId,
        clientId: entry.clientId,
        sessionId: entry.sessionId,
        trigger: "user_chat",
      },
    });
  } catch (err) {
    logger.warn({ err }, "compliance log persist failed (non-blocking)");
  }
}

// ─── Reg BI rationale generator ──────────────────────────────────────────
// When a recommendation is surfaced, we auto-generate a 1-paragraph
// rationale that the regBIDocumentation service can pin to the
// client's record.

export function buildRegBIRationale(
  recommendation: string,
  drivers: Array<{ name: string; value: string }>,
): string {
  const driverList = drivers.map((d) => `${d.name}: ${d.value}`).join("; ");
  return [
    `Recommendation: ${recommendation}.`,
    `Best-interest analysis driven by: ${driverList}.`,
    `Generated by Stewardly wealth-engine on ${new Date().toISOString()}.`,
    NO_ADVICE_DISCLAIMER,
  ].join(" ");
}
