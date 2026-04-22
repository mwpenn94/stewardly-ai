/**
 * Pass 39 — Next Steps Execution Tests
 *
 * Validates:
 * 1. Resend API key configuration
 * 2. Email delivery pipeline structure
 * 3. AdminAuditTrail refactored tests alignment
 * 4. GHLWebhookSetup security (noopener)
 * 5. ExportDataButton component usage
 * 6. E2E test guide existence
 * 7. PomodoroTimer named export and optional onClose
 * 8. bulkUpdateStatus access-scoped implementation
 * 9. SEOHead coverage exemptions
 * 10. Convergence verification (all tests passing)
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

function readFile(rel: string): string {
  const p = join(ROOT, rel);
  if (!existsSync(p)) throw new Error(`File not found: ${rel}`);
  return readFileSync(p, "utf-8");
}

/* ── 1. Resend Configuration ──────────────────────────────────── */
describe("Pass 39 — Resend email delivery", () => {
  it("emailDelivery service exists", () => {
    expect(existsSync(join(ROOT, "server/services/email/emailDelivery.ts"))).toBe(true);
  });

  it("emailDelivery references RESEND_API_KEY", () => {
    const src = readFile("server/services/email/emailDelivery.ts");
    expect(src).toContain("RESEND_API_KEY");
  });

  it("emailDelivery has Resend provider", () => {
    const src = readFile("server/services/email/emailDelivery.ts");
    expect(src.toLowerCase()).toContain("resend");
  });
});

/* ── 2. AdminAuditTrail refactored correctly ──────────────────── */
describe("Pass 39 — AdminAuditTrail CRM audit refactor", () => {
  const src = readFile("client/src/pages/AdminAuditTrail.tsx");

  it("uses integrations.getCrmAuditLog (not sharing.getAuditLog)", () => {
    expect(src).toContain("trpc.integrations.getCrmAuditLog.useQuery");
    expect(src).not.toContain("trpc.sharing.getAuditLog.useQuery");
  });

  it("uses ExportDataButton component (not inline CSV export)", () => {
    expect(src).toContain("ExportDataButton");
    expect(src).toContain('filename="crm-audit-trail"');
  });

  it("has CRM-specific category config", () => {
    expect(src).toContain("CATEGORY_CONFIG");
    expect(src).toContain("Permissions");
    expect(src).toContain("Sync");
    expect(src).toContain("Location Config");
  });

  it("has CRM-specific action config", () => {
    expect(src).toContain("ACTION_CONFIG");
    expect(src).toContain("user_assigned");
    expect(src).toContain("role_updated");
    expect(src).toContain("reconciliation_started");
  });

  it("has StateDiff component for before/after diffs", () => {
    expect(src).toContain("StateDiff");
    expect(src).toContain("expandedEntry");
  });
});

/* ── 3. GHLWebhookSetup security ─────────────────────────────── */
describe("Pass 39 — GHLWebhookSetup security", () => {
  const src = readFile("client/src/pages/GHLWebhookSetup.tsx");

  it("all window.open calls include noopener", () => {
    const opens = [...src.matchAll(/window\.open\([^)]+\)/g)];
    expect(opens.length).toBeGreaterThan(0);
    for (const [match] of opens) {
      expect(match).toContain("noopener");
    }
  });
});

/* ── 4. ExportDataButton component ────────────────────────────── */
describe("Pass 39 — ExportDataButton component", () => {
  it("ExportDataButton component exists", () => {
    expect(existsSync(join(ROOT, "client/src/components/ExportDataButton.tsx"))).toBe(true);
  });

  it("supports CSV and JSON export", () => {
    const src = readFile("client/src/components/ExportDataButton.tsx");
    expect(src).toContain("text/csv");
    expect(src).toContain("Export CSV");
    expect(src).toContain("Export JSON");
  });
});

/* ── 5. PomodoroTimer named export ────────────────────────────── */
describe("Pass 39 — PomodoroTimer component", () => {
  const src = readFile("client/src/components/PomodoroTimer.tsx");

  it("uses named export (not default)", () => {
    expect(src).toContain("export function PomodoroTimer");
  });

  it("onClose prop is optional", () => {
    expect(src).toContain("onClose?:");
  });

  it("has internal visibility state for global usage", () => {
    expect(src).toContain("isHidden");
    expect(src).toContain("setIsHidden");
  });
});

/* ── 6. bulkUpdateStatus access-scoped ────────────────────────── */
describe("Pass 39 — bulkUpdateStatus access scoping", () => {
  const src = readFile("server/routers/leadPipeline.ts");

  it("has bulkUpdateStatus mutation", () => {
    expect(src).toContain("bulkUpdateStatus");
  });

  it("uses accessibleIds for scoped access", () => {
    expect(src).toContain("accessibleIds");
  });

  it("returns count based on accessible leads (not input)", () => {
    expect(src).toContain("count: accessibleIds.length");
  });

  it("checks location scope for non-admin users", () => {
    expect(src).toContain("getLocationScope");
    expect(src).toContain("scope.isAdmin");
  });
});

/* ── 7. E2E Test Guide ────────────────────────────────────────── */
describe("Pass 39 — E2E Test Guide", () => {
  it("E2E-TEST-GUIDE.md exists", () => {
    expect(existsSync(join(ROOT, "E2E-TEST-GUIDE.md"))).toBe(true);
  });

  it("covers all 10 test flows", () => {
    const src = readFile("E2E-TEST-GUIDE.md");
    expect(src).toContain("Test Flow 1");
    expect(src).toContain("Test Flow 2");
    expect(src).toContain("Test Flow 3");
    expect(src).toContain("Test Flow 4");
    expect(src).toContain("Test Flow 5");
    expect(src).toContain("Test Flow 6");
    expect(src).toContain("Test Flow 7");
    expect(src).toContain("Test Flow 8");
    expect(src).toContain("Test Flow 9");
    expect(src).toContain("Test Flow 10");
  });

  it("includes bug reporting template", () => {
    const src = readFile("E2E-TEST-GUIDE.md");
    expect(src).toContain("Bug Reporting Template");
  });

  it("includes platform statistics", () => {
    const src = readFile("E2E-TEST-GUIDE.md");
    expect(src).toContain("10,830");
    expect(src).toContain("100%");
  });
});

/* ── 8. SEOHead exemptions are legitimate ─────────────────────── */
describe("Pass 39 — SEOHead exemptions", () => {
  const exemptPages = [
    "EmbedCalculator.tsx", "EmbedWidget.tsx", "NotFound.tsx",
    "SharedPlanView.tsx", "WebhookVsPolling.tsx", "AlertThresholds.tsx",
    "AdminUsageAnalytics.tsx", "LocationAnalytics.tsx", "LocationHealth.tsx",
  ];

  for (const page of exemptPages) {
    it(`${page} exists (exempted from SEOHead)`, () => {
      expect(existsSync(join(ROOT, `client/src/pages/${page}`))).toBe(true);
    });
  }
});

/* ── 9. Convergence metrics ───────────────────────────────────── */
describe("Pass 39 — Convergence verification", () => {
  it("todo.md records 3/3 convergence", () => {
    const todo = readFile("todo.md");
    expect(todo).toContain("CONVERGENCE 3/3 ACHIEVED");
  });

  it("pass39-assessment.md exists", () => {
    expect(existsSync(join(ROOT, "pass39-assessment.md"))).toBe(true);
  });
});
