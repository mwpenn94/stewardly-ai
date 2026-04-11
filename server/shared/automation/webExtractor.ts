/**
 * webExtractor — pass 2, scope: browser/device automation parity.
 *
 * Schema-guided structured extraction on top of the `PageView` produced
 * by `webNavigator`. The agent supplies a small schema like:
 *
 *   {
 *     title: { selector: "title" },
 *     price: { selector: "regex:\\$([0-9,]+(?:\\.[0-9]+)?)", type: "number" },
 *     sections: {
 *       selector: "h2",
 *       type: "string[]",
 *     },
 *     tables: { selector: "table", type: "table[]" },
 *   }
 *
 * And gets back a typed object the LLM can read without re-parsing the
 * whole HTML body. This unlocks tool chains like "fetch IRS 1040 line
 * limits → extract the table → feed to the calculator" without burning
 * context on raw markup.
 *
 * Design choices:
 *   - NO external deps. This is pure string/regex processing so it runs
 *     inside edge runtimes and can be unit-tested trivially.
 *   - Selectors are strings with four recognized prefixes:
 *       "title"              → the PageView title
 *       "description"        → the PageView description
 *       "text"               → the PageView visible text
 *       "h1".."h6"           → heading matchers (exact level)
 *       "heading"            → any heading
 *       "link"               → all links (optionally filtered by `where`)
 *       "image"              → all images
 *       "form"               → all forms
 *       "regex:<pattern>"    → apply a regex to the raw HTML or text
 *       "css:<tag>"          → simple tag-name match on raw HTML
 *   - `type` controls how the raw match is coerced: `string` (default),
 *     `string[]`, `number`, `number[]`, `boolean`, `date`, `url`,
 *     `url[]`, `table`, `table[]`.
 *   - The schema is validated up-front so typos explode loudly instead
 *     of silently returning nothing.
 *
 * `extractTables(html)` is also exported on its own because reading
 * tables out of a page is the single most common structured-extraction
 * ask and worth having as a standalone helper for other services.
 */

import type { PageView } from "./webNavigator";
import { decodeEntities, stripTags } from "./webNavigator";

// ─── Schema types ──────────────────────────────────────────────────────

export type ExtractFieldType =
  | "string"
  | "string[]"
  | "number"
  | "number[]"
  | "boolean"
  | "date"
  | "url"
  | "url[]"
  | "table"
  | "table[]";

export interface ExtractField {
  /** Selector string — see top-of-file docs for the supported grammar */
  selector: string;
  /** Coerced type. Default: "string" for scalar, "string[]" for list selectors. */
  type?: ExtractFieldType;
  /** Optional filter for link/image selectors (substring match, case-insensitive) */
  where?: {
    textContains?: string;
    hrefContains?: string;
    altContains?: string;
  };
  /** Optional fallback value if extraction yields nothing. */
  fallback?: unknown;
  /** For list outputs: maximum entries. */
  limit?: number;
}

export interface ExtractSchema {
  [fieldName: string]: ExtractField;
}

export interface ExtractResult {
  data: Record<string, unknown>;
  warnings: string[];
  fieldCount: number;
}

// ─── Schema validation ────────────────────────────────────────────────

const VALID_TYPES = new Set<ExtractFieldType>([
  "string",
  "string[]",
  "number",
  "number[]",
  "boolean",
  "date",
  "url",
  "url[]",
  "table",
  "table[]",
]);

export interface SchemaValidationError {
  field: string;
  message: string;
}

export function validateSchema(schema: ExtractSchema): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];
  if (!schema || typeof schema !== "object") {
    errors.push({ field: "(root)", message: "schema must be a non-null object" });
    return errors;
  }
  for (const [name, field] of Object.entries(schema)) {
    if (!name || typeof name !== "string") {
      errors.push({ field: name, message: "field name must be a non-empty string" });
      continue;
    }
    if (!field || typeof field !== "object") {
      errors.push({ field: name, message: "field must be an object" });
      continue;
    }
    if (typeof field.selector !== "string" || !field.selector.trim()) {
      errors.push({ field: name, message: "selector must be a non-empty string" });
    }
    if (field.type !== undefined && !VALID_TYPES.has(field.type)) {
      errors.push({ field: name, message: `unknown type: ${field.type}` });
    }
    if (field.selector?.startsWith("regex:")) {
      try {
        new RegExp(field.selector.slice(6));
      } catch (err) {
        errors.push({
          field: name,
          message: `invalid regex: ${(err as Error).message}`,
        });
      }
    }
  }
  return errors;
}

// ─── Type coercion ─────────────────────────────────────────────────────

