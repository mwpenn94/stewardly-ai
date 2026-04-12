/**
 * Environment variable inspector (Pass 256).
 *
 * Admin-only surface that exposes the process env to the Code Chat
 * UI so users can see which env vars are set, which are missing
 * (from a known expected set), and get safely-masked previews of
 * the values without leaking secrets in full.
 *
 * This module is pure — no `process.env` reads here. The tRPC layer
 * pulls the env snapshot and feeds it in.
 *
 * Safety model:
 *   - Every value is masked. Short values return a length badge only.
 *   - Values under 6 chars are fully hidden ("****").
 *   - Values over 6 chars show first 3 chars + mask + length.
 *   - `LOG`-suffix vars and non-secret patterns (NODE_ENV, PORT, etc)
 *     show the full value.
 */

export type EnvCategory =
  | "database"
  | "api_key"
  | "auth"
  | "feature_flag"
  | "service_url"
  | "aws"
  | "mail"
  | "observability"
  | "general";

export interface EnvVarEntry {
  name: string;
  category: EnvCategory;
  /** Masked value for display */
  displayValue: string;
  /** The unmasked length of the original value */
  length: number;
  /** If the value was deemed non-secret and passed through unmasked */
  revealed: boolean;
  /** Present in the current env */
  present: boolean;
  /** Listed in the expected-vars set and not set */
  missing: boolean;
  /** Part of the required-vars set (tighter check) */
  required: boolean;
}

export interface EnvSnapshot {
  entries: EnvVarEntry[];
  /** Count by category */
  byCategory: Record<EnvCategory, number>;
  /** Count of vars that are expected but missing */
  missingCount: number;
  /** Count of required vars that are missing */
  requiredMissing: number;
  /** Total vars in the process env */
  totalPresent: number;
}

// ─── Masking ──────────────────────────────────────────────────────────

/**
 * List of prefixes/names that are safe to show in plaintext. These
 * are non-secret observability and config knobs.
 */
const NON_SECRET_NAMES = new Set([
  "NODE_ENV",
  "PORT",
  "HOST",
  "LOG_LEVEL",
  "NODE_VERSION",
  "TZ",
  "LANG",
  "LC_ALL",
  "USER",
  "SHELL",
  "HOME",
  "PATH",
  "PWD",
  "npm_package_name",
  "npm_package_version",
  "CI",
  "VITEST",
  "DEBUG",
]);

/**
 * Mask a single value. Returns `{display, revealed}`. Non-secret
 * names pass through; secrets get a 3-char prefix + mask + length tail.
 */
export function maskValue(
  name: string,
  value: string,
): { display: string; revealed: boolean } {
  if (!value) return { display: "", revealed: false };
  if (isNonSecret(name)) {
    // Truncate even non-secret values to keep the UI tidy
    const truncated = value.length > 80 ? value.slice(0, 80) + "…" : value;
    return { display: truncated, revealed: true };
  }
  if (value.length < 6) {
    return { display: "****", revealed: false };
  }
  const prefix = value.slice(0, 3);
  return { display: `${prefix}•••• (${value.length} chars)`, revealed: false };
}

function isNonSecret(name: string): boolean {
  if (NON_SECRET_NAMES.has(name)) return true;
  if (name.startsWith("npm_")) return true;
  return false;
}

// ─── Categorization ───────────────────────────────────────────────────

export function categorizeEnvVar(name: string): EnvCategory {
  const n = name.toUpperCase();
  // Check domain-specific prefixes before the generic _API_KEY rule
  // so SENDGRID_API_KEY lands in "mail" rather than "api_key"
  if (n.startsWith("DATABASE") || n.includes("DB_") || n.startsWith("POSTGRES") || n.startsWith("MYSQL") || n.startsWith("TIDB")) {
    return "database";
  }
  if (n.startsWith("AWS_") || n.startsWith("S3_")) {
    return "aws";
  }
  if (n.startsWith("SMTP") || n.startsWith("MAIL") || n.includes("SENDGRID") || n.includes("POSTMARK")) {
    return "mail";
  }
  if (n.startsWith("OTEL") || n.startsWith("DATADOG") || n.startsWith("SENTRY") || n.includes("GRAFANA")) {
    return "observability";
  }
  if (n.startsWith("FEATURE_") || n.startsWith("ENABLE_") || n.startsWith("DISABLE_")) {
    return "feature_flag";
  }
  // Auth patterns take precedence over the generic api_key fallback
  // so SESSION_KEY and JWT_SECRET land in "auth" rather than "api_key"
  if (n.startsWith("AUTH") || n.includes("JWT") || n.includes("SESSION") || n.includes("PASSWORD")) {
    return "auth";
  }
  if (n.endsWith("_API_KEY") || n.endsWith("_KEY") || n.endsWith("_TOKEN") || n.includes("APIKEY")) {
    return "api_key";
  }
  if (n.includes("SECRET")) {
    return "auth";
  }
  if (/URL$|_URI$|_ENDPOINT$/.test(n)) {
    return "service_url";
  }
  return "general";
}

