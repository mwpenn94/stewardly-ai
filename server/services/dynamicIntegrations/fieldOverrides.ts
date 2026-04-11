/**
 * Field Mapping Overrides
 *
 * The inference engine + adapter generator produce best-guess field types,
 * semantic hints, transforms, and directions. When a human or an agent
 * wants to correct a guess — "this field is actually a SSN even though it
 * looks like a number", or "this field is writable even though I marked it
 * readable by default", or "rename canonical_name to customer_id" — they
 * submit a FieldOverride. This module applies overrides on top of a
 * generated spec without mutating the inputs, and serializes overrides to
 * a storage-friendly shape so the UI can persist them across sessions.
 *
 * Pure-function module. No I/O. No database. Just transforms.
 */

import type {
  AdapterSpec,
  AdapterFieldMapping,
} from "./adapterGenerator";
import type { SemanticHint } from "./schemaInference";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface FieldOverride {
  // Either sourceName OR canonicalName identifies the field
  sourceName?: string;
  canonicalName?: string;
  // Overrides — any subset
  newCanonicalName?: string;
  direction?: AdapterFieldMapping["direction"];
  transform?: AdapterFieldMapping["transform"];
  required?: boolean;
  addHints?: SemanticHint[];
  removeHints?: SemanticHint[];
  // Pinning: if true, this override resists re-generation (e.g. after a
  // re-infer, we apply it again rather than letting inference win).
  pinned?: boolean;
  // Audit metadata
  reason?: string;
  addedBy?: string;        // userId, agent name, "system"
  addedAt?: number;        // epoch ms
}

export interface OverrideSet {
  overrides: FieldOverride[];
  version: number;
}

