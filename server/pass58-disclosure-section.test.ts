/**
 * Pass 58 — DisclosureSection component + Mobile stability tests
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

describe("Pass 58 — DisclosureSection component", () => {
  const src = readFileSync(join(ROOT, "client/src/components/DisclosureSection.tsx"), "utf-8");

  it("exports DisclosureSection component", () => {
    expect(src).toContain("export function DisclosureSection");
  });

  it("exports useDisclosureGate hook", () => {
    expect(src).toContain("export function useDisclosureGate");
  });

  it("accepts minLevel prop (1-4)", () => {
    expect(src).toContain("minLevel: 1 | 2 | 3 | 4");
  });

  it("shows teaser card when level not met and showTeaser is true", () => {
    expect(src).toContain("showTeaser");
    expect(src).toContain("Lock");
    expect(src).toContain("Available at");
  });

  it("renders children when level is met", () => {
    expect(src).toContain("level >= minLevel");
    expect(src).toContain("{children}");
  });

  it("has proper ARIA for teaser", () => {
    expect(src).toContain("role=\"region\"");
    expect(src).toContain("aria-label");
  });

  it("defines LEVEL_NAMES mapping", () => {
    expect(src).toContain("Essential");
    expect(src).toContain("Standard");
    expect(src).toContain("Advanced");
    expect(src).toContain("Expert");
  });
});

describe("Pass 58 — DisclosureSection integration in pages", () => {
  it("FinancialPlanning uses useDisclosureGate for Roth tab", () => {
    const src = readFileSync(join(ROOT, "client/src/pages/FinancialPlanning.tsx"), "utf-8");
    expect(src).toContain("useDisclosureGate");
    expect(src).toContain("showRoth");
  });

  it("MarketData uses DisclosureSection for DataBank", () => {
    const src = readFileSync(join(ROOT, "client/src/pages/MarketData.tsx"), "utf-8");
    expect(src).toContain("DisclosureSection");
    expect(src).toContain("minLevel={2}");
  });

  it("Integrations uses DisclosureSection for SOFR and CRM", () => {
    const src = readFileSync(join(ROOT, "client/src/pages/Integrations.tsx"), "utf-8");
    expect(src).toContain("DisclosureSection");
    expect(src).toContain("minLevel={3}");
  });
});

describe("Pass 58 — Mobile stability improvements", () => {
  it("AppShell main content has overflow-x-hidden", () => {
    const src = readFileSync(join(ROOT, "client/src/components/AppShell.tsx"), "utf-8");
    expect(src).toContain("overflow-x-hidden");
  });

  it("AppShell mobile header has safe-area-top and h-14", () => {
    const src = readFileSync(join(ROOT, "client/src/components/AppShell.tsx"), "utf-8");
    expect(src).toContain("safe-area-top");
    expect(src).toContain("h-14");
  });

  it("index.css has safe-area-top utility", () => {
    const src = readFileSync(join(ROOT, "client/src/index.css"), "utf-8");
    expect(src).toContain("safe-area-top");
    expect(src).toContain("safe-area-inset-top");
  });

  it("PersonaSidebar5 has isMobile prop for larger touch targets", () => {
    const src = readFileSync(join(ROOT, "client/src/components/PersonaSidebar5.tsx"), "utf-8");
    expect(src).toContain("isMobile");
    expect(src).toContain("min-h-[44px]");
  });

  it("viewport meta has viewport-fit=cover", () => {
    const src = readFileSync(join(ROOT, "client/index.html"), "utf-8");
    expect(src).toContain("viewport-fit=cover");
  });

  it("wide tables have overflow-x-auto wrappers", () => {
    const panelsD = readFileSync(join(ROOT, "client/src/pages/calculators/PanelsD.tsx"), "utf-8");
    // Count min-w-[700px] occurrences and overflow-x-auto occurrences
    const minW700 = (panelsD.match(/min-w-\[700px\]/g) || []).length;
    const overflowAuto = (panelsD.match(/overflow-x-auto/g) || []).length;
    expect(overflowAuto).toBeGreaterThanOrEqual(minW700);
  });
});

describe("Pass 58 — Progressive disclosure sidebar filtering", () => {
  const src = readFileSync(join(ROOT, "client/src/components/PersonaSidebar5.tsx"), "utf-8");

  it("filters items by disclosureLevel", () => {
    expect(src).toContain("disclosureLevel");
    expect(src).toContain("item.disclosureLevel");
  });

  it("has level 2, 3, and 4 items defined", () => {
    expect(src).toContain("disclosureLevel: 2");
    expect(src).toContain("disclosureLevel: 3");
    expect(src).toContain("disclosureLevel: 4");
  });

  it("uses DisclosureContext", () => {
    expect(src).toContain("useDisclosure");
  });
});
