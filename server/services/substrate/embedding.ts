/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Substrate Primitive: Embedding Service
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Generates text embeddings via the Forge API (text-embedding-3-small).
 * Falls back to keyword-based similarity when embeddings unavailable.
 *
 * Used by: RAG, Memory Engine (M3, M8), Search Cascade, AEGIS cache.
 *
 * @substrate-primitive: embeddings
 * @absorbed-from: manus-next-app/server/services/embedding.ts
 */
import { ENV } from "../../_core/env";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "substrate:embedding" });

// ─── Configuration ───────────────────────────────────────────────────────────
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
const MAX_INPUT_LENGTH = 8000;

// ─── Types ───────────────────────────────────────────────────────────────────
interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokens: number;
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Generate an embedding vector for a text string.
 * Returns null if the API is unavailable or fails.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiUrl = ENV.forgeApiUrl
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/embeddings`
    : null;
  const apiKey = ENV.forgeApiKey;

  if (!apiKey || !apiUrl) {
    log.warn("No Forge API key/URL configured, skipping embedding generation");
    return null;
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, MAX_INPUT_LENGTH),
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      log.warn({ status: response.status, error: errText }, "Embedding API error");
      return null;
    }

    const result = (await response.json()) as EmbeddingResponse;
    return result.data?.[0]?.embedding ?? null;
  } catch (err) {
    log.warn({ err }, "Failed to generate embedding");
    return null;
  }
}

/**
 * Generate embeddings with full metadata (model, token count).
 */
export async function generateEmbeddingFull(text: string): Promise<EmbeddingResult | null> {
  const apiUrl = ENV.forgeApiUrl
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/embeddings`
    : null;
  const apiKey = ENV.forgeApiKey;

  if (!apiKey || !apiUrl) return null;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, MAX_INPUT_LENGTH),
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) return null;

    const result = (await response.json()) as EmbeddingResponse;
    const data = result.data?.[0];
    if (!data) return null;

    return {
      embedding: data.embedding,
      model: result.model,
      tokens: result.usage?.prompt_tokens ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Batch generate embeddings for multiple texts.
 * More efficient than calling generateEmbedding in a loop.
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  if (texts.length === 1) return [await generateEmbedding(texts[0])];

  const apiUrl = ENV.forgeApiUrl
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/embeddings`
    : null;
  const apiKey = ENV.forgeApiKey;

  if (!apiKey || !apiUrl) return texts.map(() => null);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts.map((t) => t.slice(0, MAX_INPUT_LENGTH)),
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) return texts.map(() => null);

    const result = (await response.json()) as EmbeddingResponse;
    // Map results back by index
    const embeddings: (number[] | null)[] = texts.map(() => null);
    for (const item of result.data ?? []) {
      if (item.index < embeddings.length) {
        embeddings[item.index] = item.embedding;
      }
    }
    return embeddings;
  } catch {
    return texts.map(() => null);
  }
}

// ─── Similarity Functions ────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two embedding vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Find the top-K most similar items from a collection of embeddings.
 */
export function findTopK<T>(
  queryEmbedding: number[],
  items: Array<{ embedding: number[]; data: T }>,
  k: number = 5,
  threshold: number = 0.3
): Array<{ data: T; score: number }> {
  const scored = items
    .map((item) => ({
      data: item.data,
      score: cosineSimilarity(queryEmbedding, item.embedding),
    }))
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, k);
}

// ─── Fallback: Keyword Similarity ────────────────────────────────────────────

/**
 * Simple keyword-based similarity when embeddings are unavailable.
 * Uses TF-IDF-like scoring with Jaccard overlap.
 */
export function keywordSimilarity(text1: string, text2: string): number {
  const tokenize = (t: string) =>
    new Set(
      t
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

  const set1 = tokenize(text1);
  const set2 = tokenize(text2);

  if (set1.size === 0 || set2.size === 0) return 0;

  let intersection = 0;
  for (const word of set1) {
    if (set2.has(word)) intersection++;
  }

  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
