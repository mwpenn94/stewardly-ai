/**
 * coerceNumericFields — Normalizes MySQL/TiDB aggregate results.
 *
 * MySQL and TiDB drivers sometimes return aggregate values (COUNT, SUM, AVG)
 * as strings instead of numbers. This utility coerces specified fields to
 * proper numeric types, ensuring consistent behavior across drivers and
 * preventing downstream type mismatches.
 *
 * This pattern is shared across the platform (Atlas, AEGIS, Stewardly,
 * Sovereign) to ensure consistency when @platform/intelligence is extracted.
 */

/**
 * Coerce specified fields of a row object from string to number.
 * Fields that are null, undefined, or already numeric are left unchanged.
 * Non-numeric strings are coerced to 0 to prevent NaN propagation.
 *
 * @param row   - The row object returned from a Drizzle/MySQL query
 * @param fields - Array of field names whose values should be numeric
 * @returns A new object with the specified fields coerced to numbers
 */
export function coerceNumericFields<T extends Record<string, unknown>>(
  row: T,
  fields: (keyof T)[]
): T {
  const result = { ...row };
  for (const field of fields) {
    const value = result[field];
    if (value === null || value === undefined) {
      (result as any)[field] = 0;
    } else if (typeof value === "string") {
      const parsed = Number(value);
      (result as any)[field] = Number.isNaN(parsed) ? 0 : parsed;
    }
    // If already a number, leave as-is
  }
  return result;
}

/**
 * Coerce numeric fields on an array of rows.
 * Convenience wrapper for batch processing query results.
 */
export function coerceNumericFieldsArray<T extends Record<string, unknown>>(
  rows: T[],
  fields: (keyof T)[]
): T[] {
  return rows.map((row) => coerceNumericFields(row, fields));
}
