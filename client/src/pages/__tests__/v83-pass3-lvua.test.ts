/**
 * v8.3 Pass 3 — LVUA Regression Tests
 * Validates fixes for issues found during Live Virtual User Assessment:
 * - PARITY-CRASH-0001: panelAnalytics TDZ crash
 * - PARITY-CRASH-0002: showShortcuts TDZ crash
 * - PARITY-NAV-0012: /wealth-engine/retirement deep link
 * - PARITY-A11Y-0005: Chat unlabeled buttons
 * - PARITY-DATA-0008: People stats "--" → "0"
 * - PARITY-MOBILE-0015: CascadeFlowIndicator flex-wrap
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CLIENT = path.resolve(__dirname, "../..");

describe("LVUA Regression: PARITY-CRASH-0001 + PARITY-CRASH-0002 — Calculators TDZ fixes", () => {
  const calcSrc = fs.readFileSync(path.join(CLIENT, "pages/Calculators.tsx"), "utf-8");
  const lines = calcSrc.split("\n");

  it("panelAnalytics is declared before navigateToPanel uses it", () => {
    const declLine = lines.findIndex(l => l.includes("usePanelAnalytics()"));
    const useLine = lines.findIndex(l => l.includes("panelAnalytics.recordVisit"));
    expect(declLine).toBeGreaterThan(-1);
    expect(useLine).toBeGreaterThan(-1);
    expect(declLine).toBeLessThan(useLine);
  });

  it("showShortcuts is declared before keyboard handler useEffect uses it", () => {
    const declLine = lines.findIndex(l => l.includes("const [showShortcuts, setShowShortcuts]"));
    const useEffectLine = lines.findIndex(l => l.includes("/* ─── KEYBOARD SHORTCUTS"));
    expect(declLine).toBeGreaterThan(-1);
    expect(useEffectLine).toBeGreaterThan(-1);
    expect(declLine).toBeLessThan(useEffectLine);
  });
});

describe("LVUA Regression: PARITY-NAV-0012 — /wealth-engine/:panel deep linking", () => {
  const appSrc = fs.readFileSync(path.join(CLIENT, "App.tsx"), "utf-8");
  const calcSrc = fs.readFileSync(path.join(CLIENT, "pages/Calculators.tsx"), "utf-8");

  it("App.tsx has /wealth-engine/:panel sub-route", () => {
    expect(appSrc).toContain('/wealth-engine/:panel');
  });

  it("App.tsx has /calculators/:panel sub-route", () => {
    expect(appSrc).toContain('/calculators/:panel');
  });

  it("Calculators.tsx parses path-based panel from URL", () => {
    expect(calcSrc).toContain("pathParts[1] === 'wealth-engine'");
    expect(calcSrc).toContain("pathParts[1] === 'calculators'");
  });
});

describe("LVUA Regression: PARITY-A11Y-0005 — Chat unlabeled buttons", () => {
  const chatSrc = fs.readFileSync(path.join(CLIENT, "pages/Chat.tsx"), "utf-8");

  it("Add context button has aria-label", () => {
    // The button with showAddMenu toggle should have aria-label
    expect(chatSrc).toContain('aria-label={showAddMenu ? "Close context menu" : "Add context"}');
  });

  it("Mute audio button has aria-label", () => {
    expect(chatSrc).toContain('aria-label="Mute audio"');
  });
});

describe("LVUA Regression: PARITY-DATA-0008 — People stats show '0' not '--'", () => {
  const peopleSrc = fs.readFileSync(path.join(CLIENT, "pages/PeopleHub.tsx"), "utf-8");

  it("No '--' stats remain in PeopleHub pipeline health", () => {
    // The old pattern was: <p className="text-xl font-bold text-foreground">--</p>
    expect(peopleSrc).not.toContain('font-bold text-foreground">--</p>');
  });

  it("Pipeline stats show '0' with dimmed styling", () => {
    expect(peopleSrc).toContain('text-muted-foreground/50">0</p>');
  });
});

describe("LVUA Regression: PARITY-MOBILE-0015 — CascadeFlowIndicator mobile wrap", () => {
  const cfSrc = fs.readFileSync(
    path.join(CLIENT, "components/CascadeFlowIndicator.tsx"),
    "utf-8"
  );

  it("CascadeFlowIndicator has flex-wrap for mobile", () => {
    expect(cfSrc).toContain("flex-wrap");
    expect(cfSrc).toContain("sm:flex-nowrap");
  });
});
