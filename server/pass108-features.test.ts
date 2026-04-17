import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

describe("Pass 108: CommandCenter tRPC Wiring", () => {
  const cc = readFileSync(join(ROOT, "client/src/pages/CommandCenter.tsx"), "utf-8");

  it("imports trpc from lib/trpc", () => {
    expect(cc).toContain('from "@/lib/trpc"');
  });

  it("uses trpc.leadPipeline for CRM tab", () => {
    expect(cc).toContain("trpc.leadPipeline");
  });

  it("uses trpc.emailCampaign for Campaigns tab", () => {
    expect(cc).toContain("trpc.emailCampaign");
  });

  it("uses trpc.clientSegmentation for Segments tab", () => {
    expect(cc).toContain("trpc.clientSegmentation");
  });

  it("does NOT use SAMPLE_ arrays for live data", () => {
    expect(cc).not.toMatch(/const SAMPLE_CONTACTS/);
    expect(cc).not.toMatch(/const SAMPLE_CAMPAIGNS/);
  });

  it("has all 7 tabs", () => {
    expect(cc).toContain("Overview");
    expect(cc).toContain("CRM");
    expect(cc).toContain("Campaigns");
    expect(cc).toContain("ATS");
    expect(cc).toContain("LinkedIn");
    expect(cc).toContain("Segments");
    expect(cc).toContain("Assets");
  });
});

describe("Pass 108: New Frontend Pages Exist", () => {
  const pages = [
    "BusinessExit.tsx",
    "AnnualReview.tsx",
    "ComplianceCopilot.tsx",
    "TaxProjector.tsx",
    "PremiumFinanceRates.tsx",
    "ManusNextDashboard.tsx",
  ];

  pages.forEach((page) => {
    it(`${page} exists and has content`, () => {
      const path = join(ROOT, "client/src/pages", page);
      expect(existsSync(path)).toBe(true);
      const content = readFileSync(path, "utf-8");
      expect(content.length).toBeGreaterThan(500);
    });
  });
});

describe("Pass 108: New Pages Use tRPC", () => {
  const pageRouterMap: Record<string, string> = {
    "BusinessExit.tsx": "trpc.businessExit",
    "AnnualReview.tsx": "trpc.annualReview",
    "ComplianceCopilot.tsx": "trpc.complianceCopilot",
    "TaxProjector.tsx": "trpc.tax",
    "PremiumFinanceRates.tsx": "trpc.premiumFinanceRates",
  };

  Object.entries(pageRouterMap).forEach(([page, router]) => {
    it(`${page} uses ${router}`, () => {
      const content = readFileSync(join(ROOT, "client/src/pages", page), "utf-8");
      expect(content).toContain(router);
    });
  });
});

describe("Pass 108: New Pages Use Sonner Toast (not use-toast)", () => {
  const pages = [
    "BusinessExit.tsx",
    "AnnualReview.tsx",
    "TaxProjector.tsx",
    "ManusNextDashboard.tsx",
  ];

  pages.forEach((page) => {
    it(`${page} imports from sonner, not use-toast`, () => {
      const content = readFileSync(join(ROOT, "client/src/pages", page), "utf-8");
      expect(content).toContain('from "sonner"');
      expect(content).not.toContain("use-toast");
    });
  });
});

describe("Pass 108: Routes Wired in App.tsx", () => {
  const app = readFileSync(join(ROOT, "client/src/App.tsx"), "utf-8");

  const routes = [
    "/business-exit",
    "/annual-review",
    "/compliance-copilot",
    "/tax-projector",
    "/premium-finance-rates",
    "/manus-next",
  ];

  routes.forEach((route) => {
    it(`route ${route} exists in App.tsx`, () => {
      expect(app).toContain(route);
    });
  });
});

describe("Pass 108: Navigation Entries Added", () => {
  const nav = readFileSync(join(ROOT, "client/src/lib/navigation.ts"), "utf-8");

  const entries = [
    "Business Exit",
    "Annual Review",
    "Compliance Copilot",
    "Tax Projector",
    "Premium Finance",
    "Manus-Next",
  ];

  entries.forEach((entry) => {
    it(`navigation has "${entry}" entry`, () => {
      expect(nav).toContain(entry);
    });
  });
});

describe("Pass 108: ManusNextDashboard Capability Validation", () => {
  const dash = readFileSync(join(ROOT, "client/src/pages/ManusNextDashboard.tsx"), "utf-8");

  it("has capability categories", () => {
    expect(dash).toContain("Wealth Engine Calculators");
    expect(dash).toContain("FRED Economic Data");
  });

  it("has validation function", () => {
    expect(dash).toContain("validateCapability");
  });

  it("shows extraction status indicators", () => {
    expect(dash).toContain("live");
    expect(dash).toContain("planned");
  });
});

describe("Pass 108: Documentation Updated", () => {
  it("BUILD_MANIFEST.json has version 108b", () => {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, "docs/manus-next/BUILD_MANIFEST.json"), "utf-8")
    );
    expect(manifest.version).toBe("108b");
    expect(manifest.surfaces.newFrontendPages.pass108.length).toBe(6);
    expect(manifest.surfaces.commandCenter.wiredToTRPC).toBe(true);
  });

  it("build-log.md has Pass 108 entry", () => {
    const log = readFileSync(join(ROOT, "docs/manus-next/build-log.md"), "utf-8");
    expect(log).toContain("| 108 |");
    expect(log).toContain("Backend-Frontend Parity");
  });

  it("refactor-log.md has Pass 108 entries (R-011 through R-015)", () => {
    const log = readFileSync(join(ROOT, "docs/manus-next/refactor-log.md"), "utf-8");
    expect(log).toContain("R-011");
    expect(log).toContain("R-015");
    expect(log).toContain("ManusNextDashboard");
  });

  it("README.md has validation dashboard section", () => {
    const readme = readFileSync(join(ROOT, "docs/manus-next/README.md"), "utf-8");
    expect(readme).toContain("Validation Dashboard");
    expect(readme).toContain("/manus-next");
  });
});
