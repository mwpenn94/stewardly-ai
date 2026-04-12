/**
 * Cross-Model Distillation
 *
 * When Stewardly runs a prompt through multiple models in Consensus mode
 * (Pass 2 of the Wealth Engine round C), we get N different outputs for the
 * same question. The existing consensusStream.ts handles agreement scoring
 * at the paragraph level. This module goes one layer deeper: it EXTRACTS
 * the claims each model makes, scores agreement across claims, and produces
 * a "distilled" training-ready output that the continuous training loop
 * can fold back into the ragTrainer / templateOptimizer.
 *
 * The big idea: when 3 frontier models independently agree on a claim,
 * that claim is much more likely to be correct than any individual model's
 * output. By extracting these high-agreement claims into training examples,
 * Stewardly's own templates can be optimized without paying for human
 * labeling — the models label each other.
 *
 * Pure-function module. No I/O. No LLM calls. Operates on already-gathered
 * multi-model outputs.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ModelOutput {
  model: string;              // model ID (e.g. "claude-opus-4-6", "gpt-4o")
  text: string;               // full response text
  latencyMs?: number;
  costUsd?: number;
  tokenCount?: number;
}

export interface ClaimExtraction {
  text: string;               // original claim sentence
  normalized: string;         // lowercased, whitespace-normalized
  model: string;              // which model produced it
}

export interface ConsensusClaim {
  normalized: string;         // canonical form
  examples: string[];         // original phrasings (one per model)
  agreeingModels: string[];
  agreementRatio: number;     // agreeingModels / totalModels
}

export interface DistillationResult {
  totalModels: number;
  totalClaims: number;
  uniqueClaims: number;
  consensusClaims: ConsensusClaim[];       // claims agreed on by ≥ threshold
  contestedClaims: ConsensusClaim[];       // claims agreed on by < threshold but > 1
  uniqueToOneModel: ConsensusClaim[];      // claims only one model made
  agreementScore: number;                  // 0..1 overall
  confidence: number;                      // composite score, weighted
}

export interface DistillationOptions {
  consensusThreshold?: number;             // fraction of models required (default 0.67)
  minClaimLength?: number;                 // chars (default 12)
  maxClaimLength?: number;                 // chars (default 500)
  ignoreFillerPhrases?: boolean;           // strip "In my opinion" etc (default true)
}

// ─── Claim extraction ─────────────────────────────────────────────────────

const FILLER_PREFIXES = [
  "in my opinion",
  "i think",
  "i believe",
  "note that",
  "please note",
  "it is worth noting",
  "it is important to",
  "additionally",
  "furthermore",
  "moreover",
  "however",
  "on the other hand",
  "in conclusion",
  "to summarize",
  "in summary",
  "overall",
  "finally",
];

const SENTENCE_TERMINATORS = /[.!?]\s+/;

export function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  const cleaned = text.replace(/\n+/g, " ").trim();
  if (!cleaned) return [];
  // Split on sentence terminators while preserving meaningful boundaries
  const pieces = cleaned.split(SENTENCE_TERMINATORS);
  return pieces
    .map((s) => s.trim().replace(/[.!?]+$/, "").trim())
    .filter(Boolean);
}

export function normalizeClaim(raw: string, options: DistillationOptions = {}): string {
  const ignoreFiller = options.ignoreFillerPhrases ?? true;
  let s = raw.trim().toLowerCase();

  // Strip leading filler phrases
  if (ignoreFiller) {
    for (const filler of FILLER_PREFIXES) {
      if (s.startsWith(filler + ",") || s.startsWith(filler + " ") || s === filler) {
        s = s.slice(filler.length).replace(/^[,\s]+/, "");
      }
    }
  }

  // Normalize whitespace + strip trailing punctuation
  s = s.replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "").trim();
  return s;
}

export function extractClaims(output: ModelOutput, options: DistillationOptions = {}): ClaimExtraction[] {
  const minLength = options.minClaimLength ?? 12;
  const maxLength = options.maxClaimLength ?? 500;
  const sentences = splitIntoSentences(output.text);
  const claims: ClaimExtraction[] = [];
  for (const sentence of sentences) {
    const normalized = normalizeClaim(sentence, options);
    if (normalized.length < minLength || normalized.length > maxLength) continue;
    claims.push({ text: sentence, normalized, model: output.model });
  }
  return claims;
}

// ─── Similarity / clustering ──────────────────────────────────────────────

/**
 * Simple suffix-stripping stem to catch morphological variants:
 * diversify / diversified / diversifies / diversification all collapse
 * to "diversif". This is a lightweight Porter-lite — enough for
 * cross-model paraphrase detection without pulling in a full stemmer.
 */
function stem(word: string): string {
  if (word.length < 4) return word;
  // Order matters: longest suffixes first
  const suffixes = [
    "ication",
    "ications",
    "ization",
    "izations",
    "ational",
    "tional",
    "ingly",
    "ness",
    "ment",
    "ously",
    "ately",
    "ing",
    "ies",
    "ied",
    "ied",
    "ied",
    "est",
    "ers",
    "ed",
    "es",
    "ly",
    "al",
    "ic",
    "s",
  ];
  for (const suf of suffixes) {
    if (word.length - suf.length >= 3 && word.endsWith(suf)) {
      return word.slice(0, -suf.length);
    }
  }
  return word;
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .map(stem),
  );
}

