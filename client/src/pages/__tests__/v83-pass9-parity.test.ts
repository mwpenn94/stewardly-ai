/**
 * v8.3 Pass 9 — i18n wiring, RTL support, pull-to-refresh, documentation
 * Regression tests for G32 (RTL), G40 (pull-to-refresh), i18n wiring
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CLIENT = path.resolve(__dirname, "../../../");
const ROOT = path.resolve(CLIENT, "..");

// ── i18n Framework ──

describe("i18n framework", () => {
  it("i18n config file exists with i18next setup", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/lib/i18n.ts"), "utf8");
    expect(content).toContain("i18next");
    expect(content).toContain("react-i18next");
    expect(content).toContain("initReactI18next");
  });

  it("English translation file has 100+ keys", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/locales/en.ts"), "utf8");
    const keyCount = (content.match(/:\s*['"]/g) || []).length;
    expect(keyCount).toBeGreaterThan(100);
  });

  it("Spanish translation file exists", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/locales/es.ts"), "utf8");
    expect(content).toContain("export default");
    expect(content).toContain("translation");
  });

  it("Arabic translation file exists", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/locales/ar.ts"), "utf8");
    expect(content).toContain("export default");
    expect(content).toContain("translation");
  });

  it("i18n config includes all three languages (en, es, ar)", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/lib/i18n.ts"), "utf8");
    expect(content).toContain("en:");
    expect(content).toContain("es:");
    expect(content).toContain("ar:");
  });

  it("main.tsx imports i18n and sets RTL direction", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/main.tsx"), "utf8");
    expect(content).toContain("@/lib/i18n");
    expect(content).toContain("RTL_LANGS");
    expect(content).toContain("document.documentElement.dir");
  });
});

// ── i18n Wiring into Components ──

describe("i18n wiring into key components", () => {
  it("ChatGreeting uses useTranslation", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/components/ChatGreeting.tsx"), "utf8");
    expect(content).toContain("useTranslation");
    expect(content).toContain("t(");
  });

  it("PersonaSidebar5 uses useTranslation", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/components/PersonaSidebar5.tsx"), "utf8");
    expect(content).toContain("useTranslation");
  });

  it("SettingsHub uses useTranslation", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/pages/SettingsHub.tsx"), "utf8");
    expect(content).toContain("useTranslation");
  });

  it("ConversationalVoiceOverlay uses useTranslation", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/components/ConversationalVoiceOverlay.tsx"), "utf8");
    expect(content).toContain("useTranslation");
    expect(content).toContain("t(");
  });
});

// ── G32: RTL Support ──

describe("G32: RTL support", () => {
  it("RTL CSS utilities in index.css", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/index.css"), "utf8");
    expect(content).toContain('[dir="rtl"]');
  });

  it("RTL sidebar mirror rule exists", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/index.css"), "utf8");
    expect(content).toMatch(/\[dir="rtl"\].*sidebar|sidebar.*\[dir="rtl"\]/s);
  });

  it("RTL code/numbers stay LTR", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/index.css"), "utf8");
    expect(content).toContain("direction: ltr");
  });

  it("LanguageTab has Arabic option", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/pages/settings/LanguageTab.tsx"), "utf8");
    expect(content).toContain("ar");
    expect(content).toContain("العربية");
  });

  it("LanguageTab sets document direction on language change", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/pages/settings/LanguageTab.tsx"), "utf8");
    expect(content).toContain("document.documentElement.dir");
  });

  it("main.tsx initializes RTL direction from saved language", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/main.tsx"), "utf8");
    expect(content).toContain("dir");
  });
});

// ── G40: Pull-to-Refresh ──

describe("G40: Pull-to-refresh", () => {
  it("usePullToRefresh hook exists", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/hooks/usePullToRefresh.ts"), "utf8");
    expect(content).toContain("usePullToRefresh");
    expect(content).toContain("touchstart");
    expect(content).toContain("touchmove");
    expect(content).toContain("touchend");
  });

  it("PullToRefreshIndicator component exists", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/components/PullToRefreshIndicator.tsx"), "utf8");
    expect(content).toContain("PullToRefreshIndicator");
  });

  it("usePullToRefresh has resistance curve", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/hooks/usePullToRefresh.ts"), "utf8");
    // Should have some form of resistance/dampening calculation
    expect(content).toMatch(/Math\.(min|max|pow|sqrt)|resistance|dampen/);
  });

  it("ClientDashboard uses pull-to-refresh", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/pages/ClientDashboard.tsx"), "utf8");
    expect(content).toContain("usePullToRefresh");
    expect(content).toContain("PullToRefreshIndicator");
  });
});

// ── Documentation Updates ──

describe("Documentation updates", () => {
  it("PLATFORM_GUIDE mentions Conversational Voice Mode", () => {
    const content = fs.readFileSync(path.join(ROOT, "PLATFORM_GUIDE.md"), "utf8");
    expect(content).toContain("Conversational Voice Mode");
  });

  it("PLATFORM_GUIDE mentions i18n/Internationalization", () => {
    const content = fs.readFileSync(path.join(ROOT, "PLATFORM_GUIDE.md"), "utf8");
    expect(content).toContain("Internationalization");
    expect(content).toContain("i18next");
  });

  it("PLATFORM_GUIDE mentions RTL support", () => {
    const content = fs.readFileSync(path.join(ROOT, "PLATFORM_GUIDE.md"), "utf8");
    expect(content).toContain("RTL");
    expect(content).toContain("right-to-left");
  });

  it("PLATFORM_GUIDE mentions pull-to-refresh", () => {
    const content = fs.readFileSync(path.join(ROOT, "PLATFORM_GUIDE.md"), "utf8");
    expect(content).toContain("pull-to-refresh");
    expect(content).toContain("usePullToRefresh");
  });

  it("PARITY.md has G32 closed", () => {
    const content = fs.readFileSync(path.join(ROOT, "docs/PARITY.md"), "utf8");
    expect(content).toMatch(/G32.*closed/);
  });

  it("PARITY.md has G40 closed", () => {
    const content = fs.readFileSync(path.join(ROOT, "docs/PARITY.md"), "utf8");
    expect(content).toMatch(/G40.*closed/);
  });

  it("PARITY.md has Pass 9 entry in Build Loop Pass Log", () => {
    const content = fs.readFileSync(path.join(ROOT, "docs/PARITY.md"), "utf8");
    expect(content).toContain("v8.3-P9");
  });
});
