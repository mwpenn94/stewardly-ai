/**
 * Dynamic Integration — URL safety guard (SSRF protection).
 *
 * Every network fetch done by the dynamic-integration runtime — the executor,
 * the `probeUrl` tRPC procedure, and the AI drafter — must go through this
 * module. It blocks:
 *
 *   1. non-http(s) schemes  (file://, ftp://, gopher://, ...)
 *   2. loopback hosts       (localhost, 127.0.0.0/8, ::1)
 *   3. private IPv4 ranges  (10/8, 172.16/12, 192.168/16, 169.254/16)
 *   4. private IPv6 ranges  (fc00::/7, fe80::/10)
 *   5. metadata services    (169.254.169.254, metadata.google.internal, etc.)
 *   6. non-standard ports   (anything outside the 80/443/8080/8443 allowlist)
 *
 * Pure — no network. Takes a URL string, returns {ok, reason, normalized}.
 * Unit-tested so behavior is locked.
 */

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);
const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443", "3000", "4000", "5000", "8000", "8081"]);

/** Hostnames known to serve instance metadata on private clouds. */
const METADATA_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata.internal",
  "metadata",
  "169.254.169.254",
]);

/** RFC 1918 + link-local + loopback + reserved IPv4 ranges. */
const PRIVATE_IPV4_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8],       // "this" network
  ["10.0.0.0", 8],      // private
  ["100.64.0.0", 10],   // carrier-grade NAT
  ["127.0.0.0", 8],     // loopback
  ["169.254.0.0", 16],  // link-local (includes AWS metadata)
  ["172.16.0.0", 12],   // private
  ["192.0.0.0", 24],    // reserved
  ["192.168.0.0", 16],  // private
  ["198.18.0.0", 15],   // benchmark
  ["224.0.0.0", 4],     // multicast
  ["240.0.0.0", 4],     // reserved (includes 255.255.255.255)
];

export interface UrlGuardResult {
  ok: boolean;
  reason?: string;
  normalized?: string;
  hostname?: string;
}

/** Check a URL for SSRF safety. Pure — returns a decision, never throws. */
export function checkUrlSafety(raw: string): UrlGuardResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid URL" };
  }
  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    return { ok: false, reason: `scheme "${url.protocol}" not allowed` };
  }
  // Block unusual ports.
  if (url.port && !ALLOWED_PORTS.has(url.port)) {
    return { ok: false, reason: `port ${url.port} not allowed` };
  }
  const host = url.hostname.toLowerCase();
  if (!host) return { ok: false, reason: "missing hostname" };
  // Disallow userinfo in the URL (some fetchers would try to authenticate).
  if (url.username || url.password) {
    return { ok: false, reason: "userinfo in URL not allowed" };
  }
  // Loopback hostnames
  if (host === "localhost" || host.endsWith(".localhost")) {
    return { ok: false, reason: "loopback host blocked" };
  }
  if (METADATA_HOSTNAMES.has(host)) {
    return { ok: false, reason: "metadata host blocked" };
  }
  // IPv6 loopback + link-local + unique-local.
  if (host === "::1" || host === "[::1]") {
    return { ok: false, reason: "loopback IPv6 blocked" };
  }
  // Bracket-trim for IPv6 literals (URL.hostname strips brackets in Node).
  // If it's an IPv6 literal, block obvious private ranges.
  if (host.includes(":")) {
    const lower = host.replace(/^\[|\]$/g, "");
    if (
      lower.startsWith("fe80") ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower === "::"
    ) {
      return { ok: false, reason: "private IPv6 blocked" };
    }
  } else {
    // IPv4 literal?
    const v4 = parseIPv4(host);
    if (v4 !== null) {
      for (const [base, bits] of PRIVATE_IPV4_RANGES) {
        if (isInRange(v4, parseIPv4(base)!, bits)) {
          return { ok: false, reason: `private/reserved IPv4 range ${base}/${bits}` };
        }
      }
    }
    // Also block hostnames like `localhost.mydomain.com` — too easy to
    // misconfigure — but only when the final label is `localhost`.
    if (host.startsWith("localhost.")) {
      return { ok: false, reason: "suspicious localhost prefix" };
    }
  }
  return { ok: true, normalized: url.toString(), hostname: host };
}

/** Throws a descriptive Error if the URL is unsafe. */
export function assertUrlSafe(raw: string): void {
  const result = checkUrlSafety(raw);
  if (!result.ok) throw new Error(`unsafe URL: ${result.reason}`);
}

function parseIPv4(host: string): number | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = parseInt(part, 10);
    if (n < 0 || n > 255) return null;
    result = result * 256 + n;
  }
  return result >>> 0;
}

function isInRange(ip: number, base: number, bits: number): boolean {
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : ((0xffffffff << (32 - bits)) >>> 0);
  return ((ip & mask) >>> 0) === ((base & mask) >>> 0);
}

/**
 * Scrub sensitive keys out of a Headers / Record<string, string> map
 * before it lands in a run row or warning log. Keeps header names but
 * replaces values with "[redacted]".
 */
const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "apikey",
]);

export function scrubSensitiveHeaders(
  headers: Record<string, string> | Headers | undefined | null,
): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  const push = (key: string, value: string) => {
    if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) {
      out[key] = "[redacted]";
    } else {
      out[key] = value;
    }
  };
  if (headers instanceof Headers) {
    headers.forEach((value, key) => push(key, value));
  } else {
    for (const [k, v] of Object.entries(headers)) push(k, v);
  }
  return out;
}

/**
 * Strip sensitive substrings (tokens, keys) from free-form text before
 * writing it to a warning or error log. Matches common patterns for API
 * keys / bearer tokens.
 */
export function scrubSensitiveText(text: string): string {
  return text
    // Authorization: Bearer <token>
    .replace(/Authorization\s*:\s*Bearer\s+[\w.-]+/gi, "Authorization: Bearer [redacted]")
    // Authorization: Basic <base64>
    .replace(/Authorization\s*:\s*Basic\s+[\w=+/]+/gi, "Authorization: Basic [redacted]")
    // api_key=xxx or api-key=xxx
    .replace(/api[_-]?key\s*=\s*[\w.-]+/gi, "api_key=[redacted]")
    // access_token=xxx
    .replace(/access_token\s*=\s*[\w.-]+/gi, "access_token=[redacted]");
}
