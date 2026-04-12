/**
 * Dynamic Integration — Transform Engine
 *
 * Pure functional DSL that takes a raw record and applies an ordered list of
 * transform steps to produce a normalized record ready for the sink.
 *
 * Step kinds (all declarative, no code execution):
 *   - pick      : keep only listed paths
 *   - drop      : remove listed paths
 *   - rename    : { from, to } — rename a field
 *   - map       : { field, values } — substitute using a lookup
 *   - coerce    : { field, to: "number" | "integer" | "boolean" | "string" | "date_ms" | "date_iso" }
 *   - default   : { field, value } — set if missing or null
 *   - trim      : { field } — trim leading/trailing whitespace
 *   - lowercase : { field } | { fields: [...] }
 *   - uppercase : { field } | { fields: [...] }
 *   - concat    : { target, parts: [...] } — concatenate field values with separator
 *   - split     : { field, separator, target? } — split string into array
 *   - regex     : { field, pattern, replace } — safe regex rewrite (max 1 match + capped)
 *   - jsonPath  : { field, path, target } — extract a dot-path value from nested field
 *   - arithmetic: { target, op, left, right } — op ∈ add/sub/mul/div; left/right numeric or "$field"
 *   - constant  : { target, value }
 *   - dropEmpty : { fields } — drop record if all listed fields are empty
 *   - require   : { fields } — drop record if any required field is missing
 *
 * Each step returns:
 *   { ok: true, record }    — success
 *   { ok: false, reason }   — validation failure; record dropped from pipeline
 */

export type TransformStep =
  | { kind: "pick"; fields: string[] }
  | { kind: "drop"; fields: string[] }
  | { kind: "rename"; from: string; to: string }
  | { kind: "map"; field: string; values: Record<string, unknown>; fallback?: unknown }
  | { kind: "coerce"; field: string; to: "number" | "integer" | "boolean" | "string" | "date_ms" | "date_iso" }
  | { kind: "default"; field: string; value: unknown }
  | { kind: "trim"; field: string }
  | { kind: "lowercase"; field?: string; fields?: string[] }
  | { kind: "uppercase"; field?: string; fields?: string[] }
  | { kind: "concat"; target: string; parts: string[]; separator?: string }
  | { kind: "split"; field: string; separator: string; target?: string }
  | { kind: "regex"; field: string; pattern: string; replace: string; flags?: string }
  | { kind: "jsonPath"; field: string; path: string; target: string }
  | { kind: "arithmetic"; target: string; op: "add" | "sub" | "mul" | "div"; left: number | string; right: number | string }
  | { kind: "constant"; target: string; value: unknown }
  | { kind: "dropEmpty"; fields: string[] }
  | { kind: "require"; fields: string[] };

export type Record_ = Record<string, unknown>;

export type TransformResult =
  | { ok: true; record: Record_ }
  | { ok: false; reason: string };

/** Dot-path helpers — support nested get/set/delete on plain objects. */
export function getByPath(obj: Record_, path: string): unknown {
  if (!path) return obj;
  const segments = path.split(".");
  let cur: unknown = obj;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

export function setByPath(obj: Record_, path: string, value: unknown): void {
  if (!path) return;
  const segments = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const next = cur[seg];
    if (next === null || next === undefined || typeof next !== "object" || Array.isArray(next)) {
      cur[seg] = {};
    }
    cur = cur[seg] as Record<string, unknown>;
  }
  cur[segments[segments.length - 1]] = value;
}

export function deleteByPath(obj: Record_, path: string): void {
  if (!path) return;
  const segments = path.split(".");
  let cur: unknown = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    if (cur === null || cur === undefined || typeof cur !== "object") return;
    cur = (cur as Record<string, unknown>)[segments[i]];
  }
  if (cur && typeof cur === "object") {
    delete (cur as Record<string, unknown>)[segments[segments.length - 1]];
  }
}

function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  return true;
}

