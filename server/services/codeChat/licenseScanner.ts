/**
 * Dependency license scanner (Pass 258).
 *
 * Walks `package.json` + every direct + transitive dependency's
 * `package.json` to extract the declared license field, bucket by
 * SPDX identifier, and flag anything that looks risky for a
 * commercial codebase (GPL, AGPL, SSPL, unknown).
 *
 * This module is pure — no I/O. The tRPC layer reads disk and feeds
 * in an array of `{name, version, license, path}` rows; the pure
 * side handles categorization + summary + risk flagging.
 */

export type LicenseCategory =
  | "permissive"
  | "weak_copyleft"
  | "strong_copyleft"
  | "commercial"
  | "unknown";

export interface DependencyEntry {
  name: string;
  version: string;
  license: string;
  path?: string;
}

export interface ClassifiedDependency extends DependencyEntry {
  category: LicenseCategory;
  /** Risk level 0-3: 0=safe, 1=caution, 2=warn, 3=block */
  risk: 0 | 1 | 2 | 3;
  /** Human-readable reason for the risk level */
  note?: string;
}

// ─── License classification ──────────────────────────────────────────

const PERMISSIVE_LICENSES = new Set([
  "MIT",
  "MIT-0",
  "APACHE-2.0",
  "APACHE",
  "BSD",
  "BSD-2-CLAUSE",
  "BSD-3-CLAUSE",
  "BSD-3-CLAUSE-NO-NUCLEAR-WARRANTY",
  "ISC",
  "ZLIB",
  "UNLICENSE",
  "0BSD",
  "CC0-1.0",
  "CC0",
  "WTFPL",
  "PYTHON-2.0",
  "BLUEOAK-1.0.0",
  "PSF",
]);

const WEAK_COPYLEFT = new Set([
  "LGPL",
  "LGPL-2.0",
  "LGPL-2.1",
  "LGPL-3.0",
  "LGPL-2.0+",
  "LGPL-2.1+",
  "LGPL-3.0+",
  "LGPL-2.0-OR-LATER",
  "LGPL-2.1-OR-LATER",
  "LGPL-3.0-OR-LATER",
  "MPL-2.0",
  "MPL-1.1",
  "MPL",
  "EPL-1.0",
  "EPL-2.0",
  "CDDL-1.0",
  "CDDL-1.1",
]);

const STRONG_COPYLEFT = new Set([
  "GPL",
  "GPL-2.0",
  "GPL-3.0",
  "GPL-2.0+",
  "GPL-3.0+",
  "GPL-2.0-ONLY",
  "GPL-2.0-OR-LATER",
  "GPL-3.0-ONLY",
  "GPL-3.0-OR-LATER",
  "AGPL",
  "AGPL-1.0",
  "AGPL-3.0",
  "AGPL-3.0-ONLY",
  "AGPL-3.0-OR-LATER",
  "SSPL-1.0",
]);

const COMMERCIAL_MARKERS = [
  "COMMERCIAL",
  "UNLICENSED",
  "PROPRIETARY",
  "SEE LICENSE IN",
  "CUSTOM",
];

/**
 * Classify a license string into a category. Accepts SPDX expressions
 * like `(MIT OR Apache-2.0)` — the first matching identifier wins.
 */
