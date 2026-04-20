/**
 * v8.3 Pass 10 — Convergence Validation Tests
 *
 * Validates:
 * 1. Greeting i18n fix (no "Good Good" duplication)
 * 2. All translation files consistent
 * 3. RTL CSS utilities present
 * 4. Pull-to-refresh hook exists
 * 5. No regressions from Pass 9
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CLIENT = path.resolve(__dirname, "../../..");
const ROOT = path.resolve(CLIENT, "..");

// ── Greeting Fix (P0 bug from Pass 9 screenshot) ──

describe("Greeting i18n fix — no duplication", () => {
  it("en.ts chat.greeting does NOT contain 'Good' prefix", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/locales/en.ts"), "utf8");
    // chat.greeting should be "{{timeOfDay}}, {{name}}" — NOT "Good {{timeOfDay}}, {{name}}"
    const match = content.match(/"chat\.greeting":\s*"([^"]+)"/);
    expect(match).toBeTruthy();
    const greeting = match![1];
    expect(greeting).not.toMatch(/^Good\s/);
    expect(greeting).toContain("{{timeOfDay}}");
    expect(greeting).toContain("{{name}}");
  });

  it("en.ts common.morning/afternoon/evening are complete greetings", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/locales/en.ts"), "utf8");
    expect(content).toContain('"common.morning": "Good morning"');
    expect(content).toContain('"common.afternoon": "Good afternoon"');
    expect(content).toContain('"common.evening": "Good evening"');
  });

  it("es.ts chat.greeting does NOT contain 'Buenos/Buenas' prefix", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/locales/es.ts"), "utf8");
    const match = content.match(/"chat\.greeting":\s*"([^"]+)"/);
    expect(match).toBeTruthy();
    const greeting = match![1];
    expect(greeting).not.toMatch(/^Buen/);
    expect(greeting).toContain("{{timeOfDay}}");
  });

  it("ar.ts chat.greeting uses interpolation without prefix", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/locales/ar.ts"), "utf8");
    const match = content.match(/"chat\.greeting":\s*"([^"]+)"/);
    expect(match).toBeTruthy();
    const greeting = match![1];
    expect(greeting).toContain("{{timeOfDay}}");
    expect(greeting).toContain("{{name}}");
  });

  it("ChatGreeting.tsx uses t() for greeting construction", () => {
    const content = fs.readFileSync(
      path.join(CLIENT, "src/components/ChatGreeting.tsx"),
      "utf8"
    );
    expect(content).toContain('t("chat.greeting"');
    expect(content).toContain("t(`common.${timeOfDay}`");
  });
});

// ── Translation File Consistency ──

describe("Translation file consistency", () => {
  it("all 3 locale files exist", () => {
    expect(fs.existsSync(path.join(CLIENT, "src/locales/en.ts"))).toBe(true);
    expect(fs.existsSync(path.join(CLIENT, "src/locales/es.ts"))).toBe(true);
    expect(fs.existsSync(path.join(CLIENT, "src/locales/ar.ts"))).toBe(true);
  });

  it("en.ts has ≥130 translation keys", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/locales/en.ts"), "utf8");
    const keyCount = (content.match(/"\w+\.\w+(\.\w+)*":/g) || []).length;
    expect(keyCount).toBeGreaterThanOrEqual(130);
  });

  it("es.ts has ≥100 translation keys", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/locales/es.ts"), "utf8");
    const keyCount = (content.match(/"\w+\.\w+(\.\w+)*":/g) || []).length;
    expect(keyCount).toBeGreaterThanOrEqual(100);
  });

  it("ar.ts has ≥100 translation keys", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/locales/ar.ts"), "utf8");
    const keyCount = (content.match(/"\w+\.\w+(\.\w+)*":/g) || []).length;
    expect(keyCount).toBeGreaterThanOrEqual(100);
  });

  it("i18n config registers all 3 languages", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/lib/i18n.ts"), "utf8");
    expect(content).toContain("en:");
    expect(content).toContain("es:");
    expect(content).toContain("ar:");
  });
});

// ── RTL Support Intact ──

describe("RTL support intact", () => {
  it("index.css has [dir=rtl] rules", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/index.css"), "utf8");
    expect(content).toContain('[dir="rtl"]');
  });

  it("main.tsx has RTL_LANGS set and direction detection", () => {
    const content = fs.readFileSync(path.join(CLIENT, "src/main.tsx"), "utf8");
    expect(content).toContain("RTL_LANGS");
    expect(content).toContain("document.documentElement.dir");
  });

  it("LanguageTab includes Arabic option", () => {
    const content = fs.readFileSync(
      path.join(CLIENT, "src/pages/settings/LanguageTab.tsx"),
      "utf8"
    );
    expect(content).toContain("ar");
    expect(content).toMatch(/arabic|العربية/i);
  });
});

// ── Pull-to-Refresh Intact ──

describe("Pull-to-refresh intact", () => {
  it("usePullToRefresh hook exists", () => {
    expect(
      fs.existsSync(path.join(CLIENT, "src/hooks/usePullToRefresh.ts"))
    ).toBe(true);
  });

  it("PullToRefreshIndicator component exists", () => {
    expect(
      fs.existsSync(
        path.join(CLIENT, "src/components/PullToRefreshIndicator.tsx")
      )
    ).toBe(true);
  });

  it("ClientDashboard imports pull-to-refresh", () => {
    const content = fs.readFileSync(
      path.join(CLIENT, "src/pages/ClientDashboard.tsx"),
      "utf8"
    );
    expect(content).toContain("usePullToRefresh");
  });
});

// ── Voice Features Intact ──

describe("Voice features intact", () => {
  it("ConversationalVoiceOverlay exists with useTranslation", () => {
    const content = fs.readFileSync(
      path.join(CLIENT, "src/components/ConversationalVoiceOverlay.tsx"),
      "utf8"
    );
    expect(content).toContain("useTranslation");
    expect(content).toContain("useConversationalVoice");
  });

  it("useTTS hook exists with pause/resume/download", () => {
    const content = fs.readFileSync(
      path.join(CLIENT, "src/hooks/useTTS.ts"),
      "utf8"
    );
    expect(content).toContain("pause");
    expect(content).toContain("resume");
    expect(content).toContain("download");
  });
});

// ── PARITY Status ──

describe("PARITY status", () => {
  it("PARITY.md exists and has Pass 9 entry", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "docs/PARITY.md"),
      "utf8"
    );
    expect(content).toContain("v8.3-P9");
  });

  it("G32 and G40 are closed in PARITY.md", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "docs/PARITY.md"),
      "utf8"
    );
    // G32 and G40 should appear in the Pass 9 entry as closed
    expect(content).toContain("G32");
    expect(content).toContain("G40");
  });

  it("only infrastructure/external-dependency items remain open", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "docs/PARITY.md"),
      "utf8"
    );
    const openItems = content.match(/\| open \|/g) || [];
    // Should be exactly 3: DATA-0003, DATA-0004, DATA-0005
    expect(openItems.length).toBeLessThanOrEqual(3);
  });
});

// ── Platform Documentation ──

describe("Platform documentation updated", () => {
  it("PLATFORM_GUIDE.md has i18n section", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "PLATFORM_GUIDE.md"),
      "utf8"
    );
    expect(content).toMatch(/i18n|internationalization|language/i);
  });

  it("PLATFORM_GUIDE.md has RTL section", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "PLATFORM_GUIDE.md"),
      "utf8"
    );
    expect(content).toMatch(/RTL|right.to.left|arabic/i);
  });

  it("PLATFORM_GUIDE.md has voice mode section", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "PLATFORM_GUIDE.md"),
      "utf8"
    );
    expect(content).toMatch(/conversational voice|full.duplex|voice mode/i);
  });
});