function coerceNumber(raw: string): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[,$£€¥%\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function coerceBoolean(raw: string): boolean | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (["true", "yes", "y", "1", "on", "enabled"].includes(v)) return true;
  if (["false", "no", "n", "0", "off", "disabled"].includes(v)) return false;
  return null;
}

function coerceDate(raw: string): string | null {
  if (typeof raw !== "string") return null;
  // Try native Date parse first, then common YYYY-MM-DD / MM/DD/YYYY
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const [, mm, dd, yyyy] = us;
    const d2 = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!Number.isNaN(d2.getTime())) return d2.toISOString();
  }
  return null;
}

function coerceUrl(raw: string, base?: string): string | null {
  if (typeof raw !== "string") return null;
  try {
    return new URL(raw, base).toString();
  } catch {
    return null;
  }
}

function coerceOne(
  raw: string | undefined,
  type: ExtractFieldType,
  base?: string,
): unknown {
  if (raw === undefined || raw === null) return null;
  switch (type) {
    case "string":
      return raw;
    case "number":
      return coerceNumber(raw);
    case "boolean":
      return coerceBoolean(raw);
    case "date":
      return coerceDate(raw);
    case "url":
      return coerceUrl(raw, base);
    default:
      return raw;
  }
}

// ─── Table extraction ──────────────────────────────────────────────────

export interface ExtractedTable {
  headers: string[];
  rows: string[][];
}

/**
 * Extract every `<table>` in raw HTML into a simple header+rows shape.
 * Regex-only so it runs anywhere, but handles the common cases:
 *   - `<thead>` with `<th>` cells
 *   - Tables with `<th>` in the first row
 *   - Tables with no header (headers: [])
 * Colspan/rowspan are ignored (rows returned as-is).
 */
export function extractTables(html: string): ExtractedTable[] {
  const tables: ExtractedTable[] = [];
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(html)) !== null) {
    const body = tm[1];
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    const rowMatches: Array<{ cells: string[]; isHeader: boolean }> = [];
    let rm: RegExpExecArray | null;
    while ((rm = rowRe.exec(body)) !== null) {
      const rowBody = rm[1];
      const cellRe = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      const cells: string[] = [];
      let cm: RegExpExecArray | null;
      let sawTh = false;
      while ((cm = cellRe.exec(rowBody)) !== null) {
        const tag = cm[1].toLowerCase();
        if (tag === "th") sawTh = true;
        cells.push(stripTags(cm[2]));
      }
      if (cells.length > 0) {
        rowMatches.push({ cells, isHeader: sawTh });
      }
    }
    if (rowMatches.length === 0) continue;
    // Header row = first row that's all th, else empty
    let headers: string[] = [];
    let firstDataRow = 0;
    if (rowMatches[0].isHeader) {
      headers = rowMatches[0].cells;
      firstDataRow = 1;
    }
    const rows = rowMatches.slice(firstDataRow).map((r) => r.cells);
    tables.push({ headers, rows });
    if (tables.length >= 50) break;
  }
  return tables;
}

// ─── Selector resolution ──────────────────────────────────────────────

interface ResolveContext {
  view: PageView;
  rawHtml: string;
}

function resolveLinks(
  ctx: ResolveContext,
  where: ExtractField["where"] | undefined,
  limit: number,
): Array<{ href: string; text: string }> {
  const tc = where?.textContains?.toLowerCase();
  const hc = where?.hrefContains?.toLowerCase();
  const out: Array<{ href: string; text: string }> = [];
  for (const link of ctx.view.links) {
    if (tc && !link.text.toLowerCase().includes(tc)) continue;
    if (hc && !link.href.toLowerCase().includes(hc)) continue;
    out.push({ href: link.href, text: link.text });
    if (out.length >= limit) break;
  }
  return out;
}

function resolveImages(
  ctx: ResolveContext,
  where: ExtractField["where"] | undefined,
  limit: number,
): Array<{ src: string; alt: string }> {
  const ac = where?.altContains?.toLowerCase();
  const out: Array<{ src: string; alt: string }> = [];
  for (const img of ctx.view.images) {
    if (ac && !img.alt.toLowerCase().includes(ac)) continue;
    out.push({ src: img.src, alt: img.alt });
    if (out.length >= limit) break;
  }
  return out;
}

function resolveHeadings(ctx: ResolveContext, level: number | null, limit: number): string[] {
  const out: string[] = [];
  for (const h of ctx.view.headings) {
    if (level !== null && h.level !== level) continue;
    out.push(h.text);
    if (out.length >= limit) break;
  }
  return out;
}

