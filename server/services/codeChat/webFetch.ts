/**
 * webFetch.ts — read-only HTTP fetcher for Code Chat (Parity Pass 1).
 *
 * Gives the ReAct agent the ability to pull in external documentation,
 * API specs, or HTML pages during a session. Matches Claude Code's
 * `WebFetch` tool shape: take a URL + a prompt, return content the
 * model can reason against.
 *
 * Deliberately conservative:
 *   - Only HTTP/HTTPS schemes are allowed; everything else is rejected
 *     up-front (file://, data:, ftp:, gopher:, javascript:, etc).
 *   - Local + link-local + loopback + RFC1918 hosts are blocked so a
 *     compromised prompt can't turn the server into an SSRF probe
 *     against its own metadata service, kube API, or private network.
 *   - A configurable optional allowlist can further tighten the set
 *     of allowed domains per deployment; disabled by default so agents
 *     can still chase arbitrary docs links.
 *   - Response body is hard-capped (default 512KB) and content-type
 *     filtered so we don't accidentally stream a 2GB binary.
 *   - HTML is converted to readable plain text before being handed to
 *     the LLM so we don't burn tokens on `<script>`/`<style>` noise.
 *   - Single 15s timeout; aborts cleanly on slow hosts.
 *
 * Every helper here is pure except `fetchUrl` itself, which is the
 * single I/O boundary — making it trivial to unit-test the logic
 * around it without stubbing network I/O everywhere.
 */

// ─── Config ────────────────────────────────────────────────────────────────

export interface WebFetchOptions {
  /** Absolute timeout (default 15s) */
  timeoutMs?: number;
  /** Max response bytes accepted from the server (default 512KB) */
  maxBytes?: number;
  /**
   * Optional allowlist of permitted hosts (case-insensitive, exact
   * or suffix match). Empty/undefined means "any public host".
   */
  allowedHosts?: string[];
  /**
   * Optional custom fetch implementation. Tests inject stubs here;
   * production uses global `fetch`.
   */
  fetchImpl?: typeof fetch;
  /** User-Agent to present (default identifies Stewardly Code Chat) */
  userAgent?: string;
}

export interface WebFetchResult {
  url: string;
  status: number;
  contentType: string;
  /** Text body after HTML-to-text conversion (or raw text for non-HTML) */
  content: string;
  /** Bytes actually read from the response (may be < content after text conversion) */
  byteLength: number;
  /** True if the body was cut off because it exceeded maxBytes */
  truncated: boolean;
  /** True if we parsed HTML and stripped scripts/styles/markup */
  htmlExtracted: boolean;
  /** Total elapsed ms including DNS + TLS + read */
  durationMs: number;
}

// Conservative upper bound — Node can handle much more but the LLM can't.
export const DEFAULT_MAX_BYTES = 512 * 1024;
export const DEFAULT_TIMEOUT_MS = 15_000;

// Content types we'll accept. Everything else short-circuits with an
// error so we don't download images/zips/videos by accident.
const ACCEPTED_CONTENT_TYPES = [
  "text/html",
  "text/plain",
  "text/markdown",
  "text/xml",
  "application/xml",
  "application/xhtml+xml",
  "application/json",
  "application/ld+json",
  "application/rss+xml",
  "application/atom+xml",
  "application/javascript",
  "application/ecmascript",
  "text/css",
  "text/csv",
];

// ─── URL validation / SSRF guard ───────────────────────────────────────────

const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./, // IPv4 loopback
  /^0\./, // "this network"
  /^10\./, // RFC1918
  /^172\.(1[6-9]|2\d|3[0-1])\./, // RFC1918
  /^192\.168\./, // RFC1918
  /^169\.254\./, // link-local (incl AWS/GCP metadata 169.254.169.254)
  /^fe80:/i, // IPv6 link-local
  /^::1$/, // IPv6 loopback
  /^fc[0-9a-f]{2}:/i, // IPv6 unique local
  /^fd[0-9a-f]{2}:/i, // IPv6 unique local
  /^metadata\.google\.internal$/i, // GCP metadata
  /\.internal$/i,
  /\.local$/i,
];

export type UrlRejection =
  | { ok: false; reason: "invalid_url"; message: string }
  | { ok: false; reason: "bad_scheme"; message: string }
  | { ok: false; reason: "private_host"; message: string }
  | { ok: false; reason: "not_allowlisted"; message: string };

