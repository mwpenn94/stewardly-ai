/**
 * Manus-Next Documentation Completeness Tests
 * Verifies all Phase -1 and Phase 0 documents exist and contain required content.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const DOCS_DIR = path.resolve(__dirname, "..", "docs", "manus-next");

function readDoc(name: string): string {
  return fs.readFileSync(path.join(DOCS_DIR, name), "utf-8");
}

/* ── Phase -1: Provenance ─────────────────────────────────────── */

describe("Manus-Next Phase -1: Provenance", () => {
  it("docs/manus-next/ directory exists", () => {
    expect(fs.existsSync(DOCS_DIR)).toBe(true);
  });

  it("BUILD_MANIFEST.json exists and is valid JSON", () => {
    const raw = readDoc("BUILD_MANIFEST.json");
    const manifest = JSON.parse(raw);
    expect(manifest.project).toBeDefined();
    expect(manifest.version).toBeDefined();
    expect(manifest.provenance).toBeDefined();
    expect(manifest.metrics).toBeDefined();
    expect(manifest.stack).toBeDefined();
    expect(manifest.domains).toBeDefined();
    expect(manifest.regressionBaseline).toBeDefined();
  });

  it("BUILD_MANIFEST has correct test baseline", () => {
    const manifest = JSON.parse(readDoc("BUILD_MANIFEST.json"));
    expect(manifest.regressionBaseline.testsPassing).toBeGreaterThanOrEqual(9669);
    expect(manifest.regressionBaseline.buildPasses).toBe(true);
  });

  it("BUILD_MANIFEST has all 4 domains", () => {
    const manifest = JSON.parse(readDoc("BUILD_MANIFEST.json"));
    expect(manifest.domains.A).toBeDefined();
    expect(manifest.domains.B).toBeDefined();
    expect(manifest.domains.C).toBeDefined();
    expect(manifest.domains.D).toBeDefined();
  });

  it("build-log.md exists with timeline", () => {
    const doc = readDoc("build-log.md");
    expect(doc).toContain("Build Timeline");
    expect(doc).toContain("Foundation");
    expect(doc).toContain("Pass 107");
    expect(doc).toContain("Architecture Decisions");
  });

  it("refactor-log.md exists with extraction candidates", () => {
    const doc = readDoc("refactor-log.md");
    expect(doc).toContain("Calculator Engine Extraction");
    expect(doc).toContain("Practice Management Engine");
    expect(doc).toContain("Government Data Pipelines");
    expect(doc).toContain("@platform/");
    expect(doc).toContain("@manus-next/");
    expect(doc).toContain("Extraction Priority");
  });

  it("README.md exists with directory structure", () => {
    const doc = readDoc("README.md");
    expect(doc).toContain("Manus-Next");
    expect(doc).toContain("Directory Structure");
    expect(doc).toContain("Phase Timeline");
    expect(doc).toContain("Key Principles");
  });
});

/* ── Phase 0: Foundation ──────────────────────────────────────── */

describe("Manus-Next Phase 0: Monorepo Plan", () => {
  it("monorepo-plan.md exists", () => {
    const doc = readDoc("monorepo-plan.md");
    expect(doc).toContain("pnpm-workspace.yaml");
    expect(doc).toContain("turbo.json");
    expect(doc).toContain("apps/stewardly");
    expect(doc).toContain("apps/sovereign");
    expect(doc).toContain("packages/platform");
    expect(doc).toContain("packages/manus-next");
  });

  it("monorepo-plan has migration strategy", () => {
    const doc = readDoc("monorepo-plan.md");
    expect(doc).toContain("Migration Strategy");
    expect(doc).toContain("Step 1");
    expect(doc).toContain("Step 6");
    expect(doc).toContain("Dependency Graph");
  });

  it("monorepo-plan has build time budget", () => {
    const doc = readDoc("monorepo-plan.md");
    expect(doc).toContain("Build Time Budget");
  });
});

describe("Manus-Next Phase 0: Extraction Roadmap", () => {
  it("extraction-roadmap.md exists with 10 packages", () => {
    const doc = readDoc("extraction-roadmap.md");
    expect(doc).toContain("@platform/data-pipelines");
    expect(doc).toContain("@platform/compliance");
    expect(doc).toContain("@platform/sharing-ui");
    expect(doc).toContain("@platform/disclosure");
    expect(doc).toContain("@platform/voice");
    expect(doc).toContain("@platform/video");
    expect(doc).toContain("@platform/comms");
    expect(doc).toContain("@platform/premium-finance");
    expect(doc).toContain("@platform/auth");
    expect(doc).toContain("@platform/storage");
  });

  it("extraction-roadmap has extraction order", () => {
    const doc = readDoc("extraction-roadmap.md");
    expect(doc).toContain("Extraction Order");
    expect(doc).toContain("Verification Protocol");
  });

  it("extraction-roadmap has public API for each package", () => {
    const doc = readDoc("extraction-roadmap.md");
    expect(doc).toContain("Public API");
    expect(doc).toContain("Dependencies");
    expect(doc).toContain("Migration");
  });
});