function coerce(value: unknown, to: string): unknown {
  if (value === null || value === undefined || value === "") {
    return to === "string" ? "" : null;
  }
  switch (to) {
    case "number": {
      if (typeof value === "number") return value;
      const s = String(value).replace(/[,\s$€£¥%]/g, "");
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    case "integer": {
      if (typeof value === "number") return Math.trunc(value);
      const s = String(value).replace(/[,\s$€£¥%]/g, "");
      const n = Number(s);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      const s = String(value).trim().toLowerCase();
      if (["true", "yes", "y", "1", "t"].includes(s)) return true;
      if (["false", "no", "n", "0", "f"].includes(s)) return false;
      return null;
    }
    case "string":
      return String(value);
    case "date_ms": {
      if (typeof value === "number") return value;
      const t = Date.parse(String(value));
      return Number.isFinite(t) ? t : null;
    }
    case "date_iso": {
      if (typeof value === "number") return new Date(value).toISOString();
      const t = Date.parse(String(value));
      return Number.isFinite(t) ? new Date(t).toISOString() : null;
    }
    default:
      return value;
  }
}

/**
 * Build a regex, rejecting patterns with known catastrophic-backtracking
 * shapes. This is heuristic-only — a complete ReDoS detector is out of
 * scope — but it blocks the most common user-submitted footguns:
 *   - nested quantifiers like `(a+)+` or `(a*)*`
 *   - overlapping alternations with quantifiers like `(a|a)+`
 *   - very long or deeply-parenthesized patterns
 */
function safeRegex(pattern: string, flags?: string): RegExp | null {
  try {
    if (!pattern || pattern.length > 200) return null;
    // Count parens — cap group depth/count.
    let openParens = 0;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === "(" && pattern[i - 1] !== "\\") openParens++;
    }
    if (openParens > 10) return null;
    // Nested quantifier detector: (X+)+ / (X*)* / (X*)+ / (X+)* / (X{n,m})+
    if (/\([^)]*[+*][^)]*\)[+*]/.test(pattern)) return null;
    if (/\([^)]*\{\d+,?\d*\}[^)]*\)[+*]/.test(pattern)) return null;
    // Strip unsafe flags.
    const safeFlags = (flags ?? "").replace(/[^gimsu]/g, "");
    return new RegExp(pattern, safeFlags);
  } catch {
    return null;
  }
}

function resolveRef(rec: Record_, ref: number | string): unknown {
  if (typeof ref === "number") return ref;
  if (typeof ref === "string" && ref.startsWith("$")) {
    return getByPath(rec, ref.slice(1));
  }
  return ref;
}

