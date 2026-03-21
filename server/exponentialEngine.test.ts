import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  FEATURE_CATALOG,
  type FeatureDefinition,
} from "./services/exponentialEngine";
import type { TrpcContext } from "./_core/context";

// ─── Test Helpers ──────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-exp",
    email: "test@stewardly.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return createAuthContext({ id: 99, role: "admin", name: "Admin User" });
}

function createGuestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

// ─── Feature Catalog Tests ─────────────────────────────────────────────

describe("Exponential Engine — Feature Catalog", () => {
  it("has at least 15 features in the catalog", () => {
    expect(FEATURE_CATALOG.length).toBeGreaterThanOrEqual(15);
  });

  it("every feature has required fields", () => {
    for (const feature of FEATURE_CATALOG) {
      expect(feature.key).toBeTruthy();
      expect(feature.label).toBeTruthy();
      expect(feature.category).toBeTruthy();
      expect(feature.description).toBeTruthy();
      expect(feature.roles).toBeInstanceOf(Array);
      expect(feature.roles.length).toBeGreaterThan(0);
    }
  });

  it("feature keys are unique", () => {
    const keys = FEATURE_CATALOG.map(f => f.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it("includes core features (chat, voice_mode, focus_mode)", () => {
    const keys = FEATURE_CATALOG.map(f => f.key);
    expect(keys).toContain("chat");
    expect(keys).toContain("voice_mode");
    expect(keys).toContain("focus_mode");
  });

  it("includes hub features", () => {
    const keys = FEATURE_CATALOG.map(f => f.key);
    expect(keys).toContain("intelligence_hub");
    expect(keys).toContain("advisory_hub");
    expect(keys).toContain("relationships_hub");
    expect(keys).toContain("operations_hub");
  });

  it("includes AI features", () => {
    const keys = FEATURE_CATALOG.map(f => f.key);
    expect(keys).toContain("calculators");
    expect(keys).toContain("follow_up_suggestions");
    expect(keys).toContain("memory");
  });

  it("includes integration and settings features", () => {
    const keys = FEATURE_CATALOG.map(f => f.key);
    expect(keys).toContain("integrations");
    expect(keys).toContain("ai_settings");
  });

  it("admin features are restricted to admin role", () => {
    const adminFeatures = FEATURE_CATALOG.filter(f => f.category === "admin");
    for (const feature of adminFeatures) {
      expect(feature.roles).toContain("admin");
    }
  });

  it("core features are available to regular users", () => {
    const coreFeatures = FEATURE_CATALOG.filter(f => f.category === "core");
    for (const feature of coreFeatures) {
      expect(feature.roles).toContain("user");
    }
  });

  it("categories are valid", () => {
    const validCategories = ["core", "tools", "ai_features", "integrations", "settings", "admin"];
    for (const feature of FEATURE_CATALOG) {
      expect(validCategories).toContain(feature.category);
    }
  });
});

// ─── Exponential Engine Router Tests ────────────────────────────────────

describe("Exponential Engine — Router", () => {
  // Import the router lazily to avoid module-level DB issues
  let appRouter: any;

  beforeEach(async () => {
    const mod = await import("./routers");
    appRouter = mod.appRouter;
  });

  it("trackEvent requires authentication", async () => {
    const caller = appRouter.createCaller(createGuestContext());
    await expect(
      caller.exponentialEngine.trackEvent({
        eventType: "page_visit",
        featureKey: "chat",
      })
    ).rejects.toThrow();
  });

  it("trackEvent accepts valid input", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.exponentialEngine.trackEvent({
      eventType: "page_visit",
      featureKey: "chat",
      metadata: { path: "/chat" },
      sessionId: "test-session-123",
    });
    expect(result).toEqual({ success: true });
  });

  it("trackEvent accepts minimal input", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.exponentialEngine.trackEvent({
      eventType: "feature_use",
      featureKey: "voice_mode",
    });
    expect(result).toEqual({ success: true });
  });

  it("trackBatch requires authentication", async () => {
    const caller = appRouter.createCaller(createGuestContext());
    await expect(
      caller.exponentialEngine.trackBatch({
        events: [{ eventType: "page_visit", featureKey: "chat" }],
      })
    ).rejects.toThrow();
  });

  it("trackBatch tracks multiple events", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.exponentialEngine.trackBatch({
      events: [
        { eventType: "page_visit", featureKey: "chat" },
        { eventType: "page_visit", featureKey: "intelligence_hub" },
        { eventType: "feature_use", featureKey: "voice_mode" },
      ],
      sessionId: "batch-session",
    });
    expect(result).toEqual({ success: true, tracked: 3 });
  });

  it("getProficiency returns proficiency data for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.exponentialEngine.getProficiency();
    expect(result).toHaveProperty("overallProficiency");
    expect(result).toHaveProperty("totalInteractions");
    expect(result).toHaveProperty("featuresExplored");
    expect(result).toHaveProperty("featuresTotal");
    expect(result).toHaveProperty("exploredFeatures");
    expect(result).toHaveProperty("undiscoveredFeatures");
    expect(result).toHaveProperty("recentActivity");
    expect(typeof result.overallProficiency).toBe("string");
    expect(typeof result.totalInteractions).toBe("number");
    expect(typeof result.featuresExplored).toBe("number");
    expect(typeof result.featuresTotal).toBe("number");
    expect(Array.isArray(result.exploredFeatures)).toBe(true);
    expect(Array.isArray(result.undiscoveredFeatures)).toBe(true);
  });

  it("getProficiency requires authentication", async () => {
    const caller = appRouter.createCaller(createGuestContext());
    await expect(caller.exponentialEngine.getProficiency()).rejects.toThrow();
  });

  it("getFeatureCatalog is publicly accessible", async () => {
    const caller = appRouter.createCaller(createGuestContext());
    const catalog = await caller.exponentialEngine.getFeatureCatalog();
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThanOrEqual(15);
    // Each item should have key, label, category, description, roles
    for (const item of catalog) {
      expect(item).toHaveProperty("key");
      expect(item).toHaveProperty("label");
      expect(item).toHaveProperty("category");
      expect(item).toHaveProperty("description");
      expect(item).toHaveProperty("roles");
    }
  });

  it("markChangelogRead requires authentication", async () => {
    const caller = appRouter.createCaller(createGuestContext());
    await expect(
      caller.exponentialEngine.markChangelogRead({ changelogId: 1 })
    ).rejects.toThrow();
  });

  it("markChangelogRead accepts valid input", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.exponentialEngine.markChangelogRead({
      changelogId: 1,
      via: "ai_chat",
    });
    expect(result).toEqual({ success: true });
  });

  it("addChangelog requires admin role", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.exponentialEngine.addChangelog({
        version: "99.0",
        title: "Test Feature",
        description: "A test changelog entry",
        changeType: "new_feature",
      })
    ).rejects.toThrow();
  });

  it("addChangelog works for admin users", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.exponentialEngine.addChangelog({
      version: "99.0",
      title: "Test Feature",
      description: "A test changelog entry",
      changeType: "new_feature",
      featureKeys: ["chat"],
      impactedRoles: ["user", "admin"],
    });
    expect(result).toEqual({ success: true });
  });
});

