/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @platform/intelligence — TiDB Numeric Coercion Utility
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Training System P-02 Resolution:
 *   TiDB (MySQL-compatible) returns aggregate results (SUM, AVG, COUNT,
 *   decimal columns) as strings rather than JavaScript numbers. This utility
 *   provides a consistent, centralized coercion layer at the DB boundary
 *   so that all downstream consumers — including normalizeQualityScore,
 *   deepContextAssembler aggregate queries, and any intelligence layer
 *   code — receive proper numeric types.
 *
 * Design decisions:
 *   - Applied at the DB boundary (immediately after query results), not ad-hoc.
 *   - Handles null, undefined, NaN, and Infinity gracefully.
 *   - Preserves non-numeric fields untouched.
 *   - Provides both single-value and row-level coercion.
 *   - Type-safe: returns the same object shape with numeric fields coerced.
 */

// ─── SINGLE VALUE COERCION ──────────────────────────────────────────────────

/**
 * Coerce a single value that may be a string-encoded number (from TiDB
 * decimal/aggregate columns) into a proper JavaScript number.
 *
 * Returns the fallback if the value is null, undefined, or not parseable.
 */
export function coerceNumeric(value: unknown, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return fallback;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  // TiDB COUNT(*) can return BigInt in some drivers
  if (typeof value === "bigint") {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }
  return fallback;
}

// ─── ROW-LEVEL COERCION ─────────────────────────────────────────────────────

/**
 * Coerce specified fields on a database row from string to number.
 *
 * Usage:
 *   const row = await db.select().from(table).where(...);
 *   const coerced = coerceNumericFields(row, ["qualityScore", "confidence", "adherenceScore"]);
 *
 * Fields not present on the row are silently skipped.
 * Fields that cannot be parsed are set to the provided fallback (default: 0).
 */
export function coerceNumericFields<T extends Record<string, unknown>>(
  row: T,
  fields: (keyof T)[],
  fallback: number = 0,
): T {
  const result = { ...row };
  for (const field of fields) {
    if (field in result) {
      (result as Record<string, unknown>)[field as string] = coerceNumeric(
        result[field],
        fallback,
      );
    }
  }
  return result;
}

/**
 * Coerce numeric fields on an array of database rows.
 * Convenience wrapper for batch processing query results.
 */
export function coerceNumericFieldsBatch<T extends Record<string, unknown>>(
  rows: T[],
  fields: (keyof T)[],
  fallback: number = 0,
): T[] {
  return rows.map((row) => coerceNumericFields(row, fields, fallback));
}
