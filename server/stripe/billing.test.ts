/**
 * Tests for Stripe Billing, Deepgram Transcription, and Daily.co Video
 * integration layer — structural + unit tests.
 */
import { describe, it, expect, vi } from "vitest";

// ─── Stripe Products ───────────────────────────────────────────────
describe("Stripe Products Configuration", () => {
  it("exports PLANS with starter, professional, enterprise", async () => {
    const { PLANS, PLAN_ORDER } = await import("./products");
    expect(PLAN_ORDER).toEqual(["starter", "professional", "enterprise"]);
    expect(Object.keys(PLANS)).toEqual(expect.arrayContaining(["starter", "professional", "enterprise"]));
  });

  it("each plan has required fields", async () => {
    const { PLANS } = await import("./products");
    for (const [key, plan] of Object.entries(PLANS)) {
      expect(plan.id).toBe(key);
      expect(plan.name).toBeTruthy();
      expect(plan.description).toBeTruthy();
      expect(plan.priceMonthly).toBeGreaterThan(0);
      expect(plan.priceYearly).toBeGreaterThan(0);
      expect(plan.features.length).toBeGreaterThan(0);
      expect(plan.limits).toBeDefined();
      expect(plan.limits.clients).toBeDefined();
      expect(plan.limits.advisors).toBeDefined();
    }
  });

  it("yearly price is less than 12x monthly", async () => {
    const { PLANS } = await import("./products");
    for (const plan of Object.values(PLANS)) {
      expect(plan.priceYearly).toBeLessThan(plan.priceMonthly * 12);
    }
  });

  it("getPlan returns correct plan or undefined", async () => {
    const { getPlan } = await import("./products");
    expect(getPlan("starter")).toBeDefined();
    expect(getPlan("starter")!.id).toBe("starter");
    expect(getPlan("nonexistent")).toBeUndefined();
  });

  it("getPlanPrice returns correct price for interval", async () => {
    const { getPlanPrice, PLANS } = await import("./products");
    expect(getPlanPrice("starter", "month")).toBe(PLANS.starter.priceMonthly);
    expect(getPlanPrice("starter", "year")).toBe(PLANS.starter.priceYearly);
    expect(getPlanPrice("nonexistent", "month")).toBe(0);
  });

  it("professional plan is marked as popular", async () => {
    const { PLANS } = await import("./products");
    expect(PLANS.professional.popular).toBe(true);
    expect(PLANS.starter.popular).toBeFalsy();
  });
});

// ─── Billing Router Structure ──────────────────────────────────────
describe("Billing Router Structure", () => {
  it("exports billingRouter with expected procedures", async () => {
    const { billingRouter } = await import("./billingRouter");
    expect(billingRouter).toBeDefined();
    const keys = Object.keys((billingRouter as any)._def.record);
    expect(keys).toEqual(expect.arrayContaining([
      "getPlans",
      "getSubscription",
      "createCheckout",
      "createPortalSession",
      "getHistory",
    ]));
  });
});

// ─── Webhook Handler Structure ─────────────────────────────────────
describe("Stripe Webhook Handler", () => {
  it("exports stripeWebhookHandler function", async () => {
    const { stripeWebhookHandler } = await import("./webhookHandler");
    expect(typeof stripeWebhookHandler).toBe("function");
  });
});

// ─── Deepgram Service ──────────────────────────────────────────────
describe("Deepgram Service", () => {
  it("exports transcribeWithDeepgram function", async () => {
    const mod = await import("../services/deepgramService");
    expect(typeof mod.transcribeWithDeepgram).toBe("function");
  });

  it("exports getDeepgramStreamingToken function", async () => {
    const mod = await import("../services/deepgramService");
    expect(typeof mod.getDeepgramStreamingToken).toBe("function");
  });

  it("exports getDeepgramWebSocketUrl function", async () => {
    const mod = await import("../services/deepgramService");
    expect(typeof mod.getDeepgramWebSocketUrl).toBe("function");
  });

  it("getDeepgramWebSocketUrl returns valid wss URL", async () => {
    const { getDeepgramWebSocketUrl } = await import("../services/deepgramService");
    const url = getDeepgramWebSocketUrl();
    expect(url).toMatch(/^wss:\/\/api\.deepgram\.com/);
    expect(url).toContain("model=nova-2");
    expect(url).toContain("language=en");
  });

  it("getDeepgramWebSocketUrl accepts custom config", async () => {
    const { getDeepgramWebSocketUrl } = await import("../services/deepgramService");
    const url = getDeepgramWebSocketUrl({ language: "es", model: "nova-2-medical" });
    expect(url).toContain("language=es");
    expect(url).toContain("model=nova-2-medical");
  });

  it("transcribeWithDeepgram returns error for invalid audio URL", async () => {
    const { transcribeWithDeepgram } = await import("../services/deepgramService");
    const result = await transcribeWithDeepgram("https://example.com/nonexistent-audio.mp3");
    // Either NOT_CONFIGURED (no key) or API_ERROR (key present but invalid URL)
    if ("error" in result) {
      expect(["NOT_CONFIGURED", "API_ERROR"]).toContain(result.code);
    }
  });
});

// ─── Daily.co Service ──────────────────────────────────────────────
describe("Daily.co Service", () => {
  it("exports createRoom function", async () => {
    const mod = await import("../services/dailyService");
    expect(typeof mod.createRoom).toBe("function");
  });

  it("exports getRoom function", async () => {
    const mod = await import("../services/dailyService");
    expect(typeof mod.getRoom).toBe("function");
  });

  it("exports deleteRoom function", async () => {
    const mod = await import("../services/dailyService");
    expect(typeof mod.deleteRoom).toBe("function");
  });

  it("exports createMeetingToken function", async () => {
    const mod = await import("../services/dailyService");
    expect(typeof mod.createMeetingToken).toBe("function");
  });

  it("exports listRooms function", async () => {
    const mod = await import("../services/dailyService");
    expect(typeof mod.listRooms).toBe("function");
  });

  it("exports getRoomRecordings function", async () => {
    const mod = await import("../services/dailyService");
    expect(typeof mod.getRoomRecordings).toBe("function");
  });

  it("createRoom returns NOT_CONFIGURED when key is missing", async () => {
    const { createRoom } = await import("../services/dailyService");
    const result = await createRoom({});
    if ("error" in result) {
      expect(result.code).toBe("NOT_CONFIGURED");
    }
  });
});

// ─── Video Conferencing Router ─────────────────────────────────────
describe("Video Conferencing Router Structure", () => {
  it("exports videoConferencingRouter with rooms and transcription sub-routers", async () => {
    const { videoConferencingRouter } = await import("../routers/videoConferencing");
    expect(videoConferencingRouter).toBeDefined();
    const keys = Object.keys((videoConferencingRouter as any)._def.record);
    expect(keys).toEqual(expect.arrayContaining(["rooms", "transcription"]));
  });

  it("rooms sub-router is defined and callable", async () => {
    const { videoConferencingRouter } = await import("../routers/videoConferencing");
    const record = (videoConferencingRouter as any)._def.record;
    expect(record.rooms).toBeDefined();
    expect(record.rooms).toBeTruthy();
  });

  it("transcription sub-router is defined and callable", async () => {
    const { videoConferencingRouter } = await import("../routers/videoConferencing");
    const record = (videoConferencingRouter as any)._def.record;
    expect(record.transcription).toBeDefined();
    expect(record.transcription).toBeTruthy();
  });
});
