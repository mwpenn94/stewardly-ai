/**
 * Semantic agreement scorer — Round E2.
 *
 * Upgrades the consensus agreement metric from word-overlap Jaccard
 * (the existing `calculateAgreement` helper in `consensusStream.ts`)
 * to an LLM-as-judge approach:
 *
 *  1. Build a judge prompt that asks the model to score substantive
 *     agreement between 2+ model responses
 *  2. Call `contextualLLM` with a fast, cheap model (gemini-2.5-flash
 *     by default) so the judge call is ~1 second
 *  3. Parse the integer 0-100 score out of the response, clamp, and
 *     return as a 0..1 fraction
 *
 * No new dependencies — reuses Stewardly's existing model registry +
 * contextualLLM wiring.
 *
 * Design notes:
 *  - The prompt is tested separately from the LLM call so we can
 *    snapshot its exact text (the pure `buildAgreementJudgePrompt`
 *    helper)
 *  - `parseJudgeScore` is also pure and tested independently
 *  - `semanticAgreement` is the async wrapper that does the LLM call
 *  - On any failure (network error, malformed response, etc.) the
 *    function returns `null` so the caller can fall back to the
 *    Jaccard score — we never throw
 */

import { logger } from "../_core/logger";

const log = logger.child({ module: "semanticAgreement" });

// ─── Pure helpers ─────────────────────────────────────────────────────────

/**
 * Build the judge prompt. Pure — no LLM call, no side effects.
 * Deterministic so snapshot tests lock down the exact wording.
 */
export function buildAgreementJudgePrompt(
  responses: Array<{ modelId: string; content: string }>,
): string {
  const lines: string[] = [];
  lines.push(
    "You are evaluating how much two or more AI model responses agree on the substantive claims relevant to the user's question.",
  );
  lines.push("");
  lines.push("Responses:");
  lines.push("");
  for (const r of responses) {
    lines.push(`### ${r.modelId}`);
    lines.push("");
    lines.push(r.content.trim());
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push(
    "Produce a SINGLE line in the exact format `SCORE: N` where N is an integer 0-100:",
  );
  lines.push("");
  lines.push("- 100: All responses agree on every substantive claim");
  lines.push(
    "- 80: Minor differences in framing or detail, but the core recommendations align",
  );
  lines.push(
    "- 50: Half the responses support one conclusion, half support another",
  );
  lines.push(
    "- 20: Significant contradictions in recommended actions or factual claims",
  );
  lines.push(
    "- 0: The responses are entirely disjoint or directly contradict each other",
  );
  lines.push("");
  lines.push(
    "Ignore stylistic differences, wording, greetings, and caveats. Only score substantive alignment.",
  );
  lines.push(
    "Produce ONLY the `SCORE: N` line. Do not add any other text.",
  );
  return lines.join("\n");
}

/**
 * Parse the integer score out of the judge model's response. Returns
 * a 0..1 fraction when the parse succeeds, or `null` when the model
 * didn't follow the template.
 */
export function parseJudgeScore(text: string): number | null {
  if (!text || typeof text !== "string") return null;
  // Match SCORE: N on any line (case-insensitive, tolerant of whitespace)
  const match = text.match(/SCORE\s*:\s*(\d+)/i);
  if (!match) return null;
  const raw = Number(match[1]);
  if (!Number.isFinite(raw)) return null;
  const clamped = Math.max(0, Math.min(100, Math.round(raw)));
  return clamped / 100;
}

// ─── Async wrapper ────────────────────────────────────────────────────────

export interface SemanticAgreementOptions {
  /** Which model to use as the judge. Defaults to gemini-2.5-flash for speed. */
  judgeModelId?: string;
  /** User id for audit logging */
  userId?: number;
  /** Timeout in ms (default 8s) */
  timeoutMs?: number;
}

/**
 * Compute a semantic agreement score between 2+ responses via LLM-as-judge.
 * Returns `null` on any failure so the caller can fall back to the
 * word-overlap Jaccard metric.
 */
export async function semanticAgreement(
  responses: Array<{ modelId: string; content: string }>,
  options: SemanticAgreementOptions = {},
): Promise<number | null> {
  if (responses.length < 2) {
    // Single response is trivially self-consistent
    return responses.length === 1 ? 1 : 0;
  }

  try {
    const { contextualLLM } = await import("../shared/stewardlyWiring");
    const prompt = buildAgreementJudgePrompt(responses);
    const judgeModel = options.judgeModelId ?? "gemini-2.5-flash";

    // Race the LLM call against a timeout so a slow judge call
    // doesn't block the whole consensus run
    const timeoutMs = options.timeoutMs ?? 8000;
    const llmCall = contextualLLM({
      userId: options.userId,
      messages: [{ role: "user", content: prompt }],
      model: judgeModel,
    } as never);
    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });
    const result = await Promise.race([llmCall, timeout]);

    if (result === null) {
      log.warn({ judgeModel }, "semantic agreement judge timed out");
      return null;
    }

    const content =
      (result as { choices?: Array<{ message?: { content?: string } }> })
        ?.choices?.[0]?.message?.content ?? "";
    const parsed = parseJudgeScore(content);
    if (parsed === null) {
      log.warn(
        { judgeModel, content: content.slice(0, 200) },
        "semantic agreement judge returned unparseable response",
      );
      return null;
    }
    return parsed;
  } catch (err) {
    log.warn(
      { err },
      "semantic agreement judge failed — caller should fall back to Jaccard",
    );
    return null;
  }
}

/**
 * Combined agreement: computes both Jaccard (fast, deterministic) and
 * the semantic score (slow, accurate) concurrently and returns both.
 * Used by `runConsensus` so the UI can show whichever is more
 * informative.
 */
export interface CombinedAgreementResult {
  jaccard: number;
  semantic: number | null;
  /** Whichever score is non-null and most informative */
  best: number;
  source: "jaccard" | "semantic";
}

export async function combinedAgreement(
  responses: Array<{ modelId: string; content: string }>,
  jaccardScore: number,
  options: SemanticAgreementOptions = {},
): Promise<CombinedAgreementResult> {
  const semantic = await semanticAgreement(responses, options);
  return {
    jaccard: jaccardScore,
    semantic,
    best: semantic ?? jaccardScore,
    source: semantic !== null ? "semantic" : "jaccard",
  };
}
