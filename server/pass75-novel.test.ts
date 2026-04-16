/**
 * Pass 75 — Novel Feature Integration Tests
 *
 * Covers:
 * 1. MarketingAssets page (content library wired to comms.templates)
 * 2. InlineChart integration in ProgressiveMessage (chart block parsing)
 * 3. Chart generation instructions in system prompt
 * 4. Route registration for /marketing-assets
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CLIENT = path.resolve(__dirname, "../client/src");
const SERVER = path.resolve(__dirname, ".");

describe("Pass 75 — MarketingAssets Page", () => {
  const filePath = path.join(CLIENT, "pages/MarketingAssets.tsx");

  it("MarketingAssets.tsx exists", () => {
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("wires to comms.templates tRPC query", () => {
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toContain("trpc.comms.templates.useQuery");
  });

  it("wires to comms.template single-template query", () => {
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toContain("trpc.comms.template.useQuery");
  });

  it("wires to comms.generate mutation for draft generation", () => {
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toContain("trpc.comms.generate.useMutation");
  });

  it("has SEOHead for proper page metadata", () => {
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toContain("SEOHead");
  });

  it("has category filter with all 9 template categories", () => {
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toContain("review_reminder");
    expect(src).toContain("market_update");
    expect(src).toContain("birthday");
    expect(src).toContain("life_event");
    expect(src).toContain("onboarding");
    expect(src).toContain("compliance");
    expect(src).toContain("referral_thank_you");
    expect(src).toContain("annual_summary");
  });

  it("has search filtering", () => {
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toContain("Search templates");
  });

  it("has preview and generate dialogs", () => {
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toContain("Template Preview");
    expect(src).toContain("Generate Draft");
  });

  it("has QueryErrorBanner for error handling", () => {
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toContain("QueryErrorBanner");
  });

  it("has loading and empty states", () => {
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toContain("Loading templates");
    expect(src).toContain("No templates found");
  });
});

describe("Pass 75 — Route Registration", () => {
  it("/marketing-assets route exists in App.tsx", () => {
    const src = fs.readFileSync(path.join(CLIENT, "App.tsx"), "utf8");
    expect(src).toContain("/marketing-assets");
    expect(src).toContain("MarketingAssets");
  });

  it("MarketingAssets lazy import exists", () => {
    const src = fs.readFileSync(path.join(CLIENT, "App.tsx"), "utf8");
    expect(src).toMatch(/lazy\(\(\) => import\("\.\/pages\/MarketingAssets"\)\)/);
  });

  it("Content Library entry exists in Help page", () => {
    const src = fs.readFileSync(path.join(CLIENT, "pages/Help.tsx"), "utf8");
    expect(src).toContain("Content Library");
    expect(src).toContain("/marketing-assets");
  });
});

describe("Pass 75 — InlineChart Integration in ProgressiveMessage", () => {
  it("ProgressiveMessage imports parseChartBlocks", () => {
    const src = fs.readFileSync(path.join(CLIENT, "components/ProgressiveMessage.tsx"), "utf8");
    expect(src).toContain("parseChartBlocks");
  });

  it("ProgressiveMessage lazy-loads InlineChart", () => {
    const src = fs.readFileSync(path.join(CLIENT, "components/ProgressiveMessage.tsx"), "utf8");
    expect(src).toContain("lazy(() => import(\"./InlineChart\"))");
  });

  it("ProgressiveMessage renders RichContent with charts", () => {
    const src = fs.readFileSync(path.join(CLIENT, "components/ProgressiveMessage.tsx"), "utf8");
    expect(src).toContain("RichContent");
    expect(src).toContain("charts");
  });

  it("parseChartBlocks function exists in InlineChart", () => {
    const src = fs.readFileSync(path.join(CLIENT, "components/InlineChart.tsx"), "utf8");
    expect(src).toContain("export function parseChartBlocks");
  });
});

describe("Pass 75 — Chart Instructions in System Prompt", () => {
  it("system prompt includes INLINE CHARTS instruction", () => {
    const src = fs.readFileSync(path.join(SERVER, "prompts.ts"), "utf8");
    expect(src).toContain("INLINE CHARTS");
  });

  it("system prompt describes chart JSON format", () => {
    const src = fs.readFileSync(path.join(SERVER, "prompts.ts"), "utf8");
    expect(src).toContain("chart code block with JSON");
    expect(src).toContain("datasets");
  });

  it("system prompt mentions chart types", () => {
    const src = fs.readFileSync(path.join(SERVER, "prompts.ts"), "utf8");
    expect(src).toContain("bar");
    expect(src).toContain("line");
    expect(src).toContain("pie");
  });
});
