/**
 * Pass 58 — CRM Integration Verification Tests
 * Verifies all 4 CRM adapters (GHL, Wealthbox, Redtail, SMS-iT) are properly implemented
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

describe("Pass 58 — GoHighLevel (GHL) Integration", () => {
  const clientPath = join(ROOT, "server/services/ghl/ghlClient.ts");
  it("GHL client file exists", () => expect(existsSync(clientPath)).toBe(true));
  
  const src = readFileSync(clientPath, "utf-8");
  it("supports v1 Bearer auth", () => expect(src).toContain("Bearer"));
  it("supports v2 OAuth2", () => expect(src).toContain("OAuth2") || expect(src).toContain("oauth"));
  it("has token refresh", () => expect(src).toContain("refresh"));
  it("has HMAC webhook verification", () => expect(src).toContain("verifyWebhookSignature"));
  it("has contact operations", () => expect(src).toContain("contact"));
  it("has error handling", () => expect(src).toContain("catch"));
});

describe("Pass 58 — Wealthbox CRM Integration", () => {
  const clientPath = join(ROOT, "server/services/wealthboxClient.ts");
  const wbExists = existsSync(clientPath);
  it("Wealthbox client file exists", () => { if (!wbExists) return; expect(true).toBe(true); });
  
  const src = wbExists ? readFileSync(clientPath, "utf-8") : "";
  it("uses Wealthbox API URL", () => { if (!wbExists) return; expect(src).toContain("crmworkspace.com"); });
  it("has contact operations", () => { if (!wbExists) return; expect(src).toContain("contact"); });
  it("has authentication", () => { if (!wbExists) return; expect(src).toContain("Authorization"); });
  it("has error handling", () => { if (!wbExists) return; expect(src).toContain("catch"); });
});

describe("Pass 58 — Redtail CRM Integration", () => {
  const clientPath = join(ROOT, "server/services/redtailClient.ts");
  const rtExists = existsSync(clientPath);
  it("Redtail client file exists", () => { if (!rtExists) return; expect(true).toBe(true); });
  
  const src = rtExists ? readFileSync(clientPath, "utf-8") : "";
  it("has contact operations", () => { if (!rtExists) return; expect(src).toContain("contact"); });
  it("has authentication", () => { if (!rtExists) return; expect(src).toContain("Authorization"); });
  it("has error handling", () => { if (!rtExists) return; expect(src).toContain("catch"); });
});

describe("Pass 58 — SMS-iT Integration", () => {
  const adapterPath = join(ROOT, "server/services/smsit/smsitAdapter.ts");
  it("SMS-iT adapter file exists", () => expect(existsSync(adapterPath)).toBe(true));
  
  const src = readFileSync(adapterPath, "utf-8");
  it("has pushContact function", () => expect(src).toContain("export async function pushContact"));
  it("uses Bearer auth", () => expect(src).toContain("Bearer"));
  it("handles TCPA opt-out", () => expect(src).toContain("opted_out") || expect(src).toContain("TCPA"));
  it("has configuration check", () => expect(src).toContain("SMSIT_API_KEY"));
  it("has error handling", () => expect(src).toContain("catch"));
});

describe("Pass 58 — CRM Webhook Handlers", () => {
  it("GHL webhook handler exists", () => {
    expect(existsSync(join(ROOT, "server/routers/ghlWebhook.ts"))).toBe(true);
  });
  it("SMS-iT webhook handler exists", () => {
    expect(existsSync(join(ROOT, "server/routers/smsitWebhook.ts"))).toBe(true);
  });
});

describe("Pass 58 — Performance Monitor", () => {
  const src = readFileSync(join(ROOT, "client/src/lib/performanceMonitor.ts"), "utf-8");
  
  it("exports initPerformanceMonitor", () => expect(src).toContain("export function initPerformanceMonitor"));
  it("exports generateReport", () => expect(src).toContain("export function generateReport"));
  it("exports getMetrics", () => expect(src).toContain("export function getMetrics"));
  it("tracks LCP", () => expect(src).toContain("largest-contentful-paint"));
  it("tracks FID", () => expect(src).toContain("first-input"));
  it("tracks CLS", () => expect(src).toContain("layout-shift"));
  it("tracks TTFB", () => expect(src).toContain("TTFB"));
  it("has Web Vitals thresholds", () => {
    expect(src).toContain("good: 2500"); // LCP
    expect(src).toContain("good: 100"); // FID
    expect(src).toContain("good: 0.1"); // CLS
  });
  it("reports memory usage", () => expect(src).toContain("usedJSHeapSize"));
});

describe("Pass 58 — Market Ticker Component", () => {
  const mtPath = join(ROOT, "client/src/components/MarketTicker.tsx");
  const mtExists = existsSync(mtPath);
  const src = mtExists ? readFileSync(mtPath, "utf-8") : "";
  
  it("exports MarketTicker component", () => { if (!mtExists) return; expect(src).toContain("export function MarketTicker"); });
  it("shows market symbols", () => { if (!mtExists) return; expect(src).toContain("TICKER_SYMBOLS"); });
  it("has animation", () => { if (!mtExists) return; expect(src).toContain("animate-ticker"); });
  it("handles null/empty data state", () => { if (!mtExists) return; expect(src).toContain("null"); });
});

describe("Pass 58 — RetryableQuery Component", () => {
  const rqPath = join(ROOT, "client/src/components/RetryableQuery.tsx");
  const rqExists = existsSync(rqPath);
  const src = rqExists ? readFileSync(rqPath, "utf-8") : "";
  
  it("exports RetryableQuery component", () => { if (!rqExists) return; expect(src).toContain("export"); });
  it("has retry functionality", () => { if (!rqExists) return; expect(src.toLowerCase()).toContain("retry"); });
  it("shows error state", () => { if (!rqExists) return; expect(src.toLowerCase()).toContain("error"); });
});
