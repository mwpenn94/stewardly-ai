/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Substrate Primitive: AEGIS Pre/Post-Flight Pipeline
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * AEGIS (Adaptive Enhancement & Governance Intelligence System):
 *   Pre-flight:  classify → cache check → optimize prompt → route
 *   Post-flight: quality score → fragment extraction → lesson learning → cache write
 *
 * Integrates with:
 *   - Classifier (sensitivity, task type, complexity)
 *   - Embedding service (semantic cache)
 *   - Sovereign routing (provider selection)
 *   - Memory engine (lesson storage)
 *
 * @substrate-primitive: aegis
 * @absorbed-from: manus-next-app/server/services/aegis.ts
 */
import { classify, type ClassificationResult } from "./classifier";
import { generateEmbedding, cosineSimilarity } from "./embedding";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "substrate:aegis" });

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PreFlightResult {
  classification: ClassificationResult;
  cached: boolean;
  cachedResponse?: string;
  optimizedPrompt: string;
  estimatedCost: number;
  sessionId: string;
}

export interface PostFlightResult {
  qualityScore: QualityScore;
  fragments: string[];
  lessonsLearned: string[];
  cached: boolean;
  costActual: number;
}

export interface QualityScore {
  accuracy: number;
  completeness: number;
  relevance: number;
  coherence: number;
  safety: number;
  overall: number;
}

export interface AegisSession {
  id: string;
  userId: number;
  prompt: string;
  classification: ClassificationResult;
  preFlightAt: number;
  postFlightAt?: number;
  qualityScore?: QualityScore;
  costEstimated: number;
  costActual?: number;
}

// ─── Semantic Cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  prompt: string;
  embedding: number[];
  response: string;
  qualityScore: number;
  createdAt: number;
  hits: number;
}

// In-memory cache (will be persisted to DB in Phase E)
const semanticCache: CacheEntry[] = [];
const CACHE_SIMILARITY_THRESHOLD = 0.92;
const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if a semantically similar prompt has been cached.
 */
async function checkSemanticCache(prompt: string): Promise<string | null> {
  if (semanticCache.length === 0) return null;

  const embedding = await generateEmbedding(prompt);
  if (!embedding) return null;

  const now = Date.now();
  let bestMatch: CacheEntry | null = null;
  let bestScore = 0;

  for (const entry of semanticCache) {
    // Skip expired entries
    if (now - entry.createdAt > CACHE_TTL_MS) continue;
    // Skip low-quality cached responses
    if (entry.qualityScore < 0.7) continue;

    const similarity = cosineSimilarity(embedding, entry.embedding);
    if (similarity > CACHE_SIMILARITY_THRESHOLD && similarity > bestScore) {
      bestScore = similarity;
      bestMatch = entry;
    }
  }

  if (bestMatch) {
    bestMatch.hits++;
    log.info({ similarity: bestScore, hits: bestMatch.hits }, "Semantic cache hit");
    return bestMatch.response;
  }

  return null;
}

/**
 * Write a response to the semantic cache.
 */
async function writeSemanticCache(prompt: string, response: string, qualityScore: number): Promise<void> {
  const embedding = await generateEmbedding(prompt);
  if (!embedding) return;

  // Evict oldest entries if at capacity
  if (semanticCache.length >= CACHE_MAX_SIZE) {
    semanticCache.sort((a, b) => a.createdAt - b.createdAt);
    semanticCache.splice(0, Math.floor(CACHE_MAX_SIZE * 0.2));
  }

  semanticCache.push({
    prompt,
    embedding,
    response,
    qualityScore,
    createdAt: Date.now(),
    hits: 0,
  });
}

// ─── Cost Estimation ─────────────────────────────────────────────────────────

const COST_PER_1K_INPUT: Record<string, number> = {
  economy: 0.00015,
  standard: 0.003,
  premium: 0.015,
  reasoning: 0.06,
};

function estimateCost(classification: ClassificationResult, promptLength: number): number {
  const tier = classification.complexity === "expert" || classification.complexity === "complex"
    ? "premium"
    : classification.complexity === "moderate"
    ? "standard"
    : "economy";

  const inputTokens = Math.ceil(promptLength / 4); // rough estimate
  const outputTokens = inputTokens * 1.5; // assume 1.5x output
  const costPer1k = COST_PER_1K_INPUT[tier] ?? COST_PER_1K_INPUT.standard;

  return ((inputTokens + outputTokens) / 1000) * costPer1k;
}

// ─── Pre-Flight ──────────────────────────────────────────────────────────────

let sessionCounter = 0;

/**
 * Run pre-flight analysis on a prompt.
 * Returns classification, cache status, optimized prompt, and cost estimate.
 */
