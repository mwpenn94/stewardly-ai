/**
 * NPM outdated + audit parser (Pass 260).
 *
 * Claude Code lets users run `npm outdated` and `npm audit` from the
 * UI and see a structured list of out-of-date or vulnerable deps
 * instead of parsing CLI JSON output in their head.
 *
 * This module is the pure parser side. `npm outdated --json` emits
 * an object keyed by package name with `{current, wanted, latest,
 * type, location}` values. `npm audit --json` emits a
 * `{vulnerabilities: {...}}` object. We convert both to structured
 * lists plus summary counts.
 */

export type UpdateSemver = "patch" | "minor" | "major" | "none";

export interface OutdatedEntry {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  /** "dependencies" / "devDependencies" / "optionalDependencies" */
  type: string;
  /** Difference between `current` and `latest` */
  severity: UpdateSemver;
}

export type VulnSeverity = "critical" | "high" | "moderate" | "low" | "info";

export interface VulnEntry {
  name: string;
  severity: VulnSeverity;
  range?: string;
  fixAvailable?: boolean;
  /** Short advisory title from the npm audit stream */
  title?: string;
  via?: string[];
}

// ─── Outdated parser ──────────────────────────────────────────────────

/**
 * Parse `npm outdated --json`. The shape is:
 *   { "package-name": { current, wanted, latest, type, location } }
 *
 * Note: npm returns exit code 1 when any packages are outdated, so
 * callers must capture stdout even on non-zero exit codes.
 */
export function parseNpmOutdated(raw: string): OutdatedEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const obj = parsed as Record<string, unknown>;
  const out: OutdatedEntry[] = [];
  for (const [name, entry] of Object.entries(obj)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const current = typeof e.current === "string" ? e.current : "";
    const wanted = typeof e.wanted === "string" ? e.wanted : "";
    const latest = typeof e.latest === "string" ? e.latest : "";
    const type = typeof e.type === "string" ? e.type : "dependencies";
    if (!current || !latest) continue;
    out.push({
      name,
      current,
      wanted,
      latest,
      type,
      severity: classifyUpdate(current, latest),
    });
  }
  return out.sort((a, b) => {
    const order = { major: 0, minor: 1, patch: 2, none: 3 };
    if (order[a.severity] !== order[b.severity])
      return order[a.severity] - order[b.severity];
    return a.name.localeCompare(b.name);
  });
}

/**
 * Classify the update severity based on semver delta between two
 * versions. Handles pre-release suffixes by stripping them.
 */
export function classifyUpdate(current: string, latest: string): UpdateSemver {
  const clean = (v: string) => v.replace(/^[~^]/, "").split("-")[0] ?? "";
  const [cmaj, cmin, cpatch] = clean(current).split(".").map((n) => Number.parseInt(n, 10) || 0);
  const [lmaj, lmin, lpatch] = clean(latest).split(".").map((n) => Number.parseInt(n, 10) || 0);
  if (cmaj === undefined || lmaj === undefined) return "none";
  if (lmaj > cmaj) return "major";
  if (lmin! > (cmin ?? 0)) return "minor";
  if (lpatch! > (cpatch ?? 0)) return "patch";
  return "none";
}

// ─── Audit parser ──────────────────────────────────────────────────────

/**
 * Parse `npm audit --json`. The shape varies by npm version but the
 * v7+ layout is:
 *
 *   {
 *     "vulnerabilities": {
 *       "pkg-name": {
 *         "severity": "high",
 *         "range": "<1.2.3",
 *         "via": [...],
 *         "fixAvailable": true | false | { ... }
 *       }
 *     },
 *     "metadata": { "vulnerabilities": { info, low, moderate, high, critical, total } }
 *   }
 */
export function parseNpmAudit(raw: string): {
  entries: VulnEntry[];
  summary: Record<VulnSeverity, number> & { total: number };
} {
  const summary: Record<VulnSeverity, number> & { total: number } = {
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
    info: 0,
    total: 0,
  };
  if (!raw) return { entries: [], summary };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { entries: [], summary };
  }
  if (!parsed || typeof parsed !== "object") return { entries: [], summary };
  const root = parsed as Record<string, unknown>;
  const vulns = root.vulnerabilities;
  if (!vulns || typeof vulns !== "object") return { entries: [], summary };

  const entries: VulnEntry[] = [];
  for (const [name, entry] of Object.entries(vulns)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const rawSeverity = typeof e.severity === "string" ? e.severity : "info";
    const severity = (["critical", "high", "moderate", "low", "info"] as VulnSeverity[]).includes(
      rawSeverity as VulnSeverity,
    )
      ? (rawSeverity as VulnSeverity)
      : "info";
    summary[severity]++;
    summary.total++;

    // `fixAvailable` is sometimes a bool, sometimes an object — normalize
    let fixAvailable: boolean | undefined;
    if (typeof e.fixAvailable === "boolean") fixAvailable = e.fixAvailable;
    else if (e.fixAvailable && typeof e.fixAvailable === "object")
      fixAvailable = true;

    // `via` is an array of either strings or objects; extract string names
    const viaNames: string[] = [];
    if (Array.isArray(e.via)) {
      for (const v of e.via) {
        if (typeof v === "string") viaNames.push(v);
        else if (v && typeof v === "object") {
          const src = (v as Record<string, unknown>).source;
          const n = (v as Record<string, unknown>).name;
          if (typeof n === "string") viaNames.push(n);
          else if (typeof src === "string") viaNames.push(src);
        }
      }
    }

    entries.push({
      name,
      severity,
      range: typeof e.range === "string" ? e.range : undefined,
      fixAvailable,
      title: viaNames[0],
      via: viaNames,
    });
  }

  // Sort by severity rank (critical → info) then name
  const order: Record<VulnSeverity, number> = {
    critical: 0,
    high: 1,
    moderate: 2,
    low: 3,
    info: 4,
  };
  entries.sort((a, b) => {
    if (order[a.severity] !== order[b.severity])
      return order[a.severity] - order[b.severity];
    return a.name.localeCompare(b.name);
  });

  return { entries, summary };
}

// ─── Filters ──────────────────────────────────────────────────────────

export interface OutdatedFilter {
  severity?: UpdateSemver;
  type?: string;
  search?: string;
}

export function filterOutdated(
  entries: OutdatedEntry[],
  filter: OutdatedFilter,
): OutdatedEntry[] {
  return entries.filter((e) => {
    if (filter.severity && e.severity !== filter.severity) return false;
    if (filter.type && e.type !== filter.type) return false;
    if (filter.search && !e.name.toLowerCase().includes(filter.search.toLowerCase())) {
      return false;
    }
    return true;
  });
}

export interface VulnFilter {
  minSeverity?: VulnSeverity;
  search?: string;
}

const SEVERITY_RANK: Record<VulnSeverity, number> = {
  critical: 4,
  high: 3,
  moderate: 2,
  low: 1,
  info: 0,
};

export function filterVulns(
  entries: VulnEntry[],
  filter: VulnFilter,
): VulnEntry[] {
  return entries.filter((e) => {
    if (filter.minSeverity) {
      if (SEVERITY_RANK[e.severity] < SEVERITY_RANK[filter.minSeverity]) {
        return false;
      }
    }
    if (filter.search && !e.name.toLowerCase().includes(filter.search.toLowerCase())) {
      return false;
    }
    return true;
  });
}