function resolveRegex(ctx: ResolveContext, pattern: string, limit: number): string[] {
  const out: string[] = [];
  let re: RegExp;
  try {
    re = new RegExp(pattern, "g");
  } catch {
    return out;
  }
  // Run against raw text first (cheaper), then fall back to raw HTML if
  // no matches — the agent can still pull things out of attributes.
  const sources = [ctx.view.text, ctx.rawHtml];
  for (const src of sources) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      // Prefer capture group 1 if present; fall back to full match
      const value = (m[1] ?? m[0] ?? "").trim();
      if (value) out.push(decodeEntities(value));
      if (out.length >= limit) break;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    if (out.length > 0) break;
  }
  return out;
}

function resolveCssLike(ctx: ResolveContext, tag: string, limit: number): string[] {
  const safe = tag.replace(/[^a-z0-9]/gi, "");
  if (!safe) return [];
  const out: string[] = [];
  const re = new RegExp(`<${safe}\\b[^>]*>([\\s\\S]*?)<\\/${safe}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(ctx.rawHtml)) !== null) {
    const t = stripTags(m[1]);
    if (t) out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

// ─── Main extraction function ─────────────────────────────────────────

function isListType(type: ExtractFieldType): boolean {
  return type.endsWith("[]");
}

function baseType(type: ExtractFieldType): ExtractFieldType {
  return type.endsWith("[]") ? (type.slice(0, -2) as ExtractFieldType) : type;
}

export function extractFromPageView(
  view: PageView,
  schema: ExtractSchema,
  opts: { rawHtml?: string } = {},
): ExtractResult {
  const errors = validateSchema(schema);
  if (errors.length > 0) {
    return {
      data: {},
      warnings: errors.map((e) => `${e.field}: ${e.message}`),
      fieldCount: 0,
    };
  }

  const rawHtml = opts.rawHtml ?? view.raw?.body ?? "";
  const ctx: ResolveContext = { view, rawHtml };
  const data: Record<string, unknown> = {};
  const warnings: string[] = [];

  for (const [name, field] of Object.entries(schema)) {
    const limit = Math.max(1, Math.min(field.limit ?? 100, 1000));
    const type: ExtractFieldType = field.type ?? "string";
    const sel = field.selector.trim();
    const wantList = isListType(type);

    // Resolve to an array of raw string values, then coerce.
    let rawValues: string[] = [];
    let tableValues: ExtractedTable[] = [];

    try {
      if (sel === "title") {
        rawValues = view.title ? [view.title] : [];
      } else if (sel === "description") {
        rawValues = view.description ? [view.description] : [];
      } else if (sel === "text") {
        rawValues = view.text ? [view.text] : [];
      } else if (/^h[1-6]$/.test(sel)) {
        const level = parseInt(sel.slice(1), 10);
        rawValues = resolveHeadings(ctx, level, limit);
      } else if (sel === "heading") {
        rawValues = resolveHeadings(ctx, null, limit);
      } else if (sel === "link" || sel === "links") {
        const links = resolveLinks(ctx, field.where, limit);
        if (type === "url" || type === "url[]") {
          rawValues = links.map((l) => l.href);
        } else {
          rawValues = links.map((l) => l.text || l.href);
        }
      } else if (sel === "image" || sel === "images") {
        const images = resolveImages(ctx, field.where, limit);
        if (type === "url" || type === "url[]") {
          rawValues = images.map((i) => i.src);
        } else {
          rawValues = images.map((i) => i.alt || i.src);
        }
      } else if (sel === "form" || sel === "forms") {
        rawValues = view.forms.map((f) => `${f.method} ${f.action} (${f.fields.length} fields)`);
      } else if (sel === "table" || sel === "tables") {
        tableValues = extractTables(rawHtml);
      } else if (sel.startsWith("regex:")) {
        rawValues = resolveRegex(ctx, sel.slice(6), limit);
      } else if (sel.startsWith("css:")) {
        rawValues = resolveCssLike(ctx, sel.slice(4), limit);
      } else {
        warnings.push(`${name}: unknown selector "${sel}"`);
      }
    } catch (err) {
      warnings.push(`${name}: ${(err as Error).message}`);
    }

    // Coerce + assign
    let value: unknown;
    if (type === "table" || type === "table[]") {
      value = type === "table" ? tableValues[0] ?? null : tableValues;
    } else if (rawValues.length === 0) {
      value = wantList ? [] : null;
    } else if (wantList) {
      const bt = baseType(type);
      value = rawValues
        .slice(0, limit)
        .map((r) => coerceOne(r, bt, view.finalUrl));
    } else {
      value = coerceOne(rawValues[0], baseType(type), view.finalUrl);
    }

    if (
      (value === null || value === "" || (Array.isArray(value) && value.length === 0)) &&
      field.fallback !== undefined
    ) {
      value = field.fallback;
    }

    data[name] = value;
  }

  return { data, warnings, fieldCount: Object.keys(data).length };
}