export function classifyLicense(raw: string): LicenseCategory {
  if (!raw) return "unknown";
  const upper = raw.toUpperCase();

  // SPDX expressions: "(MIT OR Apache-2.0)" → check each identifier
  // and return the MOST permissive category (so a MIT OR GPL dep
  // can be taken on the MIT side).
  const identifiers = upper
    .replace(/[()]/g, "")
    .split(/\bOR\b|\bAND\b|\bWITH\b/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (identifiers.length > 1) {
    const categories = identifiers.map((id) => classifySingle(id));
    // Order: permissive > weak_copyleft > strong_copyleft > commercial > unknown
    if (categories.includes("permissive")) return "permissive";
    if (categories.includes("weak_copyleft")) return "weak_copyleft";
    if (categories.includes("strong_copyleft")) return "strong_copyleft";
    if (categories.includes("commercial")) return "commercial";
    return "unknown";
  }

  return classifySingle(upper);
}

function classifySingle(upper: string): LicenseCategory {
  if (PERMISSIVE_LICENSES.has(upper)) return "permissive";
  if (WEAK_COPYLEFT.has(upper)) return "weak_copyleft";
  if (STRONG_COPYLEFT.has(upper)) return "strong_copyleft";
  for (const marker of COMMERCIAL_MARKERS) {
    if (upper.includes(marker)) return "commercial";
  }
  return "unknown";
}

// ─── Risk assessment ─────────────────────────────────────────────────

export function assessRisk(
  category: LicenseCategory,
): { risk: 0 | 1 | 2 | 3; note?: string } {
  switch (category) {
    case "permissive":
      return { risk: 0 };
    case "weak_copyleft":
      return {
        risk: 1,
        note: "Weak copyleft — dynamic linking generally safe",
      };
    case "strong_copyleft":
      return {
        risk: 3,
        note: "Strong copyleft — review required before commercial use",
      };
    case "commercial":
      return { risk: 2, note: "Proprietary license — review terms" };
    case "unknown":
      return { risk: 2, note: "Unknown license — manual review needed" };
  }
}

// ─── Classification pipeline ─────────────────────────────────────────

export function classifyDependency(dep: DependencyEntry): ClassifiedDependency {
  const category = classifyLicense(dep.license ?? "");
  const { risk, note } = assessRisk(category);
  return { ...dep, category, risk, note };
}

export function classifyDependencies(
  deps: DependencyEntry[],
): ClassifiedDependency[] {
  return deps.map(classifyDependency).sort((a, b) => {
    // Sort risky items first
    if (a.risk !== b.risk) return b.risk - a.risk;
    return a.name.localeCompare(b.name);
  });
}

// ─── Summary + grouping ──────────────────────────────────────────────

export interface LicenseSummary {
  total: number;
  byCategory: Record<LicenseCategory, number>;
  byLicense: Array<{ license: string; count: number }>;
  risky: ClassifiedDependency[];
  /** Max risk level across all deps */
  highestRisk: 0 | 1 | 2 | 3;
}

export function summarizeLicenses(
  classified: ClassifiedDependency[],
): LicenseSummary {
  const byCategory: Record<LicenseCategory, number> = {
    permissive: 0,
    weak_copyleft: 0,
    strong_copyleft: 0,
    commercial: 0,
    unknown: 0,
  };
  const byLicense = new Map<string, number>();
  const risky: ClassifiedDependency[] = [];
  let highestRisk: 0 | 1 | 2 | 3 = 0;
  for (const d of classified) {
    byCategory[d.category]++;
    const key = d.license || "(missing)";
    byLicense.set(key, (byLicense.get(key) ?? 0) + 1);
    if (d.risk >= 2) risky.push(d);
    if (d.risk > highestRisk) highestRisk = d.risk;
  }
  const byLicenseSorted = Array.from(byLicense.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([license, count]) => ({ license, count }));
  return {
    total: classified.length,
    byCategory,
    byLicense: byLicenseSorted,
    risky,
    highestRisk,
  };
}

// ─── Filter ──────────────────────────────────────────────────────────

export interface LicenseFilter {
  category?: LicenseCategory;
  minRisk?: 0 | 1 | 2 | 3;
  search?: string;
}

export function filterDependencies(
  deps: ClassifiedDependency[],
  filter: LicenseFilter,
): ClassifiedDependency[] {
  return deps.filter((d) => {
    if (filter.category && d.category !== filter.category) return false;
    if (filter.minRisk !== undefined && d.risk < filter.minRisk) return false;
    if (filter.search) {
      const s = filter.search.toLowerCase();
      if (
        !d.name.toLowerCase().includes(s) &&
        !d.license.toLowerCase().includes(s)
      ) {
        return false;
      }
    }
    return true;
  });
}

// ─── package.json extraction ────────────────────────────────────────

/**
 * Extract the `license` field from a parsed `package.json`. Handles
 * the three common shapes:
 *  - string: `"license": "MIT"`
 *  - object: `"license": {type: "MIT", url: "..."}`
 *  - array of objects: `"licenses": [{type: "MIT"}, {type: "Apache-2.0"}]`
 *    → joined with " OR " to form an SPDX-like expression.
 * Returns `""` when no license field is present.
 */
export function extractLicense(pkg: unknown): string {
  if (!pkg || typeof pkg !== "object") return "";
  const p = pkg as Record<string, unknown>;

  const direct = p.license;
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object") {
    const type = (direct as Record<string, unknown>).type;
    if (typeof type === "string") return type;
  }

  const multi = p.licenses;
  if (Array.isArray(multi)) {
    const names: string[] = [];
    for (const entry of multi) {
      if (typeof entry === "string") names.push(entry);
      else if (entry && typeof entry === "object") {
        const type = (entry as Record<string, unknown>).type;
        if (typeof type === "string") names.push(type);
      }
    }
    if (names.length > 0) return names.join(" OR ");
  }

  return "";
}