// ─── Expected / required vars ─────────────────────────────────────────

/** Variables the app strongly expects to find */
export const EXPECTED_VARS: string[] = [
  "NODE_ENV",
  "DATABASE_URL",
  "PORT",
];

/** Variables whose absence makes the app unusable */
export const REQUIRED_VARS: string[] = [
  "DATABASE_URL",
];

// ─── Top-level snapshot builder ──────────────────────────────────────

export function buildEnvSnapshot(
  env: Record<string, string | undefined>,
  opts: {
    /** Extra vars the caller wants to check for presence */
    additionalExpected?: string[];
    /** Extra vars the caller wants to mark as required */
    additionalRequired?: string[];
    /** Optional allow list — when set, only these vars appear in the snapshot */
    allowList?: string[];
    /** Whether to include non-set expected vars as entries */
    includeMissing?: boolean;
  } = {},
): EnvSnapshot {
  const expected = new Set([
    ...EXPECTED_VARS,
    ...(opts.additionalExpected ?? []),
  ]);
  const required = new Set([
    ...REQUIRED_VARS,
    ...(opts.additionalRequired ?? []),
  ]);
  const allowList = opts.allowList ? new Set(opts.allowList) : null;

  const entries: EnvVarEntry[] = [];
  const byCategory: Record<EnvCategory, number> = {
    database: 0,
    api_key: 0,
    auth: 0,
    feature_flag: 0,
    service_url: 0,
    aws: 0,
    mail: 0,
    observability: 0,
    general: 0,
  };

  const seen = new Set<string>();
  const present = Object.keys(env).filter((k) => env[k] !== undefined);

  for (const name of present) {
    if (allowList && !allowList.has(name)) continue;
    seen.add(name);
    const raw = env[name]!;
    const { display, revealed } = maskValue(name, raw);
    const category = categorizeEnvVar(name);
    byCategory[category]++;
    entries.push({
      name,
      category,
      displayValue: display,
      length: raw.length,
      revealed,
      present: true,
      missing: false,
      required: required.has(name),
    });
  }

  // Synthesize missing entries for expected vars that weren't seen
  let missingCount = 0;
  let requiredMissing = 0;
  if (opts.includeMissing !== false) {
    for (const name of Array.from(expected)) {
      if (seen.has(name)) continue;
      if (allowList && !allowList.has(name)) continue;
      missingCount++;
      if (required.has(name)) requiredMissing++;
      const category = categorizeEnvVar(name);
      entries.push({
        name,
        category,
        displayValue: "",
        length: 0,
        revealed: false,
        present: false,
        missing: true,
        required: required.has(name),
      });
    }
  }

  // Sort: missing required first, then missing, then present by name
  entries.sort((a, b) => {
    if (a.missing !== b.missing) return a.missing ? -1 : 1;
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    entries,
    byCategory,
    missingCount,
    requiredMissing,
    totalPresent: present.length,
  };
}

// ─── Filter ───────────────────────────────────────────────────────────

export interface EnvFilter {
  category?: EnvCategory;
  onlyMissing?: boolean;
  search?: string;
}

export function filterEntries(
  entries: EnvVarEntry[],
  filter: EnvFilter,
): EnvVarEntry[] {
  return entries.filter((e) => {
    if (filter.category && e.category !== filter.category) return false;
    if (filter.onlyMissing && !e.missing) return false;
    if (filter.search) {
      const s = filter.search.toLowerCase();
      if (
        !e.name.toLowerCase().includes(s) &&
        !e.category.toLowerCase().includes(s)
      ) {
        return false;
      }
    }
    return true;
  });
}
