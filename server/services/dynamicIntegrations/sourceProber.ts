/**
 * Dynamic Integration — Source Prober
 *
 * Takes a raw sample (from an HTTP fetch, a pasted blob, or an upload) and
 * produces normalized records ready to feed into schemaInference + the
 * transform engine.
 *
 * Supports the common shapes an operator is likely to encounter when a data
 * source has NO documentation:
 *   - JSON (object, array, or {data:[...]}-wrapped)
 *   - NDJSON / JSONL
 *   - CSV / TSV / semi-delimited (delimiter auto-detected)
 *   - RSS / Atom feeds (via tiny regex parser)
 *   - HTML tables (first table)
 *   - HTML JSON-LD blocks (schema.org)
 *
 * Pure — no network. The router layer does the fetch; this module is given
 * the bytes. Keeps the module unit-testable.
 */

export type RawFormat = "json" | "ndjson" | "csv" | "tsv" | "rss" | "atom" | "html" | "unknown";

export interface ProbeResult {
  detectedFormat: RawFormat;
  records: Record<string, unknown>[];
  raw: string;
  notes: string[];
}

const MAX_RAW_BYTES = 1_000_000; // 1 MB cap to stay sane in memory/log

/** Best-effort detector for a raw body. */
export function detectFormat(body: string, contentType?: string): RawFormat {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("application/json")) return "json";
  if (ct.includes("application/ld+json")) return "json";
  if (ct.includes("text/csv")) return "csv";
  if (ct.includes("text/tab-separated-values")) return "tsv";
  if (ct.includes("application/rss+xml")) return "rss";
  if (ct.includes("application/atom+xml")) return "atom";
  if (ct.includes("text/html")) return "html";

  const sample = body.slice(0, 2048).trim();
  if (!sample) return "unknown";
  if (sample.startsWith("{") || sample.startsWith("[")) {
    // Check for NDJSON: multiple top-level JSON values separated by newlines.
    const lines = body.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length > 1 && lines.every((l) => l.trim().startsWith("{") || l.trim().startsWith("["))) {
      // Only classify NDJSON if all non-empty lines independently parse.
      let ok = 0;
      for (const line of lines.slice(0, 8)) {
        try {
          JSON.parse(line);
          ok++;
        } catch { /* ignore */ }
      }
      if (ok === Math.min(lines.length, 8)) return "ndjson";
    }
    return "json";
  }
  if (sample.startsWith("<?xml") || /<rss\b/i.test(sample)) return "rss";
  if (/<feed\b[^>]*xmlns[^>]*atom/i.test(sample)) return "atom";
  if (sample.startsWith("<") || /<html\b/i.test(sample)) return "html";
  // Delimiter sniff
  const firstLine = sample.split(/\r?\n/)[0];
  if (firstLine.includes("\t") && firstLine.split("\t").length >= 2) return "tsv";
  if (firstLine.includes(",") && firstLine.split(",").length >= 2) return "csv";
  if (firstLine.includes(";") && firstLine.split(";").length >= 2) return "csv";
  if (firstLine.includes("|") && firstLine.split("|").length >= 2) return "csv";
  return "unknown";
}

/** Parse NDJSON/JSONL; returns records[] + warnings. */
export function parseNdjson(body: string): { records: Record<string, unknown>[]; warnings: string[] } {
  const lines = body.split(/\r?\n/);
  const records: Record<string, unknown>[] = [];
  const warnings: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      if (Array.isArray(parsed)) parsed.forEach((r) => records.push(r));
      else if (parsed && typeof parsed === "object") records.push(parsed);
    } catch (e) {
      warnings.push(`ndjson line ${i + 1}: ${(e as Error).message}`);
    }
  }
  return { records, warnings };
}

