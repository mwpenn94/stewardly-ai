/**
 * Quality Score Normalization — Stewardly AI
 *
 * Ensures all quality/effectiveness scores are stored in 0.0–1.0 range.
 * Handles string inputs (TiDB returns aggregates as strings), null, NaN, and 0–10 scale.
 */

export function normalizeQualityScore(score: number | string | null | undefined): number {
  if (score === null || score === undefined) return 0;
  const num = typeof score === "string" ? Number(score) : score;
  if (isNaN(num)) return 0;
  if (num > 1) return Math.min(num / 10, 1); // Assume 0–10 scale
  return Math.max(0, Math.min(1, num));
}
