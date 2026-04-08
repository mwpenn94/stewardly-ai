/**
 * Consensus stream service — Round C2.
 *
 * Sibling to the existing `consensusLLM.ts` (kept untouched). Adds:
 *
 *  1. `runConsensus(opts)` — async function that returns the full
 *     event log + final synthesis. The tRPC procedure uses this.
 *  2. `streamConsensus(opts, emit)` — same core but emits events as
 *     they happen so a future Express SSE endpoint can stream them.
 *  3. Pure helpers (`buildSynthesisPrompt`, `pickConsensusModels`,
 *     `encodeSseEvent`) that are unit-testable without an LLM.
 *
 * Why a sibling instead of modifying consensusLLM.ts:
 *  - Existing callers (`advancedIntelligence.consensusQuery` mutation
 *    + `chatRouter`) keep working unchanged.
 *  - The new path supports per-model weights, named selection, real
 *    timing capture, and an LLM-based synthesis merge with "Key
 *    Agreements / Notable Differences" sections.
 *  - Lower diff risk in this round; convergence + tests pass without
 *    touching the existing surface.
 */

import {
  selectModelsWithinTimeBudget,
  getModelEstimatedResponseMs,
  SYNTHESIS_OVERHEAD_MS,
  type ModelEntry,
} from "../shared/config/modelRegistry";
import { logger } from "../_core/logger";

const log = logger.child({ module: "consensusStream" });

// ─── Event types ──────────────────────────────────────────────────────────
// Match the synthesizer's SSE event names exactly so a downstream UI port
// of the StreamingResults / TimingBreakdown components is mechanical.

export type ConsensusEvent =
  | { type: "model_start"; modelId: string; ts: number }
  | {
      type: "model_complete";
      modelId: string;
      ts: number;
      durationMs: number;
      content: string;
      tokenCount: number;
    }
  | { type: "model_error"; modelId: string; ts: number; error: string }
  | { type: "synthesis_start"; ts: number; modelsCompleted: number }
  | {
      type: "synthesis_complete";
      ts: number;
      durationMs: number;
      content: string;
      agreementScore: number;
      keyAgreements: string[];
      notableDifferences: string[];
    }
  | {
      type: "done";
      ts: number;
      totalDurationMs: number;
      modelQueryTimeMs: number;
      synthesisTimeMs: number;
      modelsUsed: string[];
    }
  | { type: "error"; ts: number; error: string };

// ─── Pure helper: SSE encoder ─────────────────────────────────────────────
// Returns the wire-format string an Express handler would write to
// `res.write(...)`. Tested independently so the future SSE endpoint can
// trust the encoding.