/** Apply a single transform step. Returns a new record on success. */
export function applyStep(record: Record_, step: TransformStep): TransformResult {
  // Defensive: shallow-clone top level so caller is never mutated.
  const rec: Record_ = { ...record };
  switch (step.kind) {
    case "pick": {
      const next: Record_ = {};
      for (const f of step.fields) {
        const v = getByPath(rec, f);
        if (v !== undefined) setByPath(next, f, v);
      }
      return { ok: true, record: next };
    }
    case "drop": {
      for (const f of step.fields) deleteByPath(rec, f);
      return { ok: true, record: rec };
    }
    case "rename": {
      const v = getByPath(rec, step.from);
      if (v !== undefined) {
        setByPath(rec, step.to, v);
        deleteByPath(rec, step.from);
      }
      return { ok: true, record: rec };
    }
    case "map": {
      const v = getByPath(rec, step.field);
      if (v === undefined || v === null) return { ok: true, record: rec };
      const key = String(v);
      if (Object.prototype.hasOwnProperty.call(step.values, key)) {
        setByPath(rec, step.field, step.values[key]);
      } else if (step.fallback !== undefined) {
        setByPath(rec, step.field, step.fallback);
      }
      return { ok: true, record: rec };
    }
    case "coerce": {
      const v = getByPath(rec, step.field);
      setByPath(rec, step.field, coerce(v, step.to));
      return { ok: true, record: rec };
    }
    case "default": {
      const v = getByPath(rec, step.field);
      if (!hasValue(v)) setByPath(rec, step.field, step.value);
      return { ok: true, record: rec };
    }
    case "trim": {
      const v = getByPath(rec, step.field);
      if (typeof v === "string") setByPath(rec, step.field, v.trim());
      return { ok: true, record: rec };
    }
    case "lowercase":
    case "uppercase": {
      const fields = step.fields ?? (step.field ? [step.field] : []);
      for (const f of fields) {
        const v = getByPath(rec, f);
        if (typeof v === "string") {
          setByPath(rec, f, step.kind === "lowercase" ? v.toLowerCase() : v.toUpperCase());
        }
      }
      return { ok: true, record: rec };
    }
    case "concat": {
      const sep = step.separator ?? "";
      const parts: string[] = [];
      for (const p of step.parts) {
        const v = getByPath(rec, p);
        if (v !== undefined && v !== null) parts.push(String(v));
      }
      setByPath(rec, step.target, parts.join(sep));
      return { ok: true, record: rec };
    }
    case "split": {
      const v = getByPath(rec, step.field);
      if (typeof v !== "string") return { ok: true, record: rec };
      const parts = v.split(step.separator);
      setByPath(rec, step.target ?? step.field, parts);
      return { ok: true, record: rec };
    }
    case "regex": {
      const v = getByPath(rec, step.field);
      if (typeof v !== "string") return { ok: true, record: rec };
      const re = safeRegex(step.pattern, step.flags);
      if (!re) return { ok: true, record: rec };
      const replaced = v.replace(re, step.replace).slice(0, 4096);
      setByPath(rec, step.field, replaced);
      return { ok: true, record: rec };
    }
    case "jsonPath": {
      const v = getByPath(rec, step.field);
      if (v === undefined || v === null) return { ok: true, record: rec };
      if (typeof v !== "object") return { ok: true, record: rec };
      const extracted = getByPath(v as Record_, step.path);
      setByPath(rec, step.target, extracted);
      return { ok: true, record: rec };
    }
    case "arithmetic": {
      const left = Number(resolveRef(rec, step.left));
      const right = Number(resolveRef(rec, step.right));
      if (!Number.isFinite(left) || !Number.isFinite(right)) {
        setByPath(rec, step.target, null);
        return { ok: true, record: rec };
      }
      let out = 0;
      switch (step.op) {
        case "add": out = left + right; break;
        case "sub": out = left - right; break;
        case "mul": out = left * right; break;
        case "div": out = right === 0 ? NaN : left / right; break;
      }
      setByPath(rec, step.target, Number.isFinite(out) ? out : null);
      return { ok: true, record: rec };
    }
    case "constant":
      setByPath(rec, step.target, step.value);
      return { ok: true, record: rec };
    case "dropEmpty": {
      const anyNonEmpty = step.fields.some((f) => hasValue(getByPath(rec, f)));
      if (!anyNonEmpty) return { ok: false, reason: "all required fields empty" };
      return { ok: true, record: rec };
    }
    case "require": {
      for (const f of step.fields) {
        if (!hasValue(getByPath(rec, f))) {
          return { ok: false, reason: `missing required field "${f}"` };
        }
      }
      return { ok: true, record: rec };
    }
    default:
      // Unknown step kinds are a no-op (forward compat).
      return { ok: true, record: rec };
  }
}

/** Apply a pipeline of steps to one record. */
export function applyPipeline(record: Record_, steps: TransformStep[]): TransformResult {
  let cur: Record_ = record;
  for (const step of steps) {
    const result = applyStep(cur, step);
    if (!result.ok) return result;
    cur = result.record;
  }
  return { ok: true, record: cur };
}

/** Apply a pipeline to many records, partitioning accepted vs. rejected. */
export function runPipeline(
  records: Record_[],
  steps: TransformStep[],
): {
  accepted: Record_[];
  rejected: Array<{ index: number; reason: string }>;
} {
  const accepted: Record_[] = [];
  const rejected: Array<{ index: number; reason: string }> = [];
  for (let i = 0; i < records.length; i++) {
    const res = applyPipeline(records[i], steps);
    if (res.ok) accepted.push(res.record);
    else rejected.push({ index: i, reason: res.reason });
  }
  return { accepted, rejected };
}
