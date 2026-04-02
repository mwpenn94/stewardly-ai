/**
 * Tests for the onboarding → notification integration.
 *
 * Validates that the getOnboardingChecklist procedure returns data
 * that can be transformed into notification-compatible objects.
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createGuestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", hostname: "localhost", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", hostname: "localhost", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("Onboarding → Notification integration", () => {
  it("getOnboardingChecklist returns items with notification-compatible fields", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const items = await caller.exponentialEngine.getOnboardingChecklist();

    expect(Array.isArray(items)).toBe(true);
    if (items.length > 0) {
      const item = items[0];
      // Each item must have fields we map to Notification
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("title");
      expect(typeof item.title).toBe("string");
      // description or body for notification body
      expect(item).toHaveProperty("description");
    }
  });

  it("guest checklist returns items with sign-in action", async () => {
    const caller = appRouter.createCaller(createGuestContext());
    const items = await caller.exponentialEngine.getOnboardingChecklist({
      sessionEvents: [],
    });

    expect(Array.isArray(items)).toBe(true);
    if (items.length > 0) {
      expect(items[0]).toHaveProperty("title");
      expect(items[0]).toHaveProperty("layer");
    }
  });

  it("checklist items can be transformed to notification shape", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const items = await caller.exponentialEngine.getOnboardingChecklist();

    // Transform like OnboardingNotifications does
    const notifications = items
      .filter((i: any) => !i.completed)
      .map((item: any, idx: number) => ({
        id: `onboarding-${item.id}`,
        type: "system" as const,
        priority: idx === 0 ? "medium" : "low",
        title: `Getting Started: ${item.title}`,
        body: item.description,
        metadata: {
          onboardingItem: true,
          href: item.href,
          layer: item.layer,
          itemId: item.id,
        },
        createdAt: Date.now() - (items.length - idx) * 60_000,
        readAt: null,
      }));

    // Each notification should have the required Notification interface fields
    for (const n of notifications) {
      expect(n.id).toMatch(/^onboarding-/);
      expect(n.type).toBe("system");
      expect(["medium", "low"]).toContain(n.priority);
      expect(n.title).toContain("Getting Started:");
      expect(n.body).toBeTruthy();
      expect(n.metadata?.onboardingItem).toBe(true);
      expect(typeof n.createdAt).toBe("number");
    }
  });

  it("dismissOnboarding returns success for authenticated users", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.exponentialEngine.dismissOnboarding();
    expect(result).toEqual({ success: true });
  });
});