/** Parse JSON; unwrap common envelopes. */
export function parseJson(body: string): { records: Record<string, unknown>[]; warnings: string[] } {
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    return { records: [], warnings: [`json parse: ${(e as Error).message}`] };
  }
  const unwrapped = unwrapEnvelope(parsed);
  if (Array.isArray(unwrapped)) {
    const onlyObjects = unwrapped.filter((r) => r && typeof r === "object" && !Array.isArray(r));
    if (onlyObjects.length !== unwrapped.length) {
      warnings.push(`dropped ${unwrapped.length - onlyObjects.length} non-object array entries`);
    }
    return { records: onlyObjects as Record<string, unknown>[], warnings };
  }
  if (unwrapped && typeof unwrapped === "object") {
    return { records: [unwrapped as Record<string, unknown>], warnings };
  }
  return { records: [], warnings: ["unrecognized json shape"] };
}

const ENVELOPE_KEYS = [
  "data", "results", "items", "records", "list", "rows", "entries",
  "observations", "hits", "feeds", "products", "articles",
];

function unwrapEnvelope(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 1 && Array.isArray(obj[keys[0]])) return obj[keys[0]];
  for (const key of ENVELOPE_KEYS) {
    const v = obj[key];
    if (Array.isArray(v)) return v;
    // One more level: {result:{data:[...]}}
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = v as Record<string, unknown>;
      for (const innerKey of ENVELOPE_KEYS) {
        if (Array.isArray(inner[innerKey])) return inner[innerKey];
      }
    }
  }
  return value;
}

/** Delimited text parse — hand-rolled for CSV/TSV/pipe with quote handling. */
export function parseDelimited(body: string, delimiter?: string): {
  records: Record<string, unknown>[];
  warnings: string[];
  delimiter: string;
} {
  const warnings: string[] = [];
  const lines = body.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { records: [], warnings: ["empty body"], delimiter: delimiter ?? "," };

  const firstLine = lines[0];
  let d = delimiter;
  if (!d) {
    // Count each candidate, pick the one with the most occurrences in the first line.
    const counts: Record<string, number> = { ",": 0, "\t": 0, ";": 0, "|": 0 };
    for (const ch of firstLine) if (ch in counts) counts[ch]++;
    d = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    if (counts[d] === 0) d = ",";
  }

  const headers = parseCsvLine(firstLine, d);
  if (headers.length === 0) {
    return { records: [], warnings: ["no headers detected"], delimiter: d };
  }
  const records: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], d);
    if (values.length === 0) continue;
    const rec: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      const cleanKey = (h || `col_${idx + 1}`).replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
      rec[cleanKey || `col_${idx + 1}`] = values[idx] ?? "";
    });
    records.push(rec);
  }
  return { records, warnings, delimiter: d };
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/** Minimal RSS/Atom parser — regex-based, handles the common shape. */
export function parseRssOrAtom(body: string): { records: Record<string, unknown>[]; warnings: string[] } {
  const warnings: string[] = [];
  const records: Record<string, unknown>[] = [];

  // Decide: Atom <entry> or RSS <item>
  const isAtom = /<feed\b[^>]*>/i.test(body);
  const tag = isAtom ? "entry" : "item";
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const block = m[1];
    const rec: Record<string, unknown> = {};
    rec.title = extractTag(block, "title");
    rec.link = extractAtomLink(block) ?? extractTag(block, "link");
    rec.description =
      extractTag(block, "description") ??
      extractTag(block, "summary") ??
      extractTag(block, "content");
    rec.published =
      extractTag(block, "pubDate") ??
      extractTag(block, "published") ??
      extractTag(block, "updated");
    rec.author = extractTag(block, "author") ?? extractTag(block, "dc:creator");
    rec.guid = extractTag(block, "guid") ?? extractTag(block, "id");
    // Drop undefined keys
    for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k];
    records.push(rec);
    if (records.length >= 2000) {
      warnings.push("feed truncated at 2000 entries");
      break;
    }
  }
  return { records, warnings };
}

function extractTag(block: string, tag: string): string | undefined {
  // CDATA-aware
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return undefined;
  let v = m[1];
  const cdata = v.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) v = cdata[1];
  return stripTags(v).trim() || undefined;
}