export interface OverrideApplyResult {
  spec: AdapterSpec;
  applied: FieldOverride[];
  skipped: Array<{ override: FieldOverride; reason: string }>;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────

function matchMapping(
  mapping: AdapterFieldMapping,
  override: FieldOverride
): boolean {
  if (override.sourceName && mapping.sourceName === override.sourceName) return true;
  if (override.canonicalName && mapping.canonicalName === override.canonicalName) return true;
  return false;
}

function applyOverrideToMapping(
  mapping: AdapterFieldMapping,
  override: FieldOverride
): AdapterFieldMapping {
  const merged: AdapterFieldMapping = { ...mapping };
  if (override.newCanonicalName) merged.canonicalName = override.newCanonicalName;
  if (override.direction) merged.direction = override.direction;
  if (override.transform) merged.transform = override.transform;
  if (override.required !== undefined) merged.required = override.required;

  // Hints: remove then add, preserving order
  if (override.removeHints && override.removeHints.length > 0) {
    const removeSet = new Set(override.removeHints);
    merged.hints = merged.hints.filter((h) => !removeSet.has(h));
  }
  if (override.addHints && override.addHints.length > 0) {
    const existing = new Set(merged.hints);
    for (const h of override.addHints) {
      if (!existing.has(h)) merged.hints = [...merged.hints, h];
    }
  }
  return merged;
}

// ─── Main entry point ────────────────────────────────────────────────────

/**
 * Apply an OverrideSet on top of an AdapterSpec. Returns a new spec — never
 * mutates the input. Any overrides that don't match an existing field are
 * collected into `skipped` for UI feedback.
 */
export function applyOverrides(spec: AdapterSpec, overrides: FieldOverride[]): OverrideApplyResult {
  const applied: FieldOverride[] = [];
  const skipped: Array<{ override: FieldOverride; reason: string }> = [];
  let newMappings = [...spec.fieldMappings];

  for (const override of overrides) {
    if (!override.sourceName && !override.canonicalName) {
      skipped.push({ override, reason: "Override has neither sourceName nor canonicalName" });
      continue;
    }

    const idx = newMappings.findIndex((m) => matchMapping(m, override));
    if (idx === -1) {
      skipped.push({ override, reason: `No matching field for ${override.sourceName ?? override.canonicalName}` });
      continue;
    }

    // If the user is setting a new identifier, demote any previous identifier to "both"
    if (override.direction === "identifier") {
      newMappings = newMappings.map((m, i) => {
        if (i !== idx && m.direction === "identifier") return { ...m, direction: "both" };
        return m;
      });
    }

    newMappings[idx] = applyOverrideToMapping(newMappings[idx], override);
    applied.push(override);
  }

  // ─── Derived: re-derive primary key from mappings ───────────────
  // If a user marked a field as direction=identifier, respect it
  const userIdentifier = newMappings.find((m) => m.direction === "identifier");
  const primaryKey = userIdentifier?.canonicalName ?? spec.primaryKey;

  // ─── Derived: recompute readiness if direction changed ─────────
  const writableCount = newMappings.filter((m) => m.direction === "both" || m.direction === "write").length;
  const readinessReport = { ...spec.readinessReport };
  // Remove "No writable fields" warning if writables now exist
  if (writableCount > 0) {
    readinessReport.warnings = readinessReport.warnings.filter((w) => !w.includes("writable"));
  } else if (!readinessReport.warnings.some((w) => w.includes("writable"))) {
    readinessReport.warnings = [...readinessReport.warnings, "No writable fields detected — this adapter is read-only"];
  }

  return {
    spec: { ...spec, fieldMappings: newMappings, primaryKey, readinessReport },
    applied,
    skipped,
  };
}

// ─── Diffing overrides ────────────────────────────────────────────────

/**
 * Compute the list of overrides that are present in one set but not another.
 * Used by the UI to show "unsaved changes" and by the server to audit.
 */
export function diffOverrideSets(
  before: OverrideSet | null,
  after: OverrideSet
): { added: FieldOverride[]; removed: FieldOverride[]; changed: FieldOverride[] } {
  const prev = before?.overrides ?? [];
  const keyOf = (o: FieldOverride) => `${o.sourceName ?? ""}|${o.canonicalName ?? ""}`;
  const prevByKey = new Map(prev.map((o) => [keyOf(o), o]));
  const currByKey = new Map(after.overrides.map((o) => [keyOf(o), o]));

  const added: FieldOverride[] = [];
  const removed: FieldOverride[] = [];
  const changed: FieldOverride[] = [];

  for (const [key, o] of Array.from(currByKey.entries())) {
    const p = prevByKey.get(key);
    if (!p) added.push(o);
    else if (JSON.stringify(normalizeForCompare(p)) !== JSON.stringify(normalizeForCompare(o))) {
      changed.push(o);
    }
  }
  for (const [key, o] of Array.from(prevByKey.entries())) {
    if (!currByKey.has(key)) removed.push(o);
  }

  return { added, removed, changed };
}

function normalizeForCompare(o: FieldOverride): Omit<FieldOverride, "addedAt" | "addedBy" | "reason"> {
  const { addedAt: _1, addedBy: _2, reason: _3, ...rest } = o;
  // Sort hint arrays for deterministic comparison
  return {
    ...rest,
    addHints: rest.addHints ? [...rest.addHints].sort() : undefined,
    removeHints: rest.removeHints ? [...rest.removeHints].sort() : undefined,
  };
}

// ─── Re-apply across re-inference ────────────────────────────────────

/**
 * After a re-infer or schema drift, re-apply pinned overrides onto the
 * fresh spec. Unpinned overrides are dropped (the fresh inference wins).
 * Useful for the continuous-refresh loop: re-infer periodically, keep
 * human-pinned corrections.
 */
export function rehydratePinnedOverrides(
  freshSpec: AdapterSpec,
  overrides: FieldOverride[]
): OverrideApplyResult {
  const pinnedOnly = overrides.filter((o) => o.pinned === true);
  return applyOverrides(freshSpec, pinnedOnly);
}

// ─── Validation ──────────────────────────────────────────────────────

/**
 * Validate a list of overrides against a spec. Returns errors + warnings
 * that a UI form can render inline.
 */
export function validateOverrides(
  spec: AdapterSpec,
  overrides: FieldOverride[]
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sourceNames = new Set(spec.fieldMappings.map((m) => m.sourceName));
  const canonicalNames = new Set(spec.fieldMappings.map((m) => m.canonicalName));

  for (const o of overrides) {
    if (!o.sourceName && !o.canonicalName) {
      errors.push("Every override must target either sourceName or canonicalName");
      continue;
    }
    if (o.sourceName && !sourceNames.has(o.sourceName)) {
      warnings.push(`sourceName "${o.sourceName}" not found in current spec`);
    }
    if (o.canonicalName && !canonicalNames.has(o.canonicalName)) {
      warnings.push(`canonicalName "${o.canonicalName}" not found in current spec`);
    }
    if (o.newCanonicalName && canonicalNames.has(o.newCanonicalName) && o.newCanonicalName !== o.canonicalName) {
      errors.push(`newCanonicalName "${o.newCanonicalName}" collides with an existing canonical field`);
    }
    if (o.direction === "identifier") {
      const pkCandidates = spec.fieldMappings.filter((m) => m.direction === "identifier");
      if (pkCandidates.length > 0) {
        const existing = pkCandidates[0].sourceName;
        if (existing && existing !== o.sourceName) {
          warnings.push(`Setting "${o.sourceName}" as identifier will remove the previous identifier "${existing}"`);
        }
      }
    }
  }

  return { errors, warnings };
}

// ─── Serialization ────────────────────────────────────────────────────

export function serializeOverrideSet(set: OverrideSet): string {
  return JSON.stringify(set);
}

export function parseOverrideSet(raw: string): OverrideSet | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.overrides)) return null;
    // Defensive filter: drop entries that have neither sourceName nor canonicalName
    const overrides = parsed.overrides.filter((o: unknown) => {
      return (
        o &&
        typeof o === "object" &&
        ((typeof (o as Record<string, unknown>).sourceName === "string") ||
          (typeof (o as Record<string, unknown>).canonicalName === "string"))
      );
    });
    return { overrides, version: typeof parsed.version === "number" ? parsed.version : 1 };
  } catch {
    return null;
  }
}