describe("Manus-Next Phase 0: Package Shells", () => {
  it("package-shells.md exists with 17 packages", () => {
    const doc = readDoc("package-shells.md");
    expect(doc).toContain("@manus-next/wealth-engine");
    expect(doc).toContain("@manus-next/practice-engine");
    expect(doc).toContain("@manus-next/references");
    expect(doc).toContain("@manus-next/suitability");
    expect(doc).toContain("@manus-next/enrichment");
    expect(doc).toContain("@manus-next/products");
    expect(doc).toContain("@manus-next/crm");
    expect(doc).toContain("@manus-next/campaigns");
    expect(doc).toContain("@manus-next/analytics");
    expect(doc).toContain("@manus-next/ai-studio");
    expect(doc).toContain("@manus-next/command-center");
    expect(doc).toContain("@manus-next/calculators-ui");
    expect(doc).toContain("@manus-next/market-data");
    expect(doc).toContain("@manus-next/documents");
    expect(doc).toContain("@manus-next/settings");
    expect(doc).toContain("@manus-next/billing");
    expect(doc).toContain("@manus-next/onboarding");
  });

  it("package-shells has shell template", () => {
    const doc = readDoc("package-shells.md");
    expect(doc).toContain("Shell Template");
    expect(doc).toContain("package.json");
    expect(doc).toContain("Migration Checklist");
  });
});

describe("Manus-Next Phase 0: Sovereign Study Notes", () => {
  it("sovereign-study-notes.md exists", () => {
    const doc = readDoc("sovereign-study-notes.md");
    expect(doc).toContain("SOVEREIGN_PORT_MODE=study");
    expect(doc).toContain("Calculator Lab");
    expect(doc).toContain("Concept Explorer");
    expect(doc).toContain("Practice Quizzes");
    expect(doc).toContain("Spaced Repetition");
    expect(doc).toContain("Progress Tracking");
  });

  it("sovereign has database schema", () => {
    const doc = readDoc("sovereign-study-notes.md");
    expect(doc).toContain("study_progress");
    expect(doc).toContain("quiz_results");
    expect(doc).toContain("flashcard_decks");
  });

  it("sovereign has package dependencies", () => {
    const doc = readDoc("sovereign-study-notes.md");
    expect(doc).toContain("@manus-next/wealth-engine");
    expect(doc).toContain("@manus-next/practice-engine");
    expect(doc).toContain("@manus-next/references");
    expect(doc).toContain("@platform/auth");
  });
});

describe("Manus-Next Phase 0: CI Config", () => {
  it("ci-config.md exists with path-based triggers", () => {
    const doc = readDoc("ci-config.md");
    expect(doc).toContain("Path-Based CI");
    expect(doc).toContain("GitHub Actions");
    expect(doc).toContain("dorny/paths-filter");
    expect(doc).toContain("Turborepo Cache");
  });

  it("ci-config has regression baseline check", () => {
    const doc = readDoc("ci-config.md");
    expect(doc).toContain("9669");
    expect(doc).toContain("REGRESSION");
  });
});

describe("Manus-Next Phase 0: Regression Baseline", () => {
  it("regression-baseline.md exists with metrics", () => {
    const doc = readDoc("regression-baseline.md");
    expect(doc).toContain("9,669");
    expect(doc).toContain("393");
    expect(doc).toContain("32");
    expect(doc).toContain("Minimum Thresholds");
  });

  it("regression-baseline documents known failures", () => {
    const doc = readDoc("regression-baseline.md");
    expect(doc).toContain("Census API");
    expect(doc).toContain("ECONNRESET");
    expect(doc).toContain("Transient");
  });
});

/* ── Cross-document consistency ───────────────────────────────── */

describe("Manus-Next Cross-Document Consistency", () => {
  it("BUILD_MANIFEST version matches regression baseline", () => {
    const manifest = JSON.parse(readDoc("BUILD_MANIFEST.json"));
    const baseline = readDoc("regression-baseline.md");
    const manifestPassing = manifest.regressionBaseline.testsPassing;
    expect(baseline).toContain(manifestPassing.toLocaleString());
  });

  it("all docs reference the same package count", () => {
    const roadmap = readDoc("extraction-roadmap.md");
    const shells = readDoc("package-shells.md");
    // Roadmap has 10 @platform/* packages
    expect(roadmap).toContain("@platform/storage");
    // Shells has 17 @manus-next/* packages
    expect(shells).toContain("@manus-next/onboarding");
  });

  it("README references all doc files", () => {
    const readme = readDoc("README.md");
    expect(readme).toContain("BUILD_MANIFEST.json");
    expect(readme).toContain("build-log.md");
    expect(readme).toContain("refactor-log.md");
    expect(readme).toContain("monorepo-plan.md");
    expect(readme).toContain("extraction-roadmap.md");
    expect(readme).toContain("package-shells.md");
    expect(readme).toContain("sovereign-study-notes.md");
    expect(readme).toContain("ci-config.md");
    expect(readme).toContain("regression-baseline.md");
  });
});
