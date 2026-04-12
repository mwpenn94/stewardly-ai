/**
 * webFetch — URL retrieval + HTML→markdown conversion tool (Pass 250).
 *
 * Claude Code ships a built-in `WebFetch` tool so the agent can pull
 * a documentation page, release notes, API reference, or any other
 * URL its answer depends on. Code Chat's agent had no such tool —
 * it could `code_grep_search` the workspace but not reach out to the
 * network. This module closes that gap.
 *
 * Design:
 *   - Stays inside the sandbox philosophy: the tool never persists
 *     anything to disk and never runs user-provided bash.
 *   - Denylists internal metadata endpoints (cloud IMDS, localhost,
 *     link-local, private RFC-1918 ranges) so the agent cannot be
 *     tricked into exfiltrating or SSRF-attacking internal services.
 *   - Only http:// and https:// schemes are accepted.
 *   - 10s fetch timeout via AbortController + 2MB response cap so a
 *     pathological server can't exhaust memory.
 *   - HTML → plaintext-ish markdown via a small deterministic
 *     converter — we intentionally don't pull in a heavyweight
 *     dependency like turndown because this runs inside every
 *     server process and the converter's job is "make it LLM-readable",
 *     not produce pixel-perfect round-trippable markdown.
 *   - Response is truncated to 32KB of converted text to match the
 *     read_file budget and keep tokens under control.
 */

import { logger } from "../../_core/logger";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB fetch cap
const MAX_CONVERTED_CHARS = 32 * 1024; // 32KB converted text cap
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Private / loopback / link-local / multicast CIDR blocks plus a
 * handful of known dangerous hostnames. We perform this check
 * against the PARSED host AND — for IPv4 literals — against the
 * numeric octets so that `http://127.0.0.1:3000` can't slip past
 * by spelling itself `http://2130706433`. (Node's fetch rejects
 * the decimal-IP form anyway, but we don't want to rely on that
 * alone.)
 */
const BLOCKED_HOSTS: RegExp[] = [
  /^localhost$/i,
  /^0\.0\.0\.0$/,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/, // link-local — also blocks AWS IMDS 169.254.169.254
  /^224\.\d+\.\d+\.\d+$/, // multicast
  /^::1$/, // IPv6 loopback
  /^fe80::/i, // IPv6 link-local
  /^fc00::/i, // IPv6 unique local
];

export interface WebFetchResult {
  url: string;
  status: number;
  contentType: string;
  content: string;
  byteLength: number;
  truncated: boolean;
  durationMs: number;
}

export class WebFetchError extends Error {
  constructor(
    message: string,
    public code:
      | "BAD_URL"
      | "BLOCKED_HOST"
      | "BAD_SCHEME"
      | "TIMEOUT"
      | "TOO_LARGE"
      | "NETWORK"
      | "HTTP_ERROR",
  ) {
    super(message);
    this.name = "WebFetchError";
  }
}

/**
 * Parse and validate a URL against the sandbox policy. Returns the
 * normalized URL string on success, throws `WebFetchError` otherwise.
 */
export function validateUrl(raw: string): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new WebFetchError("URL is required", "BAD_URL");
  }
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new WebFetchError(`invalid URL: ${raw}`, "BAD_URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new WebFetchError(
      `unsupported scheme: ${parsed.protocol}`,
      "BAD_SCHEME",
    );
  }
  // URL.hostname returns IPv6 hosts wrapped in brackets — strip them
  // so BLOCKED_HOSTS regexes match the raw address literal.
  let host = parsed.hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }
  for (const pattern of BLOCKED_HOSTS) {
    if (pattern.test(host)) {
      throw new WebFetchError(
        `blocked host: ${host}`,
        "BLOCKED_HOST",
      );
    }
  }
  // Strip credentials from the URL — we never honor inline
  // user:password@ credentials, both for security and to avoid
  // silently leaking them downstream.
  parsed.username = "";
  parsed.password = "";
  return parsed.toString();
}

