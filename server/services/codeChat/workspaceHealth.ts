/**
 * Workspace health dashboard (Pass 261).
 *
 * Pulls signals from every inspector built across passes 244-260
 * (diagnostics, circular deps, TODO markers, dead code, outdated
 * deps, vulnerabilities, git dirty state) and aggregates them into
 * a single composite health score with per-category breakdowns.
 *
 * Users see a single "is the workspace healthy right now?" panel
 * instead of having to visit 12+ tabs to know the current state.
 *
 * This module is pure — the tRPC layer gathers the inputs from the
 * existing cached sources and passes them in. Score weighting is
 * intentionally explicit so users can reason about why a number
 * moved.
 */

export type HealthCategory =
  | "diagnostics"
  | "tests"
  | "security"
  | "freshness"
  | "structure"
  | "markers";

export type HealthStatus = "healthy" | "warning" | "critical";

export interface HealthInput {
  /** From getDiagnostics — typescript compiler errors */
  tsErrors: number;
  tsWarnings: number;
  /** From getDiagnostics run meta */
  diagnosticsDurationMs?: number;
  /** From runTests — last run summary */
  testsFailed: number;
  testsTotal: number;
  testsPassed: number;
  /** From npmInspect — outdated breakdown */
  outdatedMajor: number;
  outdatedMinor: number;
  outdatedPatch: number;
  /** From npmInspect — audit breakdown */
  vulnCritical: number;
  vulnHigh: number;
  vulnModerate: number;
  /** From findCircularDeps */
  circularCycles: number;
  circularFilesInCycles: number;
  /** From detectDeadCode */
  deadExports: number;
  orphanFiles: number;
  /** From scanTodoMarkers */
  todoCount: number;
  fixmeCount: number;
  bugCount: number;
  hackCount: number;
  /** From gitWorkspaceStatus */
  gitDirtyFiles: number;
  gitStaged: number;
  gitUntracked: number;
}

export interface HealthScoreBreakdown {
  category: HealthCategory;
  score: number;
  /** How much this category pulls down the overall score (0-100) */
  impact: number;
  status: HealthStatus;
  signals: string[];
}

export interface WorkspaceHealthReport {
  /** Composite score 0-100 (higher = healthier) */
  overallScore: number;
  overallStatus: HealthStatus;
  breakdown: HealthScoreBreakdown[];
  /** Flat list of the highest-impact issues for the summary strip */
  topIssues: Array<{ category: HealthCategory; description: string; severity: HealthStatus }>;
  /** Total count of actionable issues across all categories */
  totalIssues: number;
}

// ─── Weights ──────────────────────────────────────────────────────────

/**
 * Each category contributes up to its weight to the overall score.
 * Sum should be 100 so the overall is a straightforward average.
 */
const CATEGORY_WEIGHTS: Record<HealthCategory, number> = {
  diagnostics: 25,
  tests: 20,
  security: 25,
  freshness: 10,
  structure: 10,
  markers: 10,
};

// ─── Per-category scoring ─────────────────────────────────────────────

/**
 * TypeScript diagnostics: 1 error = -5 points, 1 warning = -1.
 * Cap at 0.
 */
export function scoreDiagnostics(input: HealthInput): HealthScoreBreakdown {
  const penalty = input.tsErrors * 5 + input.tsWarnings * 1;
  const score = Math.max(0, 100 - penalty);
  const signals: string[] = [];
  if (input.tsErrors > 0) signals.push(`${input.tsErrors} TS error${input.tsErrors === 1 ? "" : "s"}`);
  if (input.tsWarnings > 0) signals.push(`${input.tsWarnings} TS warning${input.tsWarnings === 1 ? "" : "s"}`);
  if (signals.length === 0) signals.push("clean");
  return {
    category: "diagnostics",
    score,
    impact: computeImpact(score, CATEGORY_WEIGHTS.diagnostics),
    status: input.tsErrors > 0 ? "critical" : input.tsWarnings > 0 ? "warning" : "healthy",
    signals,
  };
}

/**
 * Tests: failing tests subtract heavily; zero tests is neutral-ish.
 */
export function scoreTests(input: HealthInput): HealthScoreBreakdown {
  if (input.testsTotal === 0) {
    return {
      category: "tests",
      score: 50,
      impact: computeImpact(50, CATEGORY_WEIGHTS.tests),
      status: "warning",
      signals: ["no tests run yet"],
    };
  }
  const passRate = (input.testsPassed / input.testsTotal) * 100;
  const score = Math.max(0, Math.min(100, passRate));
  const signals: string[] = [];
  signals.push(`${input.testsPassed}/${input.testsTotal} passing`);
  if (input.testsFailed > 0) signals.push(`${input.testsFailed} failing`);
  return {
    category: "tests",
    score,
    impact: computeImpact(score, CATEGORY_WEIGHTS.tests),
    status: input.testsFailed > 0 ? "critical" : "healthy",
    signals,
  };
}

/**
 * Security: critical vuln = -40, high = -20, moderate = -5.
 */
export function scoreSecurity(input: HealthInput): HealthScoreBreakdown {
  const penalty =
    input.vulnCritical * 40 + input.vulnHigh * 20 + input.vulnModerate * 5;
  const score = Math.max(0, 100 - penalty);
  const signals: string[] = [];
  if (input.vulnCritical > 0) signals.push(`${input.vulnCritical} critical`);
  if (input.vulnHigh > 0) signals.push(`${input.vulnHigh} high`);
  if (input.vulnModerate > 0) signals.push(`${input.vulnModerate} moderate`);
  if (signals.length === 0) signals.push("no known vulns");
  return {
    category: "security",
    score,
    impact: computeImpact(score, CATEGORY_WEIGHTS.security),
    status:
      input.vulnCritical > 0
        ? "critical"
        : input.vulnHigh > 0
          ? "warning"
          : "healthy",
    signals,
  };
}

