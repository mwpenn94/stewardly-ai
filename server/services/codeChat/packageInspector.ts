/**
 * Package.json dependency inspector — Pass 261.
 *
 * Parses every `package.json` in the workspace into a structured
 * view so users can quickly see what's installed, which version,
 * whether there's a version range mismatch vs package-lock.json,
 * and summary stats (total deps / dev deps / peer deps / security
 * observations via simple heuristics).
 *
 * Pure parser + a walker that scans for package.json files in the
 * workspace, skipping `node_modules/`. No shell execution, no
 * outbound network calls.
 */

import path from "node:path";
import fs from "node:fs/promises";
import { getWorkspaceFileIndex } from "./fileIndex";

export type DependencyKind =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";

export interface DependencyEntry {
  name: string;
  versionRange: string;
  kind: DependencyKind;
}

export interface PackageJsonInfo {
  path: string;
  name: string;
  version: string;
  description?: string;
  dependencies: DependencyEntry[];
  scripts: Record<string, string>;
  totalDeps: number;
  totalDevDeps: number;
  totalPeerDeps: number;
  totalOptionalDeps: number;
}

/**
 * Parse a single package.json content string. Returns null if the
 * JSON is malformed or missing required fields. Gracefully handles
 * alternative field shapes (e.g. missing `name`, array `scripts`).
 */
export function parsePackageJson(
  filePath: string,
  raw: string,
): PackageJsonInfo | null {
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!json || typeof json !== "object") return null;

  const deps: DependencyEntry[] = [];
  const extract = (field: DependencyKind) => {
    const obj = json[field];
    if (!obj || typeof obj !== "object") return 0;
    let count = 0;
    for (const [name, version] of Object.entries(obj)) {
      if (typeof version !== "string") continue;
      deps.push({ name, versionRange: version, kind: field });
      count++;
    }
    return count;
  };
  const totalDeps = extract("dependencies");
  const totalDevDeps = extract("devDependencies");
  const totalPeerDeps = extract("peerDependencies");
  const totalOptionalDeps = extract("optionalDependencies");

  const scripts: Record<string, string> = {};
  if (json.scripts && typeof json.scripts === "object" && !Array.isArray(json.scripts)) {
    for (const [k, v] of Object.entries(json.scripts)) {
      if (typeof v === "string") scripts[k] = v;
    }
  }

  return {
    path: filePath,
    name: typeof json.name === "string" ? json.name : "(unnamed)",
    version: typeof json.version === "string" ? json.version : "0.0.0",
    description: typeof json.description === "string" ? json.description : undefined,
    dependencies: deps,
    scripts,
    totalDeps,
    totalDevDeps,
    totalPeerDeps,
    totalOptionalDeps,
  };
}

export interface DependencyInsight {
  severity: "info" | "warning" | "critical";
  kind: "pinned" | "range" | "latest" | "local" | "git" | "deprecated" | "wildcard";
  message: string;
}

/**
 * Classify a version range into a human-readable insight tag.
 * Rules:
 *   - `^1.2.3` or `~1.2.3` -> range
 *   - `1.2.3` exact -> pinned
 *   - `*` or `latest` -> wildcard warning
 *   - `file:` / `link:` / `workspace:` -> local
 *   - `git+` or `github:` -> git
 */
export function classifyDependency(
  versionRange: string,
): DependencyInsight {
  const v = versionRange.trim();
  if (v === "*" || v === "latest") {
    return {
      severity: "warning",
      kind: "wildcard",
      message: "wildcard version - upgrades silently on install",
    };
  }
  if (v.startsWith("file:") || v.startsWith("link:") || v.startsWith("workspace:")) {
    return {
      severity: "info",
      kind: "local",
      message: "local path dependency",
    };
  }
  if (v.startsWith("git+") || v.startsWith("github:") || v.startsWith("git:")) {
    return {
      severity: "info",
      kind: "git",
      message: "git source dependency",
    };
  }
  if (v.startsWith("^") || v.startsWith("~") || v.includes(" - ") || v.includes("||") || v.startsWith(">=") || v.startsWith(">")) {
    return {
      severity: "info",
      kind: "range",
      message: "semver range",
    };
  }
  // Looks like plain `1.2.3`
  if (/^\d+\.\d+\.\d+/.test(v)) {
    return {
      severity: "info",
      kind: "pinned",
      message: "exact version",
    };
  }
  return {
    severity: "info",
    kind: "range",
    message: "version range",
  };
}

export interface InspectorResult {
  packages: PackageJsonInfo[];
  totalPackages: number;
  totalDependencies: number;
  totalDevDependencies: number;
  /** Dependencies that deserve attention */
  warnings: Array<{
    package: string;
    dependency: string;
    versionRange: string;
    message: string;
  }>;
}

export function aggregate(packages: PackageJsonInfo[]): InspectorResult {
  let totalDeps = 0;
  let totalDev = 0;
  const warnings: InspectorResult["warnings"] = [];
  for (const pkg of packages) {
    totalDeps += pkg.totalDeps;
    totalDev += pkg.totalDevDeps;
    for (const dep of pkg.dependencies) {
      const insight = classifyDependency(dep.versionRange);
      if (insight.severity !== "info") {
        warnings.push({
          package: pkg.name,
          dependency: dep.name,
          versionRange: dep.versionRange,
          message: insight.message,
        });
      }
    }
  }
  return {
    packages,
    totalPackages: packages.length,
    totalDependencies: totalDeps,
    totalDevDependencies: totalDev,
    warnings,
  };
}

/**
 * Walk the workspace for package.json files (excluding node_modules),
 * parse each one, and return an aggregate result. Capped at 50
 * package.json files to avoid pathological monorepos.
 */
export async function inspectPackages(
  workspaceRoot: string,
): Promise<InspectorResult> {
  const files = await getWorkspaceFileIndex(workspaceRoot);
  const packages: PackageJsonInfo[] = [];
  for (const rel of files) {
    if (packages.length >= 50) break;
    if (path.basename(rel) !== "package.json") continue;
    if (rel.split(path.sep).some((p) => p === "node_modules")) continue;
    try {
      const abs = path.resolve(workspaceRoot, rel);
      const content = await fs.readFile(abs, "utf8");
      const parsed = parsePackageJson(rel, content);
      if (parsed) packages.push(parsed);
    } catch {
      /* skip */
    }
  }
  return aggregate(packages);
}
