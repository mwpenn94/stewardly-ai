/**
 * Schema Drift Detector
 *
 * When a third-party source's shape changes under us (a field is removed,
 * renamed, re-typed, or a new field appears), we want to know immediately.
 * This module takes two InferredSchemas (baseline + current) and produces
 * a categorized drift report: what changed, how severe, and what action
 * the caller should take.
 *
 * Pure-function module. No I/O. Used by the adapter runtime + the UI
 * diff viewer + the Code Chat agent when surveying a source.
 *
 * Severity levels:
 *   - BREAKING — will cause the pipeline to fail (e.g. PK removed, required
 *     field removed, type mismatch on a PK)
 *   - WARNING  — likely needs human review but won't crash
 *     (e.g. new field appeared, optional field removed, nullable rate
 *     changed dramatically)
 *   - INFO     — cosmetic (e.g. hint changed, field reordered, confidence
 *     improved)
 */

import type { InferredSchema, InferredField, InferredType } from "./schemaInference";

// ─── Types ─────────────────────────────────────────────────────────────────

export type DriftSeverity = "breaking" | "warning" | "info";

export type DriftKind =
  | "field_added"
  | "field_removed"
  | "field_renamed"
  | "type_changed"
  | "primary_key_changed"
  | "required_changed"
  | "nullability_changed"
  | "unique_rate_changed"
  | "semantic_hint_changed"
  | "confidence_changed";

export interface DriftChange {
  kind: DriftKind;
  severity: DriftSeverity;
  fieldName: string | null;         // null for schema-level changes like pk swap
  before: string | null;            // compact human-readable
  after: string | null;
  message: string;
  action?: string;                  // suggested caller action
}

export interface DriftReport {
  compatible: boolean;              // false if any BREAKING changes
  reviewRequired: boolean;          // true if any WARNING+ changes
  changes: DriftChange[];
  summary: {
    breaking: number;
    warning: number;
    info: number;
  };
  fieldsAdded: string[];
  fieldsRemoved: string[];
  fieldsChanged: string[];
}

// ─── Core diff ────────────────────────────────────────────────────────────

function getFieldByName(schema: InferredSchema, normalizedName: string): InferredField | undefined {
  return schema.fields.find((f) => f.normalizedName === normalizedName);
}

function typesCompatible(a: InferredType, b: InferredType): boolean {
  if (a === b) return true;
  // Numeric widening
  if ((a === "integer" && b === "number") || (a === "number" && b === "integer")) return true;
  // Date/datetime/timestamp are semantically equivalent for drift purposes
  const dateSet = new Set(["date", "datetime", "timestamp"]);
  if (dateSet.has(a) && dateSet.has(b)) return true;
  // String↔email/phone/url are all strings under the hood
  const stringSet = new Set(["string", "email", "phone", "url"]);
  if (stringSet.has(a) && stringSet.has(b)) return true;
  return false;
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const item of b) {
    if (!setA.has(item)) return false;
  }
  return true;
}

/**
 * Heuristic: detect renames by looking for removed fields whose type +
 * semantic signature matches an added field, with similar sample count.
 */
function hintsCompatible(a: string[], b: string[]): boolean {
  if (a.length === 0 && b.length === 0) return true;
  // The strongest (first) hint must match — this is the type-derived one
  if (a[0] !== b[0]) return false;
  // And one must be a subset of the other (either side can be more specific)
  const setA = new Set(a);
  const setB = new Set(b);
  const aInB = a.every((h) => setB.has(h));
  const bInA = b.every((h) => setA.has(h));
  return aInB || bInA;
}

function detectRename(
  removedField: InferredField,
  addedFields: InferredField[]
): InferredField | null {
  for (const added of addedFields) {
    if (added.type !== removedField.type) continue;
    if (!hintsCompatible(added.semanticHints, removedField.semanticHints)) continue;
    // Very similar sample count (within 15%)
    if (removedField.sampleCount > 0) {
      const ratio = Math.abs(added.sampleCount - removedField.sampleCount) / removedField.sampleCount;
      if (ratio > 0.15) continue;
    }
    return added;
  }
  return null;
}

// ─── Main entry point ────────────────────────────────────────────────────

