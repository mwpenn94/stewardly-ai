import { describe, it, expect } from "vitest";
import {
  scoreDiagnostics,
  scoreTests,
  scoreSecurity,
  scoreFreshness,
  scoreStructure,
  scoreMarkers,
  computeWorkspaceHealth,
  type HealthInput,
} from "./workspaceHealth";

const clean = (over: Partial<HealthInput> = {}): HealthInput => ({
  tsErrors: 0,
  tsWarnings: 0,
  testsFailed: 0,
  testsTotal: 100,
  testsPassed: 100,
  outdatedMajor: 0,
  outdatedMinor: 0,
  outdatedPatch: 0,
  vulnCritical: 0,
  vulnHigh: 0,
  vulnModerate: 0,
  circularCycles: 0,
  circularFilesInCycles: 0,
  deadExports: 0,
  orphanFiles: 0,
  todoCount: 0,
  fixmeCount: 0,
  bugCount: 0,
  hackCount: 0,
  gitDirtyFiles: 0,
  gitStaged: 0,
  gitUntracked: 0,
  ...over,
});

describe("workspaceHealth — scoreDiagnostics", () => {
  it("gives 100 for no errors/warnings", () => {
    const r = scoreDiagnostics(clean());
    expect(r.score).toBe(100);
    expect(r.status).toBe("healthy");
  });

  it("subtracts 5 per error", () => {
    const r = scoreDiagnostics(clean({ tsErrors: 2 }));
    expect(r.score).toBe(90);
    expect(r.status).toBe("critical");
  });

  it("subtracts 1 per warning", () => {
    const r = scoreDiagnostics(clean({ tsWarnings: 5 }));
    expect(r.score).toBe(95);
    expect(r.status).toBe("warning");
  });

  it("caps at 0", () => {
    const r = scoreDiagnostics(clean({ tsErrors: 100 }));
    expect(r.score).toBe(0);
  });
});

describe("workspaceHealth — scoreTests", () => {
  it("gives 100 for all-passing", () => {
    expect(scoreTests(clean()).score).toBe(100);
  });

  it("returns warning for 0 tests", () => {
    const r = scoreTests(clean({ testsTotal: 0, testsPassed: 0 }));
    expect(r.status).toBe("warning");
    expect(r.score).toBe(50);
  });

  it("computes pass rate when some fail", () => {
    const r = scoreTests(
      clean({ testsTotal: 100, testsPassed: 80, testsFailed: 20 }),
    );
    expect(r.score).toBe(80);
    expect(r.status).toBe("critical");
  });
});

describe("workspaceHealth — scoreSecurity", () => {
  it("gives 100 for no vulns", () => {
    expect(scoreSecurity(clean()).score).toBe(100);
  });

  it("heavy penalty for critical", () => {
    const r = scoreSecurity(clean({ vulnCritical: 1 }));
    expect(r.score).toBe(60);
    expect(r.status).toBe("critical");
  });

  it("medium penalty for high", () => {
    const r = scoreSecurity(clean({ vulnHigh: 1 }));
    expect(r.score).toBe(80);
    expect(r.status).toBe("warning");
  });
});

describe("workspaceHealth — scoreFreshness", () => {
  it("gives 100 for all-current", () => {
    expect(scoreFreshness(clean()).score).toBe(100);
  });

  it("subtracts 5 per major", () => {
    expect(scoreFreshness(clean({ outdatedMajor: 2 })).score).toBe(90);
  });

  it("subtracts less for patches", () => {
    const r = scoreFreshness(clean({ outdatedPatch: 5 }));
    expect(r.score).toBe(99);
  });
});

describe("workspaceHealth — scoreStructure", () => {
  it("penalizes circular deps heavily", () => {
    const r = scoreStructure(clean({ circularCycles: 2 }));
    expect(r.score).toBe(80);
    expect(r.status).toBe("warning");
  });

  it("penalizes dead exports lightly", () => {
    const r = scoreStructure(clean({ deadExports: 10 }));
    expect(r.score).toBe(95);
  });
});

describe("workspaceHealth — scoreMarkers", () => {
  it("BUG is 5x a TODO", () => {
    const bugScore = scoreMarkers(clean({ bugCount: 1 })).score;
    const todoScore = scoreMarkers(clean({ todoCount: 1 })).score;
    expect(100 - bugScore).toBeGreaterThan(100 - todoScore);
  });

  it("gives 100 for no markers", () => {
    expect(scoreMarkers(clean()).score).toBe(100);
  });
});

describe("workspaceHealth — computeWorkspaceHealth", () => {
  it("returns a perfect score for a fully clean workspace", () => {
    const r = computeWorkspaceHealth(clean());
    expect(r.overallScore).toBe(100);
    expect(r.overallStatus).toBe("healthy");
    expect(r.topIssues).toHaveLength(0);
  });

  it("aggregates breakdown for every category", () => {
    const r = computeWorkspaceHealth(clean({ tsErrors: 1, vulnHigh: 1 }));
    expect(r.breakdown).toHaveLength(6);
    expect(r.breakdown.find((b) => b.category === "diagnostics")!.status).toBe("critical");
    expect(r.breakdown.find((b) => b.category === "security")!.status).toBe("warning");
    // Overall is weighted average — should be less than 100 but not 0
    expect(r.overallScore).toBeLessThan(100);
    expect(r.overallScore).toBeGreaterThan(70);
  });

  it("overall status escalates to critical when any category is critical", () => {
    const r = computeWorkspaceHealth(clean({ tsErrors: 1 }));
    expect(r.overallStatus).toBe("critical");
  });

  it("ranks top issues by impact descending", () => {
    const r = computeWorkspaceHealth(
      clean({
        tsErrors: 10,
        vulnCritical: 1,
        todoCount: 5,
      }),
    );
    // security + diagnostics should be top 2
    const topCats = r.topIssues.map((t) => t.category);
    expect(topCats[0]).toMatch(/diagnostics|security/);
    expect(topCats[1]).toMatch(/diagnostics|security/);
  });

  it("totals issues across categories", () => {
    const r = computeWorkspaceHealth(
      clean({
        tsErrors: 2,
        testsFailed: 3,
        vulnHigh: 1,
        circularCycles: 2,
      }),
    );
    // 2 + 3 + 1 + 2 = 8
    expect(r.totalIssues).toBe(8);
  });

  it("impact numbers reflect category weights", () => {
    const r = computeWorkspaceHealth(clean({ tsErrors: 20 })); // max diagnostics penalty
    const diag = r.breakdown.find((b) => b.category === "diagnostics")!;
    expect(diag.score).toBe(0);
    // Diagnostics weight is 25, so impact should be 25
    expect(diag.impact).toBe(25);
  });
});
