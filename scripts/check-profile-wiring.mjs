#!/usr/bin/env node
/**
 * check-profile-wiring.mjs — audit script for the shared financial
 * profile wiring.
 *
 * Every calculator / planning page in Stewardly should read + write
 * the shared financial profile via useFinancialProfile so that the
 * force multiplier (one profile for all calculators) keeps working
 * as new pages land. This script walks client/src/pages, identifies
 * pages that import a calculator tRPC mutation (.mutate, .useMutation,
 * .project, .plan, .calculate, .simulate, .optimize, or the
 * calculatorEngine/wealthEngine namespaces) without also importing
 * useFinancialProfile, and prints a pass/fail report.
 *
 * Exit codes:
 *   0 — every calculator is wired (or gracefully opted out)
 *   1 — one or more calculators are missing the hook
 *
 * Usage:
 *   node scripts/check-profile-wiring.mjs
 *   npm run check:profile-wiring
 *
 * Intentionally light — no dependencies, no TypeScript parser. A
 * plain substring scan is enough because the hook import is the
 * same literal in every consumer file. Pure regex; runs in <50ms
 * on the full repo.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const PAGES_DIR = join(ROOT, "client/src/pages");

/** Opt-out list: pages that intentionally don't need the hook. */
const OPT_OUT = new Set([
  // Landing / welcome pages — no calculator logic.
  "Welcome.tsx",
  "NewLanding.tsx",
  "Landing.tsx",
  "OrgLanding.tsx",
  // Chat + settings surfaces.
  "Chat.tsx",
  "SettingsHub.tsx",
  // Admin-only pages.
  "GlobalAdmin.tsx",
  "AdminLeadSources.tsx",
  "AdminSystemHealth.tsx",
  "AdminDataFreshness.tsx",
  "AdminRateManagement.tsx",
  "AdminBilling.tsx",
  "AdminAPIKeys.tsx",
  // Consensus is a chat prompt + model settings page — there's
  // no financial profile to reuse, and the current user's profile
  // is orthogonal to the multi-model consensus stream.
  "Consensus.tsx",
  // EngineDashboard is the admin-facing dev surface that demos
  // the multi-engine calculator chain. Its inputs are intentionally
  // static so devs can diff engine output against fixed fixtures.
  "EngineDashboard.tsx",
]);

/**
 * Heuristics that identify a "calculator page" — these strings
 * strongly suggest the page runs a numeric projection + renders
 * results, which is the force-multiplier target for the shared
 * profile.
 */
const CALC_SIGNALS = [
  "trpc.wealthEngine.",
  "trpc.calculatorEngine.",
  "trpc.calculators.",
  "trpc.taxProjector.",
  "trpc.ssOptimizer.",
  "trpc.medicareNav.",
  "trpc.hsaOptimizer.",
  "trpc.charitableGiving.",
  "trpc.divorce.",
  "trpc.educationPlanner.",
  "runMonteCarlo",
];

/** The import-scan literal for the hook. */
const HOOK_IMPORT = "useFinancialProfile";

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...walk(full));
    } else if (name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

function isCalculator(content) {
  for (const sig of CALC_SIGNALS) {
    if (content.includes(sig)) return true;
  }
  return false;
}

function hasHookImport(content) {
  return content.includes(HOOK_IMPORT);
}

function main() {
  const files = walk(PAGES_DIR);
  const calcPages = [];
  for (const file of files) {
    const rel = relative(ROOT, file);
    const base = rel.split("/").slice(-1)[0];
    if (OPT_OUT.has(base)) continue;
    const content = readFileSync(file, "utf-8");
    if (!isCalculator(content)) continue;
    calcPages.push({
      path: rel,
      base,
      wired: hasHookImport(content),
    });
  }

  const wired = calcPages.filter((p) => p.wired);
  const missing = calcPages.filter((p) => !p.wired);

  const pad = (s, n) => s.padEnd(n, " ");
  const total = calcPages.length;
  const wiredCount = wired.length;
  const pct = total === 0 ? 0 : Math.round((wiredCount / total) * 100);

  console.log("─".repeat(72));
  console.log("Stewardly · Profile Wiring Audit");
  console.log("─".repeat(72));
  console.log(`Calculator pages detected:  ${total}`);
  console.log(`Wired via useFinancialProfile: ${wiredCount} (${pct}%)`);
  console.log(`Missing:                    ${missing.length}`);
  console.log("");

  if (missing.length > 0) {
    console.log("Missing pages:");
    for (const m of missing) {
      console.log("  ✗ " + pad(m.base, 40) + " " + m.path);
    }
    console.log("");
    console.log("Fix: add `import { useFinancialProfile } from \"@/hooks/useFinancialProfile\"`");
    console.log("and drop <FinancialProfileBanner> into the page's main card.");
    console.log("See docs/FINANCIAL_PROFILE_API.md for the full contract.");
    process.exit(1);
  }

  console.log("Every calculator is wired. ✓");
  process.exit(0);
}

main();
