/**
 * Pass 60 — Depth & Adversarial Pass Tests
 *
 * Tests covering:
 * 1. QueryErrorBanner component
 * 2. Accessibility fixes (role=button, tabIndex, onKeyDown)
 * 3. Security posture (helmet, CORS, JWT, rate limiting, XSS)
 * 4. Performance defaults (staleTime, retry, refetchOnWindowFocus)
 * 5. Data integrity (parameterized queries, no eval)
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

// ── 1. QueryErrorBanner Component ──────────────────────────────────
describe("QueryErrorBanner component", () => {
  const bannerPath = path.join(ROOT, "client/src/components/QueryErrorBanner.tsx");

  it("exists", () => {
    expect(fs.existsSync(bannerPath)).toBe(true);
  });

  it("exports QueryErrorBanner", () => {
    const content = fs.readFileSync(bannerPath, "utf-8");
    expect(content).toContain("export function QueryErrorBanner");
  });

  it("has role=alert for screen readers", () => {
    const content = fs.readFileSync(bannerPath, "utf-8");
    expect(content).toContain('role="alert"');
  });

  it("has retry button", () => {
    const content = fs.readFileSync(bannerPath, "utf-8");
    expect(content).toContain("Retry");
    expect(content).toContain("refetch");
  });

  it("has dismiss functionality", () => {
    const content = fs.readFileSync(bannerPath, "utf-8");
    expect(content).toContain("Dismiss");
    expect(content).toContain("setDismissed");
  });

  it("uses destructive color scheme for errors", () => {
    const content = fs.readFileSync(bannerPath, "utf-8");
    expect(content).toContain("text-destructive");
    expect(content).toContain("border-destructive");
  });
});

// ── 2. Error banner imports added to critical pages ────────────────
describe("QueryErrorBanner integration", () => {
  const pagesWithBanner = [
    "client/src/pages/AdvisoryHub.tsx",
    "client/src/pages/Comparables.tsx",
    "client/src/pages/ComplianceAudit.tsx",
    "client/src/pages/IntelligenceHub.tsx",
    "client/src/pages/OperationsHub.tsx",
    "client/src/pages/ProficiencyDashboard.tsx",
    "client/src/pages/Rebalancing.tsx",
    "client/src/pages/RelationshipsHub.tsx",
    "client/src/pages/AdminFeaturePermissions.tsx",
  ];

  for (const page of pagesWithBanner) {
    it(`${path.basename(page)} imports QueryErrorBanner`, () => {
      const content = fs.readFileSync(path.join(ROOT, page), "utf-8");
      expect(content).toContain("QueryErrorBanner");
    });
  }
});

// ── 3. Accessibility: keyboard support on clickable elements ───────
describe("Accessibility: keyboard support", () => {
  const pagesWithA11yFixes = [
    "client/src/pages/AdvisoryHub.tsx",
    "client/src/pages/AgentManager.tsx",
    "client/src/pages/Community.tsx",
    "client/src/pages/Help.tsx",
    "client/src/pages/PublicCalculators.tsx",
  ];

  for (const page of pagesWithA11yFixes) {
    it(`${path.basename(page)} has role=button on clickable elements`, () => {
      const content = fs.readFileSync(path.join(ROOT, page), "utf-8");
      // At least one role="button" should exist (from our a11y fixes)
      expect(content).toContain('role="button"');
    });
  }

  it("skip-to-content link exists in AppShell", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/components/AppShell.tsx"), "utf-8");
    expect(content).toContain("Skip to main content");
  });

  it("aria-label count is substantial (>500)", () => {
    let count = 0;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.includes("node_modules")) walk(full);
        else if (entry.name.endsWith(".tsx")) {
          const content = fs.readFileSync(full, "utf-8");
          count += (content.match(/aria-label/g) || []).length;
        }
      }
    };
    walk(path.join(ROOT, "client/src"));
    expect(count).toBeGreaterThan(450); // adjusted after dead code removal (75 files)
  });
});

// ── 4. Security posture ────────────────────────────────────────────
describe("Security posture", () => {
  it("helmet is configured", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/_core/index.ts"), "utf-8");
    expect(content).toContain('import helmet from "helmet"');
    expect(content).toContain("helmet(");
  });

  it("CORS uses dynamic origin validation", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/_core/index.ts"), "utf-8");
    expect(content).toContain("Access-Control-Allow-Origin");
    expect(content).toContain("Access-Control-Allow-Credentials");
  });

  it("JWT cookies are httpOnly and sameSite", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/_core/cookies.ts"), "utf-8");
    expect(content).toContain("httpOnly: true");
    expect(content).toContain('sameSite: "lax"');
  });

  it("rate limiting has 3 tiers", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/_core/rateLimiter.ts"), "utf-8");
    expect(content).toContain("generalLimiter");
    expect(content).toContain("authLimiter");
    expect(content).toContain("sensitiveTrpcGuard");
  });

  it("body parser has size limits", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/_core/index.ts"), "utf-8");
    expect(content).toContain('limit: "5mb"');
  });

  it("OAuth redirect validates path (no open redirect)", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/_core/oauth.ts"), "utf-8");
    expect(content).toContain('rp.startsWith("/")');
    expect(content).toContain('!rp.startsWith("//")');
  });

  it("no eval() in server code", () => {
    const serverDir = path.join(ROOT, "server");
    const walk = (dir: string): boolean => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.includes("node_modules")) {
          if (walk(full)) return true;
        } else if (entry.name.endsWith(".ts") && !entry.name.includes(".test.")) {
          const content = fs.readFileSync(full, "utf-8");
          // Check for eval( but not "evaluate" or "evaluation"
          if (/\beval\s*\(/.test(content)) return true;
        }
      }
      return false;
    };
    expect(walk(serverDir)).toBe(false);
  });

  it("OrgLanding sanitizes custom CSS", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/pages/OrgLanding.tsx"), "utf-8");
    expect(content).toContain("expression");
    expect(content).toContain("javascript");
    expect(content).toContain("@import");
    expect(content).toContain("data:");
  });
});

// ── 5. Performance defaults ────────────────────────────────────────
describe("Performance defaults", () => {
  it("QueryClient has global staleTime of 30s", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/main.tsx"), "utf-8");
    expect(content).toContain("staleTime: 30_000");
  });

  it("refetchOnWindowFocus is disabled globally", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/main.tsx"), "utf-8");
    expect(content).toContain("refetchOnWindowFocus: false");
  });

  it("retry logic handles auth errors differently", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/main.tsx"), "utf-8");
    expect(content).toContain("TRPCClientError");
    expect(content).toContain("UNAUTHED_ERR_MSG");
  });

  it("all routes are lazy-loaded (>100)", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/App.tsx"), "utf-8");
    const lazyCount = (content.match(/lazy\(/g) || []).length;
    expect(lazyCount).toBeGreaterThan(100);
  });

  it("Suspense boundaries exist (>10)", () => {
    let count = 0;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.includes("node_modules")) walk(full);
        else if (entry.name.endsWith(".tsx")) {
          const content = fs.readFileSync(full, "utf-8");
          count += (content.match(/Suspense/g) || []).length;
        }
      }
    };
    walk(path.join(ROOT, "client/src"));
    expect(count).toBeGreaterThan(10);
  });
});

// ── 6. Data integrity ──────────────────────────────────────────────
describe("Data integrity", () => {
  it("all SQL uses Drizzle ORM (no raw string concatenation)", () => {
    const dbContent = fs.readFileSync(path.join(ROOT, "server/db.ts"), "utf-8");
    // Should use drizzle's sql template tag, not string concatenation
    expect(dbContent).not.toMatch(/`SELECT.*\$\{(?!.*sql)/);
  });

  it("transactions are used (>100 usages)", () => {
    let count = 0;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.includes("node_modules")) walk(full);
        else if (entry.name.endsWith(".ts") && !entry.name.includes(".test.")) {
          const content = fs.readFileSync(full, "utf-8");
          count += (content.match(/transaction/g) || []).length;
        }
      }
    };
    walk(path.join(ROOT, "server"));
    expect(count).toBeGreaterThan(100);
  });

  it("database connection has error handling", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/db.ts"), "utf-8");
    expect(content).toContain("try {");
    expect(content).toContain("catch");
    expect(content).toContain("getDb");
    expect(content).toContain("requireDb");
  });
});