export function diffSchemas(baseline: InferredSchema, current: InferredSchema): DriftReport {
  const changes: DriftChange[] = [];
  const baselineFieldMap = new Map(baseline.fields.map((f) => [f.normalizedName, f]));
  const currentFieldMap = new Map(current.fields.map((f) => [f.normalizedName, f]));

  const addedFields: InferredField[] = [];
  const removedFields: InferredField[] = [];
  const preservedFields: Array<{ before: InferredField; after: InferredField }> = [];

  for (const field of current.fields) {
    const before = baselineFieldMap.get(field.normalizedName);
    if (!before) {
      addedFields.push(field);
    } else {
      preservedFields.push({ before, after: field });
    }
  }
  for (const field of baseline.fields) {
    if (!currentFieldMap.has(field.normalizedName)) {
      removedFields.push(field);
    }
  }

  // ─── Detect renames first — upgrade them from add+remove to rename ──
  const consumedAdded = new Set<string>();
  const consumedRemoved = new Set<string>();
  for (const removed of removedFields) {
    const rename = detectRename(
      removed,
      addedFields.filter((a) => !consumedAdded.has(a.normalizedName))
    );
    if (rename) {
      consumedAdded.add(rename.normalizedName);
      consumedRemoved.add(removed.normalizedName);
      changes.push({
        kind: "field_renamed",
        severity: "warning",
        fieldName: removed.normalizedName,
        before: removed.normalizedName,
        after: rename.normalizedName,
        message: `Field "${removed.normalizedName}" appears to have been renamed to "${rename.normalizedName}" (type + semantic hints match)`,
        action: "Update canonical field mapping to use the new source name",
      });
    }
  }

  // ─── Field additions (post-rename) ─────────────────────────────────
  for (const added of addedFields) {
    if (consumedAdded.has(added.normalizedName)) continue;
    changes.push({
      kind: "field_added",
      severity: "warning",
      fieldName: added.normalizedName,
      before: null,
      after: `${added.type}${added.isRequiredSuggested ? " (required)" : ""}`,
      message: `New field "${added.normalizedName}" appeared (type=${added.type})`,
      action: added.isRequiredSuggested
        ? "Add to writable field mappings and backfill existing records"
        : "Optional — add to field mappings if you want to ingest it",
    });
  }

  // ─── Field removals (post-rename) ──────────────────────────────────
  for (const removed of removedFields) {
    if (consumedRemoved.has(removed.normalizedName)) continue;
    const wasPrimaryKey = removed.isPrimaryKeyCandidate;
    const wasRequired = removed.isRequiredSuggested;
    changes.push({
      kind: "field_removed",
      severity: wasPrimaryKey || wasRequired ? "breaking" : "warning",
      fieldName: removed.normalizedName,
      before: `${removed.type}${wasRequired ? " (required)" : ""}`,
      after: null,
      message: wasPrimaryKey
        ? `BREAKING: Primary key "${removed.normalizedName}" was removed from the source`
        : `Field "${removed.normalizedName}" no longer appears in the source`,
      action: wasPrimaryKey
        ? "Find a new primary key OR mark this adapter as read-only append-only"
        : wasRequired
          ? "Remove this field from required writable mappings"
          : "Remove from field mappings if no longer needed",
    });
  }

  // ─── Preserved-field changes ───────────────────────────────────────
  for (const { before, after } of preservedFields) {
    // Type change
    if (before.type !== after.type) {
      const compatible = typesCompatible(before.type, after.type);
      changes.push({
        kind: "type_changed",
        severity: compatible ? "warning" : (before.isPrimaryKeyCandidate ? "breaking" : "warning"),
        fieldName: after.normalizedName,
        before: before.type,
        after: after.type,
        message: compatible
          ? `Type of "${after.normalizedName}" widened: ${before.type} → ${after.type}`
          : `Type of "${after.normalizedName}" changed: ${before.type} → ${after.type}`,
        action: compatible
          ? "Verify read transforms still decode correctly"
          : "Review field mapping + transform function for compatibility",
      });
    }

    // Required changed
    if (before.isRequiredSuggested !== after.isRequiredSuggested) {
      changes.push({
        kind: "required_changed",
        severity: after.isRequiredSuggested ? "warning" : "info",
        fieldName: after.normalizedName,
        before: before.isRequiredSuggested ? "required" : "optional",
        after: after.isRequiredSuggested ? "required" : "optional",
        message: `Field "${after.normalizedName}" is now ${after.isRequiredSuggested ? "required" : "optional"}`,
      });
    }

    // Nullability shift (only if dramatic)
    const nullDelta = Math.abs(before.nullRate - after.nullRate);
    if (nullDelta > 0.3) {
      changes.push({
        kind: "nullability_changed",
        severity: "warning",
        fieldName: after.normalizedName,
        before: `${Math.round(before.nullRate * 100)}% null`,
        after: `${Math.round(after.nullRate * 100)}% null`,
        message: `Null rate of "${after.normalizedName}" shifted from ${Math.round(before.nullRate * 100)}% to ${Math.round(after.nullRate * 100)}%`,
        action: "Investigate whether a backfill is needed or whether the field is being deprecated",
      });
    }

    // Semantic hint change
    if (!arraysEqual(before.semanticHints, after.semanticHints)) {
      changes.push({
        kind: "semantic_hint_changed",
        severity: "info",
        fieldName: after.normalizedName,
        before: before.semanticHints.join(","),
        after: after.semanticHints.join(","),
        message: `Semantic hints for "${after.normalizedName}" changed`,
      });
    }

    // Unique rate change (only dramatic shifts)
    const uniqueDelta = Math.abs(before.uniqueRate - after.uniqueRate);
    if (uniqueDelta > 0.3) {
      changes.push({
        kind: "unique_rate_changed",
        severity: before.isPrimaryKeyCandidate && !after.isPrimaryKeyCandidate ? "breaking" : "info",
        fieldName: after.normalizedName,
        before: `${Math.round(before.uniqueRate * 100)}% unique`,
        after: `${Math.round(after.uniqueRate * 100)}% unique`,
        message:
          before.isPrimaryKeyCandidate && !after.isPrimaryKeyCandidate
            ? `BREAKING: primary key candidate "${after.normalizedName}" is no longer unique enough`
            : `Uniqueness of "${after.normalizedName}" shifted: ${Math.round(before.uniqueRate * 100)}% → ${Math.round(after.uniqueRate * 100)}%`,
      });
    }

    // Confidence delta (info-level)
    const confDelta = Math.abs(before.confidence - after.confidence);
    if (confDelta > 0.2) {
      changes.push({
        kind: "confidence_changed",
        severity: "info",
        fieldName: after.normalizedName,
        before: `${Math.round(before.confidence * 100)}%`,
        after: `${Math.round(after.confidence * 100)}%`,
        message: `Field confidence shifted ${Math.round(before.confidence * 100)}% → ${Math.round(after.confidence * 100)}%`,
      });
    }
  }

  // ─── Primary key changed ──────────────────────────────────────────
  if (baseline.primaryKey !== current.primaryKey) {
    const wasSet = Boolean(baseline.primaryKey);
    const isSet = Boolean(current.primaryKey);
    changes.push({
      kind: "primary_key_changed",
      severity: wasSet && !isSet ? "breaking" : "warning",
      fieldName: null,
      before: baseline.primaryKey,
      after: current.primaryKey,
      message:
        wasSet && !isSet
          ? `BREAKING: primary key "${baseline.primaryKey}" is no longer detectable`
          : `Primary key moved from "${baseline.primaryKey ?? "none"}" to "${current.primaryKey ?? "none"}"`,
      action: "Regenerate the adapter spec to pick up the new primary key",
    });
  }

  // ─── Summary rollup ───────────────────────────────────────────────
  const summary = {
    breaking: changes.filter((c) => c.severity === "breaking").length,
    warning: changes.filter((c) => c.severity === "warning").length,
    info: changes.filter((c) => c.severity === "info").length,
  };

  return {
    compatible: summary.breaking === 0,
    reviewRequired: summary.breaking > 0 || summary.warning > 0,
    changes,
    summary,
    fieldsAdded: addedFields.filter((f) => !consumedAdded.has(f.normalizedName)).map((f) => f.normalizedName),
    fieldsRemoved: removedFields.filter((f) => !consumedRemoved.has(f.normalizedName)).map((f) => f.normalizedName),
    fieldsChanged: preservedFields
      .filter(({ before, after }) => {
        return (
          before.type !== after.type ||
          before.isRequiredSuggested !== after.isRequiredSuggested ||
          !arraysEqual(before.semanticHints, after.semanticHints)
        );
      })
      .map(({ after }) => after.normalizedName),
  };
}

/**
 * One-line summary of a drift report, suitable for logs or toast messages.
 */
export function summarizeDrift(report: DriftReport): string {
  if (report.changes.length === 0) return "No schema drift detected";
  const parts: string[] = [];
  if (report.summary.breaking > 0) parts.push(`${report.summary.breaking} breaking`);
  if (report.summary.warning > 0) parts.push(`${report.summary.warning} warning`);
  if (report.summary.info > 0) parts.push(`${report.summary.info} info`);
  if (report.fieldsAdded.length > 0) parts.push(`+${report.fieldsAdded.length} field${report.fieldsAdded.length === 1 ? "" : "s"}`);
  if (report.fieldsRemoved.length > 0) parts.push(`-${report.fieldsRemoved.length} field${report.fieldsRemoved.length === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/**
 * Filter drift changes by severity — useful for the UI to show only
 * breaking changes in a compact badge.
 */
export function filterChanges(
  report: DriftReport,
  minSeverity: DriftSeverity
): DriftChange[] {
  const order: Record<DriftSeverity, number> = { info: 0, warning: 1, breaking: 2 };
  const threshold = order[minSeverity];
  return report.changes.filter((c) => order[c.severity] >= threshold);
}