function extractAtomLink(block: string): string | undefined {
  const m = block.match(/<link\b[^>]*href=["']([^"']+)["']/i);
  return m ? m[1] : undefined;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

/** Extract the first HTML <table> as records keyed by <th> text. */
export function parseHtmlFirstTable(body: string): { records: Record<string, unknown>[]; warnings: string[] } {
  const warnings: string[] = [];
  const tableMatch = body.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return { records: [], warnings: ["no <table> found"] };
  const tableHtml = tableMatch[1];

  // Grab header row(s) — first <tr> with <th>, else first <tr>.
  const rowMatches = Array.from(tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
  if (rowMatches.length === 0) return { records: [], warnings: ["no <tr> rows"] };

  let headerCells: string[] = [];
  let bodyStartIdx = 0;
  const firstRow = rowMatches[0][1];
  const thMatches = Array.from(firstRow.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi));
  if (thMatches.length > 0) {
    headerCells = thMatches.map((m) => stripTags(m[1]).trim());
    bodyStartIdx = 1;
  } else {
    // No <th> cells — synthesize column-count headers from the first <td> row
    // and treat the first row as the header source, not a data row.
    const firstTds = Array.from(firstRow.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi));
    headerCells = firstTds.map((_, i) => `col_${i + 1}`);
    bodyStartIdx = 1;
  }

  const records: Record<string, unknown>[] = [];
  for (let i = bodyStartIdx; i < rowMatches.length; i++) {
    const rowHtml = rowMatches[i][1];
    const tds = Array.from(rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi));
    if (tds.length === 0) continue;
    const rec: Record<string, unknown> = {};
    headerCells.forEach((h, idx) => {
      const key = (h || `col_${idx + 1}`).replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
      rec[key || `col_${idx + 1}`] = tds[idx] ? stripTags(tds[idx][1]).trim() : "";
    });
    records.push(rec);
  }
  return { records, warnings };
}

/** Extract JSON-LD blocks (schema.org) from HTML as structured records. */
export function parseHtmlJsonLd(body: string): { records: Record<string, unknown>[]; warnings: string[] } {
  const warnings: string[] = [];
  const records: Record<string, unknown>[] = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed)) {
        for (const p of parsed) if (p && typeof p === "object") records.push(p as Record<string, unknown>);
      } else if (parsed && typeof parsed === "object") {
        records.push(parsed as Record<string, unknown>);
      }
    } catch (e) {
      warnings.push(`json-ld block failed: ${(e as Error).message}`);
    }
  }
  return { records, warnings };
}

/** Main entrypoint: probe a raw body and return normalized records. */
export function probeBody(body: string, contentType?: string): ProbeResult {
  const notes: string[] = [];
  // Byte-cap
  let raw = body;
  if (raw.length > MAX_RAW_BYTES) {
    raw = raw.slice(0, MAX_RAW_BYTES);
    notes.push(`raw truncated at ${MAX_RAW_BYTES} bytes`);
  }
  const format = detectFormat(raw, contentType);

  let result: { records: Record<string, unknown>[]; warnings: string[] } = { records: [], warnings: [] };
  switch (format) {
    case "json":
      result = parseJson(raw);
      break;
    case "ndjson":
      result = parseNdjson(raw);
      break;
    case "csv":
    case "tsv": {
      const delim = format === "tsv" ? "\t" : undefined;
      const parsed = parseDelimited(raw, delim);
      result = { records: parsed.records, warnings: parsed.warnings };
      notes.push(`delimiter: ${JSON.stringify(parsed.delimiter)}`);
      break;
    }
    case "rss":
    case "atom":
      result = parseRssOrAtom(raw);
      break;
    case "html": {
      // Prefer JSON-LD if present; else first table; else fall back to text snippet.
      const jsonLd = parseHtmlJsonLd(raw);
      if (jsonLd.records.length > 0) {
        result = jsonLd;
        notes.push("html: extracted JSON-LD");
      } else {
        const table = parseHtmlFirstTable(raw);
        if (table.records.length > 0) {
          result = table;
          notes.push("html: extracted first <table>");
        } else {
          result = {
            records: [{ text: stripTags(raw).slice(0, 4000) }],
            warnings: ["html: no table or JSON-LD — fell back to stripped text"],
          };
        }
      }
      break;
    }
    default:
      notes.push("format unknown");
  }

  notes.push(...result.warnings);
  return { detectedFormat: format, records: result.records, raw, notes };
}