export function encodeSseEvent(event: ConsensusEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// ─── Pure helper: synthesis prompt builder ────────────────────────────────
// Builds the prompt that the synthesis model receives. Pure so we can
// snapshot-test the exact text and verify weight injection. The
// audit-recommended template asks for (1) unified answer, (2) Key
// Agreements section, (3) Notable Differences section in markdown.

export interface ModelResponseForSynthesis {
  modelId: string;
  content: string;
  /** Optional 0-100 weight for the merge prompt */
  weight?: number;
}

export interface SynthesisPromptInput {
  question: string;
  responses: ModelResponseForSynthesis[];
  /** Optional domain hint that biases the merge prompt */
  domain?: string;
}

export function buildSynthesisPrompt(input: SynthesisPromptInput): string {
  const lines: string[] = [];
  lines.push(
    "You are a financial advisory synthesis model. The user asked the following question:",
  );
  lines.push("");
  lines.push(`> ${input.question}`);
  lines.push("");
  lines.push(
    `Below are responses from ${input.responses.length} different AI models. Each may have a weight from 1-100 indicating how much its perspective should influence the unified answer. A weight of 100 means the model should dominate; a weight of 10 means it should only contribute minor details. When weights are absent, treat all models equally.`,
  );

  if (input.domain) {
    lines.push("");
    lines.push(
      `Domain context: this question relates to **${input.domain}**. Apply domain-appropriate caution and citation.`,
    );
  }

  lines.push("");
  for (const r of input.responses) {
    const weightStr = r.weight !== undefined ? ` (weight ${r.weight})` : "";
    lines.push(`### ${r.modelId}${weightStr}`);
    lines.push("");
    lines.push(r.content.trim());
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("Produce your response with EXACTLY these three markdown sections:");
  lines.push("");
  lines.push("## Unified Answer");
  lines.push("A single cohesive answer that incorporates the strongest points from each model, weighted as instructed above. Be specific.");
  lines.push("");
  lines.push("## Key Agreements");
  lines.push(
    "A bulleted list of statements ALL models concur on. Mark each agreement with the number of models that asserted it.",
  );
  lines.push("");
  lines.push("## Notable Differences");
  lines.push(
    "A bulleted list of meaningful disagreements between models. For each, name the models on each side. If there are no meaningful differences, write 'None — all models agree on the substantive points.'",
  );
  lines.push("");
  lines.push(
    "End with a one-line `_summary:` field giving a 0-100 confidence score that the unified answer is correct.",
  );

  return lines.join("\n");
}

// ─── Pure helper: pick consensus models ──────────────────────────────────
// Honors a user-supplied list, falls back to the default 3-model trio
// (Claude/GPT/Gemini), and runs the time-budget filter when a budget
// is supplied.

export interface PickModelsInput {
  /** Caller-supplied model IDs (takes precedence over defaults) */
  selectedModels?: string[];
  /** Latency budget in ms (optional). When set, filters via
   *  selectModelsWithinTimeBudget. */
  timeBudgetMs?: number;
  /** Maximum models to include */
  maxModels?: number;
  /** Minimum models required for a true consensus */
  minModels?: number;
}

export const DEFAULT_CONSENSUS_MODELS = [
  "claude-sonnet-4-20250514",
  "gpt-4o",
  "gemini-2.5-pro",
];

export function pickConsensusModels(opts: PickModelsInput): {
  selected: string[];
  fits: boolean;
  rationale: string;
} {
  const candidates = opts.selectedModels?.length
    ? opts.selectedModels
    : DEFAULT_CONSENSUS_MODELS;

  if (!opts.timeBudgetMs) {
    const cap = opts.maxModels ?? candidates.length;
    return {
      selected: candidates.slice(0, cap),
      fits: true,
      rationale: `Used ${Math.min(cap, candidates.length)} ${opts.selectedModels?.length ? "user-selected" : "default"} models (no time budget).`,
    };
  }

  const result = selectModelsWithinTimeBudget(candidates, opts.timeBudgetMs, {
    maxModels: opts.maxModels,
    minModels: opts.minModels,
  });
  return {
    selected: result.selected,
    fits: result.fits,
    rationale: `Selected ${result.selected.length}/${candidates.length} models within ${opts.timeBudgetMs}ms budget (estimated ${result.totalEstimatedMs}ms incl. ${SYNTHESIS_OVERHEAD_MS}ms synthesis overhead).`,
  };
}

// ─── Pure helper: word-overlap agreement ──────────────────────────────────
// Same heuristic the existing consensusLLM uses (Jaccard on words >3
// chars). Exported here so the streaming variant doesn't have to
// import from the legacy file.

export function calculateAgreement(a: string, b: string): number {
  if (!a || !b) return 0;
  const wordsA = new Set(
    a
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
  const wordsB = new Set(
    b
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
  const intersection = Array.from(wordsA).filter((w) => wordsB.has(w));
  const union = new Set(Array.from(wordsA).concat(Array.from(wordsB)));
  return union.size > 0 ? intersection.length / union.size : 0;
}

// ─── Pure helper: parse synthesis output ──────────────────────────────────
// Extracts the structured sections from the synthesis model's response.
// We're permissive — if the model doesn't follow the template exactly,
// we degrade gracefully rather than rejecting.

export function parseSynthesisOutput(text: string): {
  unifiedAnswer: string;
  keyAgreements: string[];
  notableDifferences: string[];
  confidenceScore: number;
} {
  const sections: Record<string, string> = {};
  // Match "## Section Name" headers
  const lines = text.split("\n");
  let currentSection = "";
  let currentBuffer: string[] = [];
  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      if (currentSection) {
        sections[currentSection.toLowerCase()] = currentBuffer.join("\n").trim();
      }
      currentSection = headerMatch[1].trim();
      currentBuffer = [];
    } else {
      currentBuffer.push(line);
    }
  }
  if (currentSection) {
    sections[currentSection.toLowerCase()] = currentBuffer.join("\n").trim();
  }

  // Strip the trailing _summary: line and extract confidence
  let confidenceScore = 0;
  const summaryMatch = text.match(/_summary:\s*(\d+)/i);
  if (summaryMatch) {
    confidenceScore = Math.min(100, Math.max(0, Number(summaryMatch[1]))) / 100;
  }

  const extractBullets = (s?: string): string[] => {
    if (!s) return [];
    return s
      .split("\n")
      .filter((l) => /^\s*[-*]\s+/.test(l))
      .map((l) => l.replace(/^\s*[-*]\s+/, "").trim())
      .filter((l) => l.length > 0);
  };

  return {
    unifiedAnswer: sections["unified answer"] ?? text,
    keyAgreements: extractBullets(sections["key agreements"]),
    notableDifferences: extractBullets(sections["notable differences"]),
    confidenceScore,
  };
}

// ─── Public API: runConsensus ─────────────────────────────────────────────
// One-shot version that returns the complete event log + final result.
// Used by the tRPC procedure. Internally just calls streamConsensus
// with an in-memory event collector.

export interface RunConsensusInput {
  question: string;
  /** Original message history to send to each model */
  messages?: Array<{ role: string; content: unknown }>;
  /** Per-model weights 1-100 (optional) */
  modelWeights?: Record<string, number>;
  /** Specific models to use (overrides defaults) */
  selectedModels?: string[];
  timeBudgetMs?: number;
  maxModels?: number;
  domain?: string;
  userId?: number;
}

export interface RunConsensusResult {
  events: ConsensusEvent[];
  modelsUsed: string[];
  perModelResponses: Array<{
    modelId: string;
    content: string;
    durationMs: number;
    error?: string;
  }>;
  synthesisContent: string;
  unifiedAnswer: string;
  keyAgreements: string[];
  notableDifferences: string[];
  agreementScore: number;
  /** Round E2 — semantic agreement (LLM-as-judge). null when the judge
   *  call failed or was skipped; callers should fall back to agreementScore. */
  semanticAgreementScore: number | null;
  /** Which scorer was used for the displayed agreement */
  agreementScorerSource: "jaccard" | "semantic";
  confidenceScore: number;
  totalDurationMs: number;
  modelQueryTimeMs: number;
  synthesisTimeMs: number;
  rationale: string;
  fits: boolean;
}

export async function runConsensus(
  input: RunConsensusInput,
): Promise<RunConsensusResult> {
  const events: ConsensusEvent[] = [];
  const result = await streamConsensus(input, (e) => {
    events.push(e);
  });
  return { ...result, events };
}

// ─── Public API: streamConsensus ──────────────────────────────────────────
// Core implementation. Calls each model in parallel, captures timings,
// emits events as the work happens, then runs the synthesis merge.

export type ConsensusEmit = (event: ConsensusEvent) => void;

export async function streamConsensus(
  input: RunConsensusInput,
  emit: ConsensusEmit,
): Promise<Omit<RunConsensusResult, "events">> {
  const overallStart = Date.now();
  const pick = pickConsensusModels({
    selectedModels: input.selectedModels,
    timeBudgetMs: input.timeBudgetMs,
    maxModels: input.maxModels ?? 3,
    minModels: 1,
  });
  const modelsToCall = pick.selected;

  // Lazy-import contextualLLM to avoid pulling stewardlyWiring during
  // unit tests of the pure helpers.
  const { contextualLLM } = await import("../shared/stewardlyWiring");

  // Per-model parallel fan-out
  const modelStart = Date.now();
  const perModelResponses: RunConsensusResult["perModelResponses"] = [];
  await Promise.all(
    modelsToCall.map(async (modelId) => {
      const startedAt = Date.now();
      emit({ type: "model_start", modelId, ts: startedAt });
      try {
        const baseMessages =
          input.messages ?? [{ role: "user", content: input.question }];
        const result = await contextualLLM({
          userId: input.userId,
          messages: baseMessages,
          model: modelId,
        } as never);
        const content = (result as { choices?: Array<{ message?: { content?: string } }> })
          ?.choices?.[0]?.message?.content ?? "";
        const tokenCount = Math.ceil(content.length / 4);
        const completedAt = Date.now();
        const durationMs = completedAt - startedAt;
        perModelResponses.push({ modelId, content, durationMs });
        emit({
          type: "model_complete",
          modelId,
          ts: completedAt,
          durationMs,
          content,
          tokenCount,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown";
        perModelResponses.push({
          modelId,
          content: "",
          durationMs: Date.now() - startedAt,
          error: message,
        });
        emit({ type: "model_error", modelId, ts: Date.now(), error: message });
      }
    }),
  );
  const modelQueryTimeMs = Date.now() - modelStart;

  const successfulResponses = perModelResponses.filter(
    (r) => r.content && !r.error,
  );

  // Compute pairwise agreement (first two responses) for the score
  let agreementScore = 0;
  if (successfulResponses.length >= 2) {
    agreementScore = calculateAgreement(
      successfulResponses[0].content,
      successfulResponses[1].content,
    );
  } else if (successfulResponses.length === 1) {
    agreementScore = 1; // single response is trivially "self-consistent"
  }

  // Synthesis merge (only when we have 2+ responses)
  emit({
    type: "synthesis_start",
    ts: Date.now(),
    modelsCompleted: successfulResponses.length,
  });
  const synthesisStart = Date.now();

  let synthesisContent = "";
  let parsed: ReturnType<typeof parseSynthesisOutput> = {
    unifiedAnswer: successfulResponses[0]?.content ?? "",
    keyAgreements: [],
    notableDifferences: [],
    confidenceScore: agreementScore,
  };

  if (successfulResponses.length >= 2) {
    const synthesisPrompt = buildSynthesisPrompt({
      question: input.question,
      responses: successfulResponses.map((r) => ({
        modelId: r.modelId,
        content: r.content,
        weight: input.modelWeights?.[r.modelId],
      })),
      domain: input.domain,
    });
    try {
      const synthesisResult = await contextualLLM({
        userId: input.userId,
        messages: [{ role: "user", content: synthesisPrompt }],
      } as never);
      synthesisContent =
        (synthesisResult as { choices?: Array<{ message?: { content?: string } }> })
          ?.choices?.[0]?.message?.content ?? "";
      parsed = parseSynthesisOutput(synthesisContent);
    } catch (err) {
      log.error({ err }, "synthesis merge failed — falling back to first response");
      synthesisContent = successfulResponses[0].content;
      parsed = {
        unifiedAnswer: synthesisContent,
        keyAgreements: [],
        notableDifferences: [],
        confidenceScore: agreementScore,
      };
    }
  } else if (successfulResponses.length === 1) {
    synthesisContent = successfulResponses[0].content;
    parsed.unifiedAnswer = synthesisContent;
  } else {
    synthesisContent = "";
  }

  const synthesisTimeMs = Date.now() - synthesisStart;
  emit({
    type: "synthesis_complete",
    ts: Date.now(),
    durationMs: synthesisTimeMs,
    content: synthesisContent,
    agreementScore,
    keyAgreements: parsed.keyAgreements,
    notableDifferences: parsed.notableDifferences,
  });

  // Round E2 — compute semantic agreement via LLM-as-judge. Runs in
  // parallel with the done event so it doesn't add to the critical path
  // most of the time. Falls back to Jaccard when the judge fails.
  let semanticAgreementScore: number | null = null;
  let agreementScorerSource: "jaccard" | "semantic" = "jaccard";
  if (successfulResponses.length >= 2) {
    try {
      const { semanticAgreement } = await import("./semanticAgreement");
      semanticAgreementScore = await semanticAgreement(
        successfulResponses.map((r) => ({ modelId: r.modelId, content: r.content })),
        { userId: input.userId },
      );
      if (semanticAgreementScore !== null) {
        agreementScorerSource = "semantic";
      }
    } catch (err) {
      log.warn({ err }, "semantic agreement scorer unavailable");
    }
  }

  const totalDurationMs = Date.now() - overallStart;
  emit({
    type: "done",
    ts: Date.now(),
    totalDurationMs,
    modelQueryTimeMs,
    synthesisTimeMs,
    modelsUsed: modelsToCall,
  });

  return {
    modelsUsed: modelsToCall,
    perModelResponses,
    synthesisContent,
    unifiedAnswer: parsed.unifiedAnswer,
    keyAgreements: parsed.keyAgreements,
    notableDifferences: parsed.notableDifferences,
    agreementScore: semanticAgreementScore ?? agreementScore,
    semanticAgreementScore,
    agreementScorerSource,
    confidenceScore: parsed.confidenceScore,
    totalDurationMs,
    modelQueryTimeMs,
    synthesisTimeMs,
    rationale: pick.rationale,
    fits: pick.fits,
  };
}

// Re-export for tests / docs
export type { ModelEntry };
