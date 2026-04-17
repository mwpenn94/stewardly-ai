/**
 * Pass 110 — Monorepo Extraction, Portal Analytics Charts, Nav Simplification, My Plan Fix
 * Tests: monorepo scaffold, package extraction, Recharts integration, nav progressive disclosure
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const CLIENT = join(ROOT, "client/src");
const PKGS = join(ROOT, "packages");

/* ═══ 1. Monorepo Scaffold ═══ */
describe("Monorepo scaffold", () => {
  it("pnpm-workspace.yaml exists and defines workspace packages", () => {
    const f = join(ROOT, "pnpm-workspace.yaml");
    expect(existsSync(f)).toBe(true);
    const content = readFileSync(f, "utf-8");
    expect(content).toContain("packages/platform/*");
    expect(content).toContain("packages/manus-next/*");
    expect(content).toContain("tooling/*");
  });

  it("turbo.json exists with pipeline config", () => {
    const f = join(ROOT, "turbo.json");
    expect(existsSync(f)).toBe(true);
    const content = JSON.parse(readFileSync(f, "utf-8"));
    expect(content.pipeline).toBeDefined();
    expect(content.pipeline.build).toBeDefined();
    expect(content.pipeline.test).toBeDefined();
  });

  it("tsconfig.base.json exists with shared compiler options", () => {
    const f = join(ROOT, "tsconfig.base.json");
    expect(existsSync(f)).toBe(true);
    const content = JSON.parse(readFileSync(f, "utf-8"));
    expect(content.compilerOptions.strict).toBe(true);
    expect(content.compilerOptions.target).toBe("ES2022");
  });

  it("10 @platform/* package directories exist", () => {
    const platformDir = join(PKGS, "platform");
    const dirs = readdirSync(platformDir);
    expect(dirs.length).toBeGreaterThanOrEqual(10);
    const expected = ["data-pipelines", "compliance", "sharing-ui", "disclosure", "voice", "video", "comms", "premium-finance", "auth", "storage"];
    for (const name of expected) {
      expect(dirs).toContain(name);
    }
  });

  it("17 @manus-next/* package directories exist", () => {
    const mnDir = join(PKGS, "manus-next");
    const dirs = readdirSync(mnDir);
    expect(dirs.length).toBeGreaterThanOrEqual(17);
    const expected = ["wealth-engine", "practice-engine", "references", "suitability", "enrichment", "products", "crm", "campaigns", "analytics", "ai-studio", "command-center", "calculators-ui", "market-data", "documents", "settings", "billing", "onboarding"];
    for (const name of expected) {
      expect(dirs).toContain(name);
    }
  });

  it("tooling directories exist", () => {
    const toolingDir = join(ROOT, "tooling");
    const dirs = readdirSync(toolingDir);
    expect(dirs).toContain("eslint-config");
    expect(dirs).toContain("tsconfig");
    expect(dirs).toContain("vitest-config");
  });
});

/* ═══ 2. Package Shells ═══ */
describe("Package shells have correct structure", () => {
  const packages = [
    { scope: "platform", name: "data-pipelines" },
    { scope: "platform", name: "compliance" },
    { scope: "platform", name: "storage" },
    { scope: "manus-next", name: "wealth-engine" },
    { scope: "manus-next", name: "practice-engine" },
    { scope: "manus-next", name: "references" },
  ];

  for (const pkg of packages) {
    describe(`@${pkg.scope === "platform" ? "platform" : "manus-next"}/${pkg.name}`, () => {
      const dir = join(PKGS, pkg.scope, pkg.name);

      it("has package.json", () => {
        expect(existsSync(join(dir, "package.json"))).toBe(true);
        const pj = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
        expect(pj.name).toBe(`@${pkg.scope === "platform" ? "platform" : "manus-next"}/${pkg.name}`);
        expect(pj.version).toBe("0.1.0");
        expect(pj.private).toBe(true);
      });

      it("has tsconfig.json extending base", () => {
        expect(existsSync(join(dir, "tsconfig.json"))).toBe(true);
        const tc = JSON.parse(readFileSync(join(dir, "tsconfig.json"), "utf-8"));
        expect(tc.extends).toContain("tsconfig.base.json");
      });

      it("has src/index.ts barrel export", () => {
        expect(existsSync(join(dir, "src/index.ts"))).toBe(true);
        const content = readFileSync(join(dir, "src/index.ts"), "utf-8");
        expect(content).toContain("PACKAGE_NAME");
        expect(content).toContain("PACKAGE_VERSION");
      });

      it("has README.md", () => {
        expect(existsSync(join(dir, "README.md"))).toBe(true);
      });
    });
  }
});

/* ═══ 3. Extracted Packages ═══ */
describe("Wealth engine extraction", () => {
  it("engine.ts source copied to package", () => {
    const f = join(PKGS, "manus-next/wealth-engine/src/engine.ts");
    expect(existsSync(f)).toBe(true);
    const content = readFileSync(f, "utf-8");
    expect(content).toContain("CALC_METHODS");
    expect(content).toContain("calcCashFlow");
    expect(content).toContain("CONFIGURABLE_DEFAULTS");
  });

  it("barrel export re-exports all key functions", () => {
    const content = readFileSync(join(PKGS, "manus-next/wealth-engine/src/index.ts"), "utf-8");
    const expectedExports = ["RATES", "fmt", "fv", "modelTerm", "modelIUL", "calcCashFlow", "calcRetirement", "calcTax", "calcEstate", "CALC_METHODS", "CONFIGURABLE_DEFAULTS"];
    for (const exp of expectedExports) {
      expect(content).toContain(exp);
    }
  });
});

