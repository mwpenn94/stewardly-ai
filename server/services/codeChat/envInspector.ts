/**
 * Environment variables inspector — Pass 263.
 *
 * Pure helpers for parsing .env files + comparing declared vs set
 * variables. The client uses this to show onboarding gaps: which
 * env vars does the app expect (from .env.example / .env.sample)
 * vs which are actually set (from process.env on the server).
 *
 * Safety: values are NEVER exposed. The server only returns a
 * boolean `isSet` per key plus a short masked preview (first/last
 * 2 chars) when the value is non-empty. Keys with names suggesting
 * secrets (KEY, SECRET, TOKEN, PASSWORD) get extra masking.
 *
 * Pure parser + a walker that reads common .env filenames from the
 * workspace root.
 */

import path from "node:path";
import fs from "node:fs/promises";

export type EnvSource = ".env.example" | ".env.sample" | ".env.template" | "other";

export interface EnvDeclaration {
  key: string;
  /** Example value as listed in the template (for type hints) */
  exampleValue: string;
  /** Source file the declaration came from */
  source: string;
  /** Line number in the source file */
  line: number;
  /** Comment preceding the declaration, if any */
  comment?: string;
}

/**
 * Parse a .env-style text file into declarations. Handles:
 *   - KEY=value
 *   - KEY="quoted value"
 *   - KEY='single-quoted value'
 *   - Comments (# prefix), which are attached to the next declaration
 *   - Blank lines (reset comment buffer)
 *   - export KEY=value (shell export prefix)
 *
 * Does NOT interpolate nested variables — the goal is inventory,
 * not runtime evaluation.
 */
export function parseEnvFile(source: string, raw: string): EnvDeclaration[] {
  const out: EnvDeclaration[] = [];
  if (!raw) return out;
  const lines = raw.split(/\r?\n/);
  let pendingComment: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      pendingComment = null;
      continue;
    }
    if (trimmed.startsWith("#")) {
      const text = trimmed.slice(1).trim();
      pendingComment = pendingComment ? `${pendingComment} ${text}` : text;
      continue;
    }
    // Strip optional `export ` prefix
    const withoutExport = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const eqIdx = withoutExport.indexOf("=");
    if (eqIdx <= 0) {
      pendingComment = null;
      continue;
    }
    const key = withoutExport.slice(0, eqIdx).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      pendingComment = null;
      continue;
    }
    let value = withoutExport.slice(eqIdx + 1).trim();
    // Strip matching quotes
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    out.push({
      key,
      exampleValue: value,
      source,
      line: i + 1,
      comment: pendingComment ?? undefined,
    });
    pendingComment = null;
  }
  return out;
}

/**
 * Heuristic: does this key name suggest a secret that we should
 * never preview?
 */
export function isSecretKey(key: string): boolean {
  return /(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|SIGNING|HASH|SALT|CREDENTIAL|AUTH)/i.test(key);
}

/**
 * Produce a safe preview of an env var value. Secrets get `***`
 * regardless. Non-secrets get the first 2 and last 2 characters
 * when longer than 6 chars, otherwise fully masked.
 */
export function maskValue(key: string, value: string | undefined): string {
  if (!value) return "(unset)";
  if (isSecretKey(key)) return "***";
  if (value.length <= 6) return "***";
  return `${value.slice(0, 2)}${"*".repeat(Math.min(6, value.length - 4))}${value.slice(-2)}`;
}

export interface EnvReport {
  declared: EnvDeclaration[];
  missing: string[];
  extras: string[];
  status: Array<{
    key: string;
    declared: boolean;
    set: boolean;
    preview: string;
    source?: string;
    comment?: string;
    isSecret: boolean;
  }>;
  summary: {
    totalDeclared: number;
    totalSet: number;
    totalMissing: number;
    totalExtras: number;
  };
}

/**
 * Given a set of declared vars (from template files) and a
 * snapshot of process.env, produce a report showing which are set,
 * which are missing, and which are set but not declared.
 */
export function buildReport(
  declared: EnvDeclaration[],
  envSnapshot: Record<string, string | undefined>,
): EnvReport {
  const declaredKeys = new Set(declared.map((d) => d.key));
  const missing: string[] = [];
  const status: EnvReport["status"] = [];

  const declaredByKey = new Map<string, EnvDeclaration>();
  for (const d of declared) {
    // If multiple template files declare the same key, keep the first
    if (!declaredByKey.has(d.key)) declaredByKey.set(d.key, d);
  }

  declaredByKey.forEach((decl, key) => {
    const rawValue = envSnapshot[key];
    const isSet = typeof rawValue === "string" && rawValue.length > 0;
    if (!isSet) missing.push(key);
    status.push({
      key,
      declared: true,
      set: isSet,
      preview: isSet ? maskValue(key, rawValue) : "(unset)",
      source: decl.source,
      comment: decl.comment,
      isSecret: isSecretKey(key),
    });
  });

  // Extras: set but not declared (within a filtered subset — we only
  // look at common prefixes to avoid spamming every PATH/HOME entry)
  const extras: string[] = [];
  const commonPrefixes = [
    "APP_",
    "API_",
    "AUTH_",
    "DATABASE_",
    "DB_",
    "SERVICE_",
    "FEATURE_",
    "FORGE_",
    "NEXT_",
    "REACT_",
    "VITE_",
    "STEWARDLY_",
  ];
  for (const key of Object.keys(envSnapshot)) {
    if (declaredKeys.has(key)) continue;
    if (!commonPrefixes.some((p) => key.startsWith(p))) continue;
    extras.push(key);
  }

  return {
    declared,
    missing: missing.sort(),
    extras: extras.sort(),
    status: status.sort((a, b) => a.key.localeCompare(b.key)),
    summary: {
      totalDeclared: declaredKeys.size,
      totalSet: status.filter((s) => s.set).length,
      totalMissing: missing.length,
      totalExtras: extras.length,
    },
  };
}

/**
 * Walk the workspace root for .env template files and parse them
 * into a combined declaration list. Skips `.env` / `.env.local`
 * (those may contain real secrets).
 */
export async function loadTemplates(workspaceRoot: string): Promise<EnvDeclaration[]> {
  const candidates = [
    ".env.example",
    ".env.sample",
    ".env.template",
    "env.example",
  ];
  const out: EnvDeclaration[] = [];
  for (const name of candidates) {
    try {
      const abs = path.resolve(workspaceRoot, name);
      const content = await fs.readFile(abs, "utf8");
      const parsed = parseEnvFile(name, content);
      out.push(...parsed);
    } catch {
      /* file missing — skip */
    }
  }
  return out;
}
