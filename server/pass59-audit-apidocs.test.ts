/**
 * Pass 59 — Audit Trail Viewer + API Documentation + Sharing Enhancements
 *
 * Tests for:
 * 1. AdminAuditTrail page existence and exports
 * 2. ApiDocumentation page existence and exports
 * 3. Route registration for /api-docs and /admin/audit-trail
 * 4. Sidebar navigation entries
 * 5. Sharing router audit log procedure
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

/* ── Helper ──────────────────────────────────────────────────── */
function readFile(rel: string): string {
  const p = join(ROOT, rel);
  if (!existsSync(p)) throw new Error(`File not found: ${rel}`);
  return readFileSync(p, "utf-8");
}

/* ── 1. AdminAuditTrail page ─────────────────────────────────── */
describe("AdminAuditTrail page", () => {
  it("file exists", () => {
    expect(existsSync(join(ROOT, "client/src/pages/AdminAuditTrail.tsx"))).toBe(true);
  });

  it("exports default component", () => {
    const src = readFile("client/src/pages/AdminAuditTrail.tsx");
    expect(src).toContain("export default function AdminAuditTrail");
  });

  it("uses sharing.getAuditLog query", () => {
    const src = readFile("client/src/pages/AdminAuditTrail.tsx");
    expect(src).toContain("trpc.sharing.getAuditLog.useQuery");
  });

  it("has CSV export functionality", () => {
    const src = readFile("client/src/pages/AdminAuditTrail.tsx");
    expect(src).toContain("Export CSV");
    expect(src).toContain("text/csv");
  });

  it("has search and filter controls", () => {
    const src = readFile("client/src/pages/AdminAuditTrail.tsx");
    expect(src).toContain("Search");
    expect(src).toContain("filterAction");
  });

  it("shows stats cards", () => {
    const src = readFile("client/src/pages/AdminAuditTrail.tsx");
    expect(src).toContain("Total Events");
    expect(src).toContain("Grants");
    expect(src).toContain("Revocations");
    expect(src).toContain("Shares");
  });

  it("has expandable detail view", () => {
    const src = readFile("client/src/pages/AdminAuditTrail.tsx");
    expect(src).toContain("expandedEntry");
    expect(src).toContain("Value Change");
  });

  it("defines action config for all permission types", () => {
    const src = readFile("client/src/pages/AdminAuditTrail.tsx");
    expect(src).toContain("grant_permission");
    expect(src).toContain("update_permission");
    expect(src).toContain("revoke_permission");
    expect(src).toContain("share_content");
    expect(src).toContain("revoke_share");
  });
});

/* ── 2. ApiDocumentation page ────────────────────────────────── */
describe("ApiDocumentation page", () => {
  it("file exists", () => {
    expect(existsSync(join(ROOT, "client/src/pages/ApiDocumentation.tsx"))).toBe(true);
  });

  it("exports default component", () => {
    const src = readFile("client/src/pages/ApiDocumentation.tsx");
    expect(src).toContain("export default function ApiDocumentation");
  });

  it("lists multiple API endpoints", () => {
    const src = readFile("client/src/pages/ApiDocumentation.tsx");
    expect(src).toContain("API_ENDPOINTS");
    // Should have at least 20 endpoints
    const matches = src.match(/name: "/g);
    expect(matches!.length).toBeGreaterThanOrEqual(20);
  });

  it("has search functionality", () => {
    const src = readFile("client/src/pages/ApiDocumentation.tsx");
    expect(src).toContain("Search endpoints");
    expect(src).toContain("setSearch");
  });

  it("has router filter", () => {
    const src = readFile("client/src/pages/ApiDocumentation.tsx");
    expect(src).toContain("filterRouter");
    expect(src).toContain("All Routers");
  });

  it("has auth filter", () => {
    const src = readFile("client/src/pages/ApiDocumentation.tsx");
    expect(src).toContain("filterAuth");
    expect(src).toContain("All Auth");
  });

  it("shows usage examples with copy-to-clipboard", () => {
    const src = readFile("client/src/pages/ApiDocumentation.tsx");
    expect(src).toContain("copyToClipboard");
    expect(src).toContain("Usage");
    expect(src).toContain("useQuery");
    expect(src).toContain("useMutation");
  });

  it("covers key routers", () => {
    const src = readFile("client/src/pages/ApiDocumentation.tsx");
    const routers = ["auth", "market", "sharing", "plaid", "billing", "notifications", "integrations"];
    for (const r of routers) {
      expect(src).toContain(`router: "${r}"`);
    }
  });

  it("shows endpoint stats", () => {
    const src = readFile("client/src/pages/ApiDocumentation.tsx");
    expect(src).toContain("Endpoints");
    expect(src).toContain("Routers");
    expect(src).toContain("Protected");
    expect(src).toContain("Public");
  });
});

/* ── 3. Route registration ───────────────────────────────────── */
describe("Route registration", () => {
  const appSrc = readFile("client/src/App.tsx");

  it("registers /api-docs route", () => {
    expect(appSrc).toContain("/api-docs");
    expect(appSrc).toContain("ApiDocumentation");
  });

  it("registers /admin/audit-trail route", () => {
    expect(appSrc).toContain("/admin/audit-trail");
    expect(appSrc).toContain("AdminAuditTrail");
  });

  it("lazy-loads both pages", () => {
    expect(appSrc).toContain('lazy(() => import("./pages/ApiDocumentation"))');
    expect(appSrc).toContain('lazy(() => import("./pages/AdminAuditTrail"))');
  });
});

/* ── 4. Sidebar navigation ───────────────────────────────────── */
describe("Sidebar navigation", () => {
  const sidebarSrc = readFile("client/src/components/PersonaSidebar5.tsx");
  const adminHubSrc = readFile("client/src/pages/AdminHubV2.tsx");
  const appSrc = readFile("client/src/App.tsx");

  it("includes API Docs route in App.tsx", () => {
    expect(appSrc).toContain("/api-docs");
    expect(appSrc).toContain("ApiDocumentation");
  });

  it("includes Audit Trail nav item in Admin hub", () => {
    expect(adminHubSrc).toContain("Audit Trail");
    expect(adminHubSrc).toContain("audit-trail");
  });

  it("sets correct disclosure levels in sidebar", () => {
    // Admin hub is at disclosureLevel 3 in the simplified sidebar (Pass 130)
    expect(sidebarSrc).toContain("disclosureLevel: 3");
    // Admin match includes /admin/audit-trail
    expect(sidebarSrc).toContain("/admin/audit-trail");
  });
});

/* ── 5. Sharing router audit log ─────────────────────────────── */
describe("Sharing router audit log", () => {
  const routerSrc = readFile("server/routers/sharing.ts");

  it("exports getAuditLog procedure", () => {
    expect(routerSrc).toContain("getAuditLog");
  });

  it("is a protected procedure", () => {
    expect(routerSrc).toContain("protectedProcedure");
  });
});

/* ── 6. Feature permissions admin page ───────────────────────── */
describe("AdminFeaturePermissions audit section", () => {
  const src = readFile("client/src/pages/AdminFeaturePermissions.tsx");

  it("includes AuditTrailSection component", () => {
    expect(src).toContain("AuditTrailSection");
  });

  it("uses sharing.getAuditLog query", () => {
    expect(src).toContain("trpc.sharing.getAuditLog.useQuery");
  });

  it("shows action labels for permission types", () => {
    expect(src).toContain("Granted");
    expect(src).toContain("Updated");
    expect(src).toContain("Revoked");
    expect(src).toContain("Shared");
  });
});