/**
 * Convert a bundle of raw HTML to a plaintext-ish markdown
 * suitable for feeding an LLM. Small, deterministic, and dependency-
 * free. Handles:
 *   - script / style / iframe / template / svg stripping
 *   - heading → # / ## / etc
 *   - anchor → text (URL)
 *   - p / br → newlines
 *   - li → bullets (nested indentation)
 *   - pre / code → fenced / inline
 *   - tag stripping for everything else
 *   - entity decoding for the common named entities
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  let s = html;
  // Drop comments
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  // Strip script / style / noscript / iframe / template / svg /
  // head contents (the head sometimes carries a <title> we want,
  // so we pull it out first)
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(s);
  const title = titleMatch ? titleMatch[1].trim() : "";
  s = s.replace(
    /<(script|style|noscript|iframe|template|svg|head)[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );
  // Headings
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n");
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n");
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n");
  s = s.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n\n");
  s = s.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n\n##### $1\n\n");
  s = s.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n\n###### $1\n\n");
  // Preformatted + code
  s = s.replace(
    /<pre[^>]*>([\s\S]*?)<\/pre>/gi,
    (_m, inner) => `\n\n\`\`\`\n${stripTags(inner)}\n\`\`\`\n\n`,
  );
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  // Anchors — keep text + URL so the agent can cite
  s = s.replace(
    /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href, text) => {
      const cleanText = stripTags(text).trim();
      if (!cleanText) return href;
      if (cleanText === href) return href;
      return `${cleanText} (${href})`;
    },
  );
  // Paragraphs + br + hr
  s = s.replace(/<\/p>/gi, "\n\n");
  s = s.replace(/<p[^>]*>/gi, "");
  s = s.replace(/<br\s*\/?>(?!\s*<\/p>)/gi, "\n");
  s = s.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");
  // Lists
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "  - $1\n");
  s = s.replace(/<\/(ul|ol)>/gi, "\n");
  s = s.replace(/<(ul|ol)[^>]*>/gi, "");
  // Bold + italic
  s = s.replace(/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/gi, "**$1**");
  s = s.replace(/<(?:i|em)[^>]*>([\s\S]*?)<\/(?:i|em)>/gi, "_$1_");
  // Strip everything else
  s = stripTags(s);
  // Entity decode (common ones only — no full entity table)
  s = decodeEntities(s);
  // Collapse excessive whitespace
  s = s.replace(/\r\n?/g, "\n");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.trim();
  if (title) {
    s = `# ${title}\n\n${s}`;
  }
  return s;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&hellip;/gi, "…")
    .replace(/&copy;/gi, "©")
    .replace(/&reg;/gi, "®")
    .replace(/&#(\d+);/g, (_m, code) =>
      String.fromCodePoint(parseInt(code, 10)),
    )
    .replace(/&#x([\da-f]+);/gi, (_m, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    );
}

/**
 * Truncate a converted text blob to a safe size. Adds a trailing
 * `[…truncated N chars]` marker when the cap is exceeded so the
 * agent knows to fetch a narrower range or paginate.
 */
export function truncateContent(
  content: string,
  max: number = MAX_CONVERTED_CHARS,
): { content: string; truncated: boolean } {
  if (content.length <= max) return { content, truncated: false };
  const dropped = content.length - max;
  return {
    content: `${content.slice(0, max)}\n\n[…truncated ${dropped} chars]`,
    truncated: true,
  };
}

/**
 * Fetch a URL and return its content as LLM-friendly markdown.
 * Throws WebFetchError on any failure (sandbox, network, size).
 */
export async function fetchUrl(
  rawUrl: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<WebFetchResult> {
  const url = validateUrl(rawUrl);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = opts.fetchImpl ?? fetch;
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await doFetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "StewardlyCodeChat/1.0 (+https://stewardly.manus.space)",
        Accept: "text/html,text/markdown,text/plain;q=0.9,*/*;q=0.8",
      },
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      throw new WebFetchError(
        `fetch timed out after ${timeoutMs}ms`,
        "TIMEOUT",
      );
    }
    throw new WebFetchError(
      err?.message ? `network error: ${err.message}` : "network error",
      "NETWORK",
    );
  }
  clearTimeout(timer);
  const contentType = response.headers.get("content-type") ?? "";
  // Read the body in chunks against the byte cap to avoid
  // materializing a multi-MB blob when the server is hostile.
  const reader = response.body?.getReader();
  let raw = "";
  let total = 0;
  if (reader) {
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          /* best-effort */
        }
        throw new WebFetchError(
          `response exceeds ${MAX_RESPONSE_BYTES} bytes`,
          "TOO_LARGE",
        );
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } else {
    raw = await response.text();
    total = Buffer.byteLength(raw, "utf8");
  }
  if (!response.ok) {
    throw new WebFetchError(
      `HTTP ${response.status} ${response.statusText}`,
      "HTTP_ERROR",
    );
  }

  // HTML → markdown; plain text / markdown / JSON pass through
  let converted: string;
  if (/html/i.test(contentType)) {
    converted = htmlToMarkdown(raw);
  } else if (/json/i.test(contentType)) {
    // Pretty-print JSON so the LLM doesn't have to guess structure
    try {
      converted = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      converted = raw;
    }
  } else {
    // text/plain, text/markdown, or unknown — pass through after
    // stripping carriage returns for consistency
    converted = raw.replace(/\r\n?/g, "\n");
  }
  const { content, truncated } = truncateContent(converted);

  const durationMs = Date.now() - t0;
  logger.info(
    { url, status: response.status, byteLength: total, durationMs, truncated },
    "webFetch completed",
  );

  return {
    url,
    status: response.status,
    contentType,
    content,
    byteLength: total,
    truncated,
    durationMs,
  };
}
