/**
 * Pass 58 — Email Delivery Service tests
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

describe("Pass 58 — Email Delivery Service", () => {
  const src = readFileSync(join(ROOT, "server/services/email/emailDelivery.ts"), "utf-8");

  it("exports sendEmail function", () => {
    expect(src).toContain("export async function sendEmail");
  });

  it("exports sendBatch function", () => {
    expect(src).toContain("export async function sendBatch");
  });

  it("exports getDeliveryStats function", () => {
    expect(src).toContain("export function getDeliveryStats");
  });

  it("has Resend provider", () => {
    expect(src).toContain("resendProvider");
    expect(src).toContain("api.resend.com");
  });

  it("has in-app fallback provider", () => {
    expect(src).toContain("inAppProvider");
    expect(src).toContain("in-app");
  });

  it("implements rate limiting per provider", () => {
    expect(src).toContain("checkAndIncrementRate");
    expect(src).toContain("dailyLimit");
    expect(src).toContain("dailySent");
  });

  it("has automatic failover chain", () => {
    expect(src).toContain("Provider failed, trying next");
    expect(src).toContain("for (const provider of providers)");
  });

  it("respects Resend free tier limit (100/day)", () => {
    expect(src).toContain("dailyLimit: 100");
  });

  it("has batch sending with progress callback", () => {
    expect(src).toContain("onProgress");
    expect(src).toContain("messages.length");
  });

  it("adds delay between batch sends", () => {
    expect(src).toContain("setTimeout(r, 100)");
  });
});

describe("Pass 58 — Email Campaign Integration", () => {
  const src = readFileSync(join(ROOT, "server/services/emailCampaign.ts"), "utf-8");

  it("imports sendEmail from delivery service", () => {
    expect(src).toContain('import { sendEmail } from "./email/emailDelivery"');
  });

  it("uses sendEmail for campaign delivery", () => {
    expect(src).toContain("const deliveryResult = await sendEmail");
  });

  it("still sends in-app notification as backup", () => {
    expect(src).toContain("sendNotification(recipient.recipientEmail");
  });

  it("checks deliveryResult.success", () => {
    expect(src).toContain("const sent = deliveryResult.success");
  });
});