export async function runPreFlight(
  prompt: string,
  userId: number,
  taskExternalId?: string
): Promise<PreFlightResult> {
  const sessionId = `aegis_${Date.now()}_${++sessionCounter}`;

  // 1. Classify
  const classification = classify(prompt);

  // 2. Check semantic cache
  const cachedResponse = await checkSemanticCache(prompt);

  // 3. Optimize prompt (trim whitespace, remove redundant instructions)
  const optimizedPrompt = optimizePrompt(prompt, classification);

  // 4. Estimate cost
  const estimatedCost = estimateCost(classification, optimizedPrompt.length);

  log.info({
    sessionId,
    userId,
    taskType: classification.taskType,
    complexity: classification.complexity,
    sensitivity: classification.sensitivity,
    routingTier: classification.routingTier,
    cached: !!cachedResponse,
    estimatedCost,
  }, "AEGIS pre-flight complete");

  return {
    classification,
    cached: !!cachedResponse,
    cachedResponse: cachedResponse ?? undefined,
    optimizedPrompt,
    estimatedCost,
    sessionId,
  };
}

// ─── Post-Flight ─────────────────────────────────────────────────────────────

/**
 * Run post-flight analysis on an LLM response.
 * Scores quality, extracts fragments, learns lessons, and caches if quality is high.
 */
export async function runPostFlight(
  sessionId: string,
  prompt: string,
  output: string,
  taskType: string,
  costActual: number
): Promise<PostFlightResult> {
  // 1. Score quality
  const qualityScore = scoreQuality(output, taskType);

  // 2. Extract key fragments (sentences that contain actionable information)
  const fragments = extractFragments(output);

  // 3. Extract lessons (patterns for future improvement)
  const lessonsLearned = extractLessons(output, taskType);

  // 4. Cache if quality is high enough
  let cached = false;
  if (qualityScore.overall >= 0.7) {
    await writeSemanticCache(prompt, output, qualityScore.overall);
    cached = true;
  }

  log.info({
    sessionId,
    qualityScore: qualityScore.overall,
    fragments: fragments.length,
    lessons: lessonsLearned.length,
    cached,
    costActual,
  }, "AEGIS post-flight complete");

  return { qualityScore, fragments, lessonsLearned, cached, costActual };
}

// ─── Quality Scoring ─────────────────────────────────────────────────────────

function scoreQuality(output: string, taskType: string): QualityScore {
  const words = output.split(/\s+/).length;

  // Heuristic quality scoring (will be enhanced with LLM-as-judge in Phase E)
  const accuracy = words > 10 ? 0.8 : 0.5; // Longer responses tend to be more accurate
  const completeness = Math.min(1, words / 200); // More complete if longer (up to 200 words)
  const relevance = 0.85; // Baseline — will be enhanced with embedding similarity
  const coherence = output.includes("\n") ? 0.9 : 0.75; // Structured responses score higher
  const safety = checkSafety(output);

  const overall = (accuracy + completeness + relevance + coherence + safety) / 5;

  return { accuracy, completeness, relevance, coherence, safety, overall };
}

function checkSafety(output: string): number {
  // Check for PII leakage in output
  const piiPatterns = [
    /\b\d{3}-?\d{2}-?\d{4}\b/, // SSN
    /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2})[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // CC
  ];

  for (const pattern of piiPatterns) {
    if (pattern.test(output)) return 0.3; // Major safety concern
  }

  return 1.0; // Safe
}

// ─── Prompt Optimization ─────────────────────────────────────────────────────

function optimizePrompt(prompt: string, classification: ClassificationResult): string {
  let optimized = prompt.trim();

  // Remove excessive whitespace
  optimized = optimized.replace(/\n{3,}/g, "\n\n");
  optimized = optimized.replace(/[ \t]{2,}/g, " ");

  // For simple/trivial tasks, strip verbose instructions
  if (classification.complexity === "trivial" || classification.complexity === "simple") {
    // Remove "please" and other filler words for efficiency
    optimized = optimized.replace(/\bplease\b/gi, "").trim();
  }

  return optimized;
}

// ─── Fragment Extraction ─────────────────────────────────────────────────────

function extractFragments(output: string): string[] {
  const sentences = output.split(/[.!?]+/).filter((s) => s.trim().length > 20);
  const actionable = sentences.filter((s) => {
    const lower = s.toLowerCase();
    return (
      lower.includes("should") ||
      lower.includes("recommend") ||
      lower.includes("consider") ||
      lower.includes("important") ||
      lower.includes("key") ||
      lower.includes("action")
    );
  });
  return actionable.slice(0, 5).map((s) => s.trim());
}

// ─── Lesson Extraction ───────────────────────────────────────────────────────

function extractLessons(output: string, taskType: string): string[] {
  const lessons: string[] = [];

  // Extract patterns that could improve future responses
  if (output.length > 500) {
    lessons.push(`${taskType}: Long-form response generated successfully`);
  }
  if (output.includes("```")) {
    lessons.push(`${taskType}: Code block included in response`);
  }
  if (output.includes("|") && output.includes("---")) {
    lessons.push(`${taskType}: Table formatting used`);
  }

  return lessons;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export { classify as classifyTask } from "./classifier";
export { checkSemanticCache as checkCache, writeSemanticCache as writeCache, estimateCost };