export type UrlValidation =
  | { ok: true; url: URL }
  | UrlRejection;

/**
 * Parse + validate a user-supplied URL. Returns a discriminated union
 * so callers can surface the exact rejection reason to the agent
 * (helpful for letting the planner try a different URL).
 */
export function validateUrl(
  raw: string,
  allowedHosts?: string[],
): UrlValidation {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch (err) {
    return {
      ok: false,
      reason: "invalid_url",
      message: `could not parse URL: ${(err as Error).message}`,
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      reason: "bad_scheme",
      message: `only http(s) allowed, got '${parsed.protocol}'`,
    };
  }

  // Normalize the hostname for both allowlist check + SSRF check.
  // URL parser lowercases hosts already, but be explicit. IPv6
  // hosts come back bracket-wrapped ("[::1]"); strip the brackets
  // so both the SSRF pattern table and the allowlist check see the
  // bare address.
  let host = parsed.hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }
  if (!host) {
    return {
      ok: false,
      reason: "invalid_url",
      message: "URL has empty hostname",
    };
  }

  for (const pat of PRIVATE_HOST_PATTERNS) {
    if (pat.test(host)) {
      return {
        ok: false,
        reason: "private_host",
        message: `host '${host}' is private/loopback/metadata — blocked`,
      };
    }
  }

  if (allowedHosts && allowedHosts.length > 0) {
    const matches = allowedHosts.some((h) => {
      const needle = h.trim().toLowerCase();
      if (!needle) return false;
      return host === needle || host.endsWith("." + needle);
    });
    if (!matches) {
      return {
        ok: false,
        reason: "not_allowlisted",
        message: `host '${host}' not in allowlist`,
      };
    }
  }

  return { ok: true, url: parsed };
}

// ─── HTML → plain text ────────────────────────────────────────────────────

/**
 * Very small HTML-to-text converter. Good enough for documentation
 * pages and API reference sites; not a full DOM parser. We:
 *   1. Drop `<script>` / `<style>` / `<noscript>` entirely
 *   2. Replace `<br>` + block closers with newlines
 *   3. Strip remaining tags
 *   4. Decode the common named entities
 *   5. Collapse whitespace runs
 *
 * The goal is "readable enough for an LLM", not pixel-perfect text
 * extraction. A full Readability port would be nicer but pulls ~40KB
 * of deps for a marginal quality improvement.
 */
export function htmlToText(html: string): string {
  if (!html) return "";

  let out = html;

  // Drop scripts + styles + noscripts (with their content)
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Strip HTML comments
  out = out.replace(/<!--[\s\S]*?-->/g, "");

  // Replace block-level closers with newlines so paragraphs survive
  out = out.replace(/<\/?(p|div|section|article|header|footer|nav|aside|li|tr|h[1-6]|ul|ol|table|thead|tbody|br|hr|pre|blockquote)[^>]*>/gi, "\n");

  // Strip remaining tags
  out = out.replace(/<[^>]+>/g, "");

  // Decode named entities we actually see in practice
  out = decodeHtmlEntities(out);

  // Collapse whitespace runs — multiple blank lines → one, multiple
  // spaces → one, trim each line's leading/trailing whitespace.
  out = out
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter((line, idx, arr) => {
      // drop consecutive blank lines
      if (line !== "") return true;
      return idx === 0 || arr[idx - 1] !== "";
    })
    .join("\n")
    .trim();

  return out;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  trade: "™",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
};

export function decodeHtmlEntities(s: string): string {
  // Numeric: &#NNN; or &#xHHH;
  let out = s.replace(/&#(\d+);/g, (_m, dec) => {
    const code = parseInt(dec, 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000
      ? String.fromCodePoint(code)
      : "";
  });
  out = out.replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
    const code = parseInt(hex, 16);
    return Number.isFinite(code) && code > 0 && code < 0x110000
      ? String.fromCodePoint(code)
      : "";
  });
  // Named
  out = out.replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => {
    return NAMED_ENTITIES[name] ?? m;
  });
  return out;
}

// ─── Content-type parsing ──────────────────────────────────────────────────