describe("Practice engine extraction", () => {
  it("practiceEngine.ts source copied to package", () => {
    const f = join(PKGS, "manus-next/practice-engine/src/practiceEngine.ts");
    expect(existsSync(f)).toBe(true);
    const content = readFileSync(f, "utf-8");
    expect(content).toContain("PRODUCTS");
    expect(content).toContain("calcRollUp");
    expect(content).toContain("DEFAULT_ENGINE_CONFIG");
  });

  it("barrel export re-exports all key functions", () => {
    const content = readFileSync(join(PKGS, "manus-next/practice-engine/src/index.ts"), "utf-8");
    const expectedExports = ["PRODUCTS", "calcRollUp", "calcDashboard", "ROLE_DEFAULTS", "DEFAULT_ENGINE_CONFIG"];
    for (const exp of expectedExports) {
      expect(content).toContain(exp);
    }
  });
});

describe("References extraction", () => {
  it("references.ts source copied to package", () => {
    const f = join(PKGS, "manus-next/references/src/references.ts");
    expect(existsSync(f)).toBe(true);
    const content = readFileSync(f, "utf-8");
    expect(content).toContain("REFERENCE_CATEGORIES");
    expect(content).toContain("REF_CATEGORY_TIPS");
  });

  it("barrel export re-exports all key constants", () => {
    const content = readFileSync(join(PKGS, "manus-next/references/src/index.ts"), "utf-8");
    expect(content).toContain("REFERENCE_CATEGORIES");
    expect(content).toContain("REF_CATEGORY_TIPS");
    expect(content).toContain("FUNNEL_BENCHMARKS");
    expect(content).toContain("METHODOLOGY_DISCLOSURE");
  });
});

/* ═══ 4. Portal Analytics Recharts ═══ */
describe("Portal Analytics Recharts integration", () => {
  it("PortalAnalytics.tsx imports from recharts", () => {
    const content = readFileSync(join(CLIENT, "pages/PortalAnalytics.tsx"), "utf-8");
    expect(content).toContain("from \"recharts\"");
    expect(content).toContain("BarChart");
    expect(content).toContain("PieChart");
    expect(content).toContain("AreaChart");
    expect(content).toContain("RadarChart");
  });

  it("has Charts tab with 4 chart types", () => {
    const content = readFileSync(join(CLIENT, "pages/PortalAnalytics.tsx"), "utf-8");
    expect(content).toContain("value=\"charts\"");
    expect(content).toContain("ResponsiveContainer");
    expect(content).toContain("CHART_COLORS");
  });

  it("has Activity Timeline area chart in overview", () => {
    const content = readFileSync(join(CLIENT, "pages/PortalAnalytics.tsx"), "utf-8");
    expect(content).toContain("Activity Timeline");
    expect(content).toContain("timelineData");
    expect(content).toContain("<Area ");
  });

  it("has SEOHead", () => {
    const content = readFileSync(join(CLIENT, "pages/PortalAnalytics.tsx"), "utf-8");
    expect(content).toContain("SEOHead");
  });
});

/* ═══ 5. My Plan Deep-Link Fix ═══ */
describe("My Plan deep-link fix", () => {
  it("Calculators.tsx supports ?panel= query param", () => {
    const content = readFileSync(join(CLIENT, "pages/Calculators.tsx"), "utf-8");
    expect(content).toContain("panel");
    expect(content).toContain("URLSearchParams");
  });

  it("App.tsx has /my-plan redirect route", () => {
    const content = readFileSync(join(CLIENT, "App.tsx"), "utf-8");
    expect(content).toContain("/my-plan");
  });
});

/* ═══ 6. Progressive Disclosure Nav ═══ */
describe("Progressive disclosure navigation", () => {
  it("PersonaSidebar5 uses progressive disclosure sub-groups", () => {
    const content = readFileSync(join(CLIENT, "components/PersonaSidebar5.tsx"), "utf-8");
    // Should have collapsible sub-groups or disclosure-based filtering
    expect(content).toContain("ChevronDown") || expect(content).toContain("ChevronRight") || expect(content).toContain("collapsed") || expect(content).toContain("expanded");
  });

  it("PersonaSidebar5 has disclosure level filtering", () => {
    const content = readFileSync(join(CLIENT, "components/PersonaSidebar5.tsx"), "utf-8");
    expect(content).toContain("useDisclosure") || expect(content).toContain("disclosure") || expect(content).toContain("PERSONA_LAYERS");
  });
});

/* ═══ 7. Toast migration ═══ */
describe("Toast migration to sonner", () => {
  const pages = ["BusinessExit.tsx", "AnnualReview.tsx", "TaxProjector.tsx", "ManusNextDashboard.tsx"];
  for (const page of pages) {
    it(`${page} uses sonner toast (not use-toast)`, () => {
      const content = readFileSync(join(CLIENT, "pages", page), "utf-8");
      expect(content).not.toContain("from \"@/hooks/use-toast\"");
    });
  }
});

/* ═══ 8. Build verification ═══ */
describe("Build integrity", () => {
  it("recharts is in package.json dependencies", () => {
    const pj = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    expect(pj.dependencies?.recharts || pj.devDependencies?.recharts).toBeDefined();
  });
});
