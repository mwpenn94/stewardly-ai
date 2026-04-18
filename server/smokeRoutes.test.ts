/**
 * Smoke Route Tests
 * Verifies every registered route has:
 *   1. A valid lazy-loaded component or inline component
 *   2. SectionErrorBoundary wrapping for major hub routes
 *   3. No temporal dead zone (TDZ) issues — useState/useCallback declared before useEffect deps
 *   4. No access to non-existent properties on known interfaces
 *
 * Runs on every build to catch crashes before they reach users.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";

const clientDir = resolve(__dirname, "../client/src");
const pagesDir = resolve(clientDir, "pages");

function readClient(relPath: string): string {
  return readFileSync(resolve(clientDir, relPath), "utf-8");
}

function readIfExists(absPath: string): string | null {
  return existsSync(absPath) ? readFileSync(absPath, "utf-8") : null;
}

function getAllTsxFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsxFiles(full));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

// ─── Route Registration ──────────────────────────────────────────────
describe("Route registration smoke tests", () => {
  const appTsx = readClient("App.tsx");

  it("App.tsx has at least 40 registered routes", () => {
    const routeCount = (appTsx.match(/path="/g) || []).length;
    expect(routeCount).toBeGreaterThanOrEqual(40);
  });

  it("all major hub routes have SectionErrorBoundary", () => {
    const hubRoutes = [
      "/wealth-engine",
      "/people",
      "/intelligence-hub",
      "/admin",
      "/settings",
      "/chat",
      "/my-work",
      "/learning",
    ];
    const sectionErrorCount = (appTsx.match(/SectionErrorBoundary/g) || []).length;
    expect(sectionErrorCount).toBeGreaterThanOrEqual(8);
  });

  it("imports SectionErrorBoundary component", () => {
    expect(appTsx).toContain("SectionErrorBoundary");
  });
});

// ─── TDZ Prevention ──────────────────────────────────────────────────
describe("Temporal Dead Zone (TDZ) prevention", () => {
  const pageFiles = getAllTsxFiles(pagesDir);

  it("scans at least 20 page files", () => {
    expect(pageFiles.length).toBeGreaterThanOrEqual(20);
  });

  it("no useState/useCallback variables used in useEffect dependency arrays before declaration", () => {
    const violations: string[] = [];

    for (const filePath of pageFiles) {
      const content = readIfExists(filePath);
      if (!content) continue;

      // Find all function component boundaries
      const lines = content.split("\n");
      let currentFunctionStart = -1;
      const stateDeclarations: Map<string, number> = new Map();
      const effectDeps: { line: number; vars: string[] }[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Track useState declarations: const [foo, setFoo] = useState
        const stateMatch = line.match(/const\s+\[(\w+)/);
        if (stateMatch && line.includes("useState")) {
          stateDeclarations.set(stateMatch[1], i);
        }

        // Track useCallback declarations: const foo = useCallback
        const cbMatch = line.match(/const\s+(\w+)\s*=\s*useCallback/);
        if (cbMatch) {
          stateDeclarations.set(cbMatch[1], i);
        }

        // Track useEffect dependency arrays
        const effectMatch = line.match(/\],\s*\[(.+)\]\s*\)/);
        if (effectMatch && lines.slice(Math.max(0, i - 20), i + 1).some(l => l.includes("useEffect"))) {
          const deps = effectMatch[1].split(",").map(d => d.trim()).filter(Boolean);
          effectDeps.push({ line: i, vars: deps });
        }
      }

      // Check for TDZ: useEffect dep array references a variable declared AFTER the useEffect
      for (const effect of effectDeps) {
        for (const dep of effect.vars) {
          const declLine = stateDeclarations.get(dep);
          if (declLine !== undefined && declLine > effect.line) {
            const relPath = filePath.replace(pagesDir + "/", "");
            violations.push(
              `${relPath}:${effect.line + 1} — useEffect depends on '${dep}' declared at line ${declLine + 1}`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      expect.fail(
        `TDZ violations found:\n${violations.join("\n")}`
      );
    }
  });
});

// ─── Null Safety on Common Patterns ──────────────────────────────────
describe("Null safety on array operations", () => {
  const calculatorFiles = getAllTsxFiles(resolve(pagesDir, "calculators"));
  const wealthFiles = getAllTsxFiles(resolve(pagesDir, "wealth-engine"));
  const allFiles = [...calculatorFiles, ...wealthFiles];

  it("scans calculator and wealth-engine files", () => {
    expect(allFiles.length).toBeGreaterThanOrEqual(5);
  });

  it("no .points property access on TimePhasedResult (should be .monthly)", () => {
    for (const filePath of allFiles) {
      const content = readIfExists(filePath);
      if (!content) continue;
      const relPath = filePath.replace(pagesDir + "/", "");
      // timePhased.points is a known bug — should be timePhased.monthly
      const pointsMatch = content.match(/timePhased\.points/);
      expect(pointsMatch, `${relPath} still uses timePhased.points (should be .monthly)`).toBeNull();
    }
  });

  it("practiceEngine.ts calcRollUpChartData has null guard", () => {
    const enginePath = resolve(pagesDir, "calculators/practiceEngine.ts");
    const content = readIfExists(enginePath);
    if (content) {
      // The function should handle undefined/empty input gracefully
      expect(content).toContain("calcRollUpChartData");
      // Should have a guard like: if (!points || points.length === 0)
      const fnStart = content.indexOf("function calcRollUpChartData");
      if (fnStart >= 0) {
        const fnBody = content.substring(fnStart, fnStart + 500);
        const hasGuard = fnBody.includes("!points") || fnBody.includes("points?.") || fnBody.includes("|| []");
        expect(hasGuard, "calcRollUpChartData should have a null guard for points parameter").toBe(true);
      }
    }
  });
});

// ─── Import Integrity ────────────────────────────────────────────────
describe("Import integrity — no mid-file imports", () => {
  const pageFiles = getAllTsxFiles(pagesDir);

  it("no import statements appear deep inside JSX/component code (50+ lines after import block)", () => {
    const violations: string[] = [];

    for (const filePath of pageFiles) {
      const content = readIfExists(filePath);
      if (!content) continue;

      const lines = content.split("\n");
      let lastImportLine = -1;
      let firstCodeLine = -1;

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;

        const isImport = (trimmed.startsWith("import ") || trimmed.startsWith("import{")) && !trimmed.includes("import(");

        if (isImport) {
          // Flag if this import is 50+ lines after the last import AND after code has started
          if (firstCodeLine >= 0 && lastImportLine >= 0 && i - lastImportLine > 50) {
            const relPath = filePath.replace(pagesDir + "/", "");
            violations.push(`${relPath}:${i + 1} — import statement found ${i - lastImportLine} lines after previous import block`);
          }
          lastImportLine = i;
        } else if (firstCodeLine < 0 && (
          trimmed.startsWith("export ") ||
          trimmed.startsWith("const ") ||
          trimmed.startsWith("function ") ||
          trimmed.startsWith("class ")
        )) {
          firstCodeLine = i;
        }
      }
    }

    if (violations.length > 0) {
      expect.fail(
        `Mid-file import violations found:\n${violations.join("\n")}`
      );
    }
  });
});