/**
 * Freshness: outdated major = -5, minor = -1, patch = -0.2.
 */
export function scoreFreshness(input: HealthInput): HealthScoreBreakdown {
  const penalty =
    input.outdatedMajor * 5 +
    input.outdatedMinor * 1 +
    input.outdatedPatch * 0.2;
  const score = Math.max(0, 100 - penalty);
  const signals: string[] = [];
  if (input.outdatedMajor > 0) signals.push(`${input.outdatedMajor} major updates`);
  if (input.outdatedMinor > 0) signals.push(`${input.outdatedMinor} minor updates`);
  if (input.outdatedPatch > 0) signals.push(`${input.outdatedPatch} patch updates`);
  if (signals.length === 0) signals.push("all packages current");
  return {
    category: "freshness",
    score,
    impact: computeImpact(score, CATEGORY_WEIGHTS.freshness),
    status:
      input.outdatedMajor > 5
        ? "warning"
        : input.outdatedMajor > 10
          ? "critical"
          : "healthy",
    signals,
  };
}

/**
 * Structure: circular deps -10 each, dead exports -0.5, orphans -2.
 */
export function scoreStructure(input: HealthInput): HealthScoreBreakdown {
  const penalty =
    input.circularCycles * 10 +
    input.deadExports * 0.5 +
    input.orphanFiles * 2;
  const score = Math.max(0, 100 - penalty);
  const signals: string[] = [];
  if (input.circularCycles > 0) signals.push(`${input.circularCycles} cycle${input.circularCycles === 1 ? "" : "s"}`);
  if (input.deadExports > 0) signals.push(`${input.deadExports} dead export${input.deadExports === 1 ? "" : "s"}`);
  if (input.orphanFiles > 0) signals.push(`${input.orphanFiles} orphan file${input.orphanFiles === 1 ? "" : "s"}`);
  if (signals.length === 0) signals.push("graph clean");
  return {
    category: "structure",
    score,
    impact: computeImpact(score, CATEGORY_WEIGHTS.structure),
    status:
      input.circularCycles > 0
        ? "warning"
        : input.orphanFiles > 10
          ? "warning"
          : "healthy",
    signals,
  };
}

/**
 * Markers: BUG -5, FIXME -3, HACK -1, TODO -0.2.
 */
export function scoreMarkers(input: HealthInput): HealthScoreBreakdown {
  const penalty =
    input.bugCount * 5 +
    input.fixmeCount * 3 +
    input.hackCount * 1 +
    input.todoCount * 0.2;
  const score = Math.max(0, 100 - penalty);
  const signals: string[] = [];
  if (input.bugCount > 0) signals.push(`${input.bugCount} BUG${input.bugCount === 1 ? "" : "s"}`);
  if (input.fixmeCount > 0) signals.push(`${input.fixmeCount} FIXME${input.fixmeCount === 1 ? "" : "s"}`);
  if (input.hackCount > 0) signals.push(`${input.hackCount} HACK${input.hackCount === 1 ? "" : "s"}`);
  if (input.todoCount > 0) signals.push(`${input.todoCount} TODO${input.todoCount === 1 ? "" : "s"}`);
  if (signals.length === 0) signals.push("no markers");
  return {
    category: "markers",
    score,
    impact: computeImpact(score, CATEGORY_WEIGHTS.markers),
    status: input.bugCount > 0 ? "warning" : "healthy",
    signals,
  };
}

// ─── Composition ──────────────────────────────────────────────────────

function computeImpact(score: number, weight: number): number {
  // How much this category "pulled down" from its weight allotment.
  // score=100 → impact=0, score=0 → impact=weight
  return Math.round((100 - score) * (weight / 100));
}

/**
 * Build the full workspace health report from the raw signals.
 * Pure — no I/O.
 */
export function computeWorkspaceHealth(input: HealthInput): WorkspaceHealthReport {
  const breakdown: HealthScoreBreakdown[] = [
    scoreDiagnostics(input),
    scoreTests(input),
    scoreSecurity(input),
    scoreFreshness(input),
    scoreStructure(input),
    scoreMarkers(input),
  ];

  // Weighted sum of per-category scores
  const totalWeight = Object.values(CATEGORY_WEIGHTS).reduce(
    (acc, w) => acc + w,
    0,
  );
  let weighted = 0;
  for (const b of breakdown) {
    const w = CATEGORY_WEIGHTS[b.category];
    weighted += (b.score / 100) * w;
  }
  const overallScore = Math.round((weighted / totalWeight) * 100);

  let overallStatus: HealthStatus = "healthy";
  if (breakdown.some((b) => b.status === "critical")) overallStatus = "critical";
  else if (breakdown.some((b) => b.status === "warning")) overallStatus = "warning";

  // Build top-issues list sorted by impact descending
  const sortedByImpact = [...breakdown].sort((a, b) => b.impact - a.impact);
  const topIssues: WorkspaceHealthReport["topIssues"] = [];
  for (const b of sortedByImpact) {
    if (b.status === "healthy") continue;
    topIssues.push({
      category: b.category,
      description: b.signals.join(" · "),
      severity: b.status,
    });
    if (topIssues.length >= 6) break;
  }

  const totalIssues =
    input.tsErrors +
    input.tsWarnings +
    input.testsFailed +
    input.vulnCritical +
    input.vulnHigh +
    input.vulnModerate +
    input.circularCycles +
    input.bugCount +
    input.fixmeCount;

  return {
    overallScore,
    overallStatus,
    breakdown,
    topIssues,
    totalIssues,
  };
}

export { CATEGORY_WEIGHTS };