// ─── Proficiency Calculation Logic Tests ────────────────────────────────

describe("Exponential Engine — Proficiency Logic", () => {
  it("new user with no events has new_user proficiency", async () => {
    const mod = await import("./routers");
    const caller = mod.appRouter.createCaller(createAuthContext({ id: 9999 }));
    const result = await caller.exponentialEngine.getProficiency();
    expect(result.overallProficiency).toBe("new_user");
    expect(result.totalInteractions).toBe(0);
    expect(result.featuresExplored).toBe(0);
  });

  it("undiscovered features list matches catalog minus explored", async () => {
    const mod = await import("./routers");
    const caller = mod.appRouter.createCaller(createAuthContext({ id: 9998 }));
    const result = await caller.exponentialEngine.getProficiency();
    // For a fresh user, all accessible features should be undiscovered
    expect(result.undiscoveredFeatures.length).toBe(result.featuresTotal);
    expect(result.featuresExplored).toBe(0);
  });

  it("tracking events increases explored features count", async () => {
    const mod = await import("./routers");
    const userId = 9997;
    const caller = mod.appRouter.createCaller(createAuthContext({ id: userId }));

    // Track some events
    await caller.exponentialEngine.trackEvent({
      eventType: "page_visit",
      featureKey: "chat",
    });
    await caller.exponentialEngine.trackEvent({
      eventType: "page_visit",
      featureKey: "intelligence_hub",
    });

    // Check proficiency
    const result = await caller.exponentialEngine.getProficiency();
    expect(result.featuresExplored).toBeGreaterThanOrEqual(1);
    expect(result.totalInteractions).toBeGreaterThanOrEqual(1);
  });
});