export function jaccardSimilarity(a: string, b: string): number {
  const tokA = tokenize(a);
  const tokB = tokenize(b);
  if (tokA.size === 0 && tokB.size === 0) return 1;
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let intersection = 0;
  for (const t of Array.from(tokA)) if (tokB.has(t)) intersection++;
  const union = tokA.size + tokB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Cluster claims into equivalence groups. Two claims belong in the same
 * cluster if their jaccard similarity exceeds `similarityThreshold`.
 *
 * Default 0.35 — empirically chosen for cross-model paraphrases. Models
 * often restate the same claim with different function words, so strict
 * lexical overlap (0.6+) misses real consensus. 0.35 catches paraphrases
 * while still rejecting unrelated claims.
 */
export function clusterClaims(
  claims: ClaimExtraction[],
  similarityThreshold = 0.35,
): ClaimExtraction[][] {
  const clusters: ClaimExtraction[][] = [];
  for (const claim of claims) {
    let placed = false;
    for (const cluster of clusters) {
      // Compare to the first representative
      if (jaccardSimilarity(cluster[0].normalized, claim.normalized) >= similarityThreshold) {
        cluster.push(claim);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([claim]);
  }
  return clusters;
}

// ─── Main distillation pipeline ───────────────────────────────────────────

export function distillConsensus(
  outputs: ModelOutput[],
  options: DistillationOptions = {},
): DistillationResult {
  // Default: majority (>= 0.5). This means 2/3 models passes, 1/2 passes,
  // 3/5 passes. Tests can use a stricter threshold via options.
  const threshold = options.consensusThreshold ?? 0.5;
  const totalModels = outputs.length;

  // 1. Extract claims per model
  const allClaims: ClaimExtraction[] = [];
  for (const out of outputs) {
    allClaims.push(...extractClaims(out, options));
  }

  // 2. Cluster claims into equivalence groups
  const clusters = clusterClaims(allClaims);

  // 3. Build consensus claims per cluster
  const consensusClaims: ConsensusClaim[] = [];
  const contestedClaims: ConsensusClaim[] = [];
  const uniqueToOneModel: ConsensusClaim[] = [];

  for (const cluster of clusters) {
    // Dedupe by model — one claim per model per cluster
    const byModel = new Map<string, ClaimExtraction>();
    for (const c of cluster) {
      if (!byModel.has(c.model)) byModel.set(c.model, c);
    }
    const agreeingModels = Array.from(byModel.keys());
    const examples = Array.from(byModel.values()).map((c) => c.text);
    const ratio = agreeingModels.length / totalModels;

    const normalized = cluster[0].normalized;

    const consensusClaim: ConsensusClaim = {
      normalized,
      examples,
      agreeingModels,
      agreementRatio: ratio,
    };

    // A claim from only one model can never be "consensus" — it's unique,
    // even if ratio happens to equal 1.0 (e.g. single-model input).
    if (agreeingModels.length === 1) {
      uniqueToOneModel.push(consensusClaim);
    } else if (ratio >= threshold) {
      consensusClaims.push(consensusClaim);
    } else {
      contestedClaims.push(consensusClaim);
    }
  }

  // Sort consensus claims by strongest agreement first
  consensusClaims.sort((a, b) => b.agreementRatio - a.agreementRatio);
  contestedClaims.sort((a, b) => b.agreementRatio - a.agreementRatio);

  // Overall agreement score: what fraction of unique claims reach consensus
  const uniqueClaimCount = clusters.length;
  const agreementScore =
    uniqueClaimCount === 0 ? 0 : consensusClaims.length / uniqueClaimCount;

  // Confidence: weighted mix of agreement score + consensus volume
  const volumeBonus = Math.min(0.2, consensusClaims.length * 0.02);
  const confidence = Math.max(0, Math.min(1, agreementScore * 0.8 + volumeBonus));

  return {
    totalModels,
    totalClaims: allClaims.length,
    uniqueClaims: uniqueClaimCount,
    consensusClaims,
    contestedClaims,
    uniqueToOneModel,
    agreementScore,
    confidence,
  };
}

// ─── Training example builder ────────────────────────────────────────────

export interface TrainingExample {
  prompt: string;
  output: string;
  provenance: {
    agreeingModels: string[];
    agreementRatio: number;
    derivedAt: number;
  };
}

/**
 * Build a list of training examples from a distillation result. Each
 * consensus claim becomes one training example. Use these as
 * weak-labeled data for the templateOptimizer / ragTrainer pipelines.
 */
export function buildTrainingExamples(
  prompt: string,
  result: DistillationResult,
  minAgreement = 0.5,
): TrainingExample[] {
  return result.consensusClaims
    .filter((c) => c.agreementRatio >= minAgreement)
    .map((c) => ({
      prompt,
      output: c.examples[0] || c.normalized,
      provenance: {
        agreeingModels: c.agreeingModels,
        agreementRatio: c.agreementRatio,
        derivedAt: Date.now(),
      },
    }));
}

/**
 * One-line summary for logs / UI badges.
 */
export function summarizeDistillation(result: DistillationResult): string {
  const pct = Math.round(result.agreementScore * 100);
  const parts = [
    `${result.totalModels} models`,
    `${result.consensusClaims.length}/${result.uniqueClaims} consensus`,
    `${pct}% agreement`,
  ];
  if (result.contestedClaims.length > 0) parts.push(`${result.contestedClaims.length} contested`);
  return parts.join(" · ");
}