/**
 * Split a content-type header into its bare type (lowercased, no
 * parameters). Returns "" for missing headers.
 */
export function parseContentType(raw: string | null | undefined): string {
  if (!raw) return "";
  const [bare] = raw.split(";");
  return bare.trim().toLowerCase();
}

export function isAcceptedContentType(ct: string): boolean {
  if (!ct) return true; // server didn't set one — be lenient
  return ACCEPTED_CONTENT_TYPES.includes(ct);
}

// ─── Main fetch ────────────────────────────────────────────────────────────

export class WebFetchError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_URL"
      | "BAD_SCHEME"
      | "PRIVATE_HOST"
      | "NOT_ALLOWLISTED"
      | "TIMEOUT"
      | "BAD_CONTENT_TYPE"
      | "HTTP_ERROR"
      | "TOO_LARGE"
      | "NETWORK_ERROR",
  ) {
    super(message);
    this.name = "WebFetchError";
  }
}

/**
 * Fetch a URL and return a text-form payload. Throws `WebFetchError`
 * on every failure mode; callers in the tool dispatcher translate
 * that into a `{ kind: "error", code, error }` result for the agent.
 */
export async function fetchUrl(
  rawUrl: string,
  opts: WebFetchOptions = {},
): Promise<WebFetchResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const userAgent = opts.userAgent ?? "StewardlyCodeChat/1.0 (+https://stewardly.ai)";

  const validation = validateUrl(rawUrl, opts.allowedHosts);
  if (!validation.ok) {
    const codeMap = {
      invalid_url: "INVALID_URL" as const,
      bad_scheme: "BAD_SCHEME" as const,
      private_host: "PRIVATE_HOST" as const,
      not_allowlisted: "NOT_ALLOWLISTED" as const,
    };
    throw new WebFetchError(validation.message, codeMap[validation.reason]);
  }

  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(validation.url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new WebFetchError(
        `HTTP ${response.status} ${response.statusText || ""}`.trim(),
        "HTTP_ERROR",
      );
    }

    const contentType = parseContentType(response.headers.get("content-type"));
    if (!isAcceptedContentType(contentType)) {
      throw new WebFetchError(
        `unsupported content-type '${contentType || "unknown"}'`,
        "BAD_CONTENT_TYPE",
      );
    }

    // Enforce maxBytes by streaming — we can't trust Content-Length.
    // Read chunks until we hit the cap, then stop.
    const reader = response.body?.getReader();
    let bytes: Uint8Array;
    let truncated = false;
    if (reader) {
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        const room = maxBytes - total;
        if (value.byteLength > room) {
          chunks.push(value.subarray(0, room));
          total += room;
          truncated = true;
          // Cancel the stream so the server stops sending us data
          try {
            await reader.cancel();
          } catch {
            /* already cancelled */
          }
          break;
        }
        chunks.push(value);
        total += value.byteLength;
      }
      // Check if there's more data we're dropping
      if (!truncated) {
        try {
          const peek = await reader.read();
          if (peek && peek.value) {
            truncated = true;
          }
        } catch {
          /* reader already closed */
        }
      }
      bytes = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.byteLength;
      }
    } else {
      // No streaming reader (some runtimes) — fall back to .text() but
      // guard the size defensively.
      const text = await response.text();
      const enc = new TextEncoder().encode(text);
      if (enc.byteLength > maxBytes) {
        bytes = enc.subarray(0, maxBytes);
        truncated = true;
      } else {
        bytes = enc;
      }
    }

    const rawText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const isHtml =
      contentType === "text/html" ||
      contentType === "application/xhtml+xml" ||
      // Some servers mis-label HTML as text/plain — sniff the body
      (contentType === "text/plain" && /^\s*<!doctype html|<html[\s>]/i.test(rawText));

    const content = isHtml ? htmlToText(rawText) : rawText;

    return {
      url: validation.url.toString(),
      status: response.status,
      contentType,
      content,
      byteLength: bytes.byteLength,
      truncated,
      htmlExtracted: isHtml,
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    if (err instanceof WebFetchError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new WebFetchError(
        `request aborted after ${timeoutMs}ms`,
        "TIMEOUT",
      );
    }
    throw new WebFetchError(
      err instanceof Error ? err.message : String(err),
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timer);
  }
}