// ─── Context Assembly Tests ─────────────────────────────────────────────

describe("Exponential Engine — Context Assembly", () => {
  it("assembleExponentialContext returns valid structure", async () => {
    const { assembleExponentialContext } = await import("./services/exponentialEngine");
    const ctx = await assembleExponentialContext(1, "user");
    expect(ctx).toHaveProperty("overallProficiency");
    expect(ctx).toHaveProperty("totalInteractions");
    expect(ctx).toHaveProperty("featuresExplored");
    expect(ctx).toHaveProperty("featuresTotal");
    expect(ctx).toHaveProperty("exploredFeatures");
    expect(ctx).toHaveProperty("undiscoveredFeatures");
    expect(ctx).toHaveProperty("recentActivity");
    expect(ctx).toHaveProperty("newUpdates");
    expect(ctx).toHaveProperty("promptFragment");
  });

  it("promptFragment contains exponential_engine tags", async () => {
    const { assembleExponentialContext } = await import("./services/exponentialEngine");
    const ctx = await assembleExponentialContext(1, "user");
    expect(ctx.promptFragment).toContain("<exponential_engine>");
    expect(ctx.promptFragment).toContain("</exponential_engine>");
  });

  it("promptFragment contains user proficiency info", async () => {
    const { assembleExponentialContext } = await import("./services/exponentialEngine");
    const ctx = await assembleExponentialContext(1, "user");
    expect(ctx.promptFragment).toContain("Overall proficiency:");
    expect(ctx.promptFragment).toContain("Role: user");
  });

  it("promptFragment mentions onboarding mode for new users", async () => {
    const { assembleExponentialContext } = await import("./services/exponentialEngine");
    // Use a user ID that likely has no events
    const ctx = await assembleExponentialContext(88888, "user");
    expect(ctx.promptFragment).toContain("Onboarding Mode:");
  });

  it("context includes undiscovered features for new users", async () => {
    const { assembleExponentialContext } = await import("./services/exponentialEngine");
    const ctx = await assembleExponentialContext(88888, "user");
    expect(ctx.undiscoveredFeatures.length).toBeGreaterThan(0);
    expect(ctx.promptFragment).toContain("Undiscovered Features");
  });

  it("admin role sees more features than user role", async () => {
    const { assembleExponentialContext } = await import("./services/exponentialEngine");
    const userCtx = await assembleExponentialContext(88888, "user");
    const adminCtx = await assembleExponentialContext(88888, "admin");
    expect(adminCtx.featuresTotal).toBeGreaterThanOrEqual(userCtx.featuresTotal);
  });

  it("context includes new platform updates", async () => {
    const { assembleExponentialContext } = await import("./services/exponentialEngine");
    // User 88888 shouldn't have any changelog awareness records
    const ctx = await assembleExponentialContext(88888, "user");
    expect(ctx.newUpdates.length).toBeGreaterThan(0);
  });
});
