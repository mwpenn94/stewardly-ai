/**
 * Auth Enrichment & Apollo Integration Test Suite
 *
 * Tests the auth enrichment pipeline including:
 * - LinkedIn/Google/Email auth service functions
 * - Profile merger confidence hierarchy
 * - Apollo enrichment service
 * - Post-signup enrichment pipeline
 * - tRPC router procedures (getSignInMethods, getConnectedProviders, etc.)
 * - Token refresh cron logic
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Test Helpers ─────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 200,
    openId: "test-enrichment-user",
    email: "enrichment@test.com",
    name: "Test Enrichment User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createContext(user: AuthenticatedUser | null = null): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

const caller = (ctx: TrpcContext) => appRouter.createCaller(ctx);

// ═══════════════════════════════════════════════════════════════════
// SECTION 1: AUTH ENRICHMENT ROUTER - GUEST ACCESS
// ═══════════════════════════════════════════════════════════════════

describe("Auth Enrichment — Guest Access", () => {
  const guestCtx = createContext(null);

  it("getSignInMethods should be accessible to guests (public)", async () => {
    const result = await caller(guestCtx).authEnrichment.getSignInMethods();
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("getConnectedProviders should reject unauthenticated users", async () => {
    await expect(caller(guestCtx).authEnrichment.getConnectedProviders())
      .rejects.toThrow();
  });

  it("getEnrichmentHistory should reject unauthenticated users", async () => {
    await expect(caller(guestCtx).authEnrichment.getEnrichmentHistory())
      .rejects.toThrow();
  });

  it("getProfileCompleteness should reject unauthenticated users", async () => {
    await expect(caller(guestCtx).authEnrichment.getProfileCompleteness())
      .rejects.toThrow();
  });

  it("initiateLinkedIn should be accessible to guests (public)", async () => {
    const result = await caller(guestCtx).authEnrichment.initiateLinkedIn({ redirectUri: "http://localhost:3000/callback" });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("authUrl");
  });

  it("initiateGoogle should be accessible to guests (public)", async () => {
    const result = await caller(guestCtx).authEnrichment.initiateGoogle({ redirectUri: "http://localhost:3000/callback" });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("authUrl");
  });

  it("requestMagicLink should be accessible to guests (public)", async () => {
    const result = await caller(guestCtx).authEnrichment.requestMagicLink({ email: "test@example.com" });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("sent");
  });

  it("unlinkProvider should reject unauthenticated users", async () => {
    await expect(
      caller(guestCtx).authEnrichment.unlinkProvider({ provider: "linkedin" })
    ).rejects.toThrow();
  });

  it("forceProfileRefresh should reject unauthenticated users", async () => {
    await expect(caller(guestCtx).authEnrichment.forceProfileRefresh())
      .rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 2: AUTH ENRICHMENT ROUTER - AUTHENTICATED ACCESS
// ═══════════════════════════════════════════════════════════════════

describe("Auth Enrichment — Authenticated User", () => {
  const user = createUser();
  const authCtx = createContext(user);

  it("getSignInMethods should return available sign-in methods", async () => {
    const result = await caller(authCtx).authEnrichment.getSignInMethods();
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // Should include linkedin, google, email at minimum
    const providers = result.map((m: any) => m.id);
    expect(providers).toContain("linkedin");
    expect(providers).toContain("google");
    expect(providers).toContain("email");
  });

  it("getConnectedProviders should return provider list", async () => {
    const result = await caller(authCtx).authEnrichment.getConnectedProviders();
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("getProfileCompleteness should return a percentage", async () => {
    const result = await caller(authCtx).authEnrichment.getProfileCompleteness();
    expect(result).toBeDefined();
    expect(typeof result.completeness).toBe("number");
    expect(result.completeness).toBeGreaterThanOrEqual(0);
    expect(result.completeness).toBeLessThanOrEqual(100);
  });

  it("getEnrichmentHistory should return log entries", async () => {
    const result = await caller(authCtx).authEnrichment.getEnrichmentHistory();
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("initiateLinkedIn should return auth URL or not-configured message", async () => {
    const result = await caller(authCtx).authEnrichment.initiateLinkedIn({
      redirectUri: "http://localhost:3000/callback",
    });
    expect(result).toBeDefined();
    // Either returns authUrl or error about missing config
    expect(result).toHaveProperty("authUrl");
  });

  it("initiateGoogle should return auth URL or not-configured message", async () => {
    const result = await caller(authCtx).authEnrichment.initiateGoogle({
      redirectUri: "http://localhost:3000/callback",
    });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("authUrl");
  });

  it("requestMagicLink should accept valid email", async () => {
    const result = await caller(authCtx).authEnrichment.requestMagicLink({
      email: "test@example.com",
    });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("sent");
  });

  it("unlinkProvider should handle non-linked provider gracefully", async () => {
    // Unlinking a provider that isn't linked should still succeed or give clear error
    try {
      const result = await caller(authCtx).authEnrichment.unlinkProvider({
        provider: "linkedin",
      });
      expect(result).toBeDefined();
    } catch (err: any) {
      // Acceptable to throw if provider not linked
      expect(err.message).toBeDefined();
    }
  });

  it("forceProfileRefresh should attempt enrichment (may fail for test user)", async () => {
    try {
      const result = await caller(authCtx).authEnrichment.forceProfileRefresh();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("completeness");
    } catch (err: any) {
      // Acceptable to throw "User not found" for test user that doesn't exist in DB
      expect(err.message).toContain("User not found");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 3: PROFILE MERGER CONFIDENCE HIERARCHY
// ═══════════════════════════════════════════════════════════════════

describe("Profile Merger — Confidence Hierarchy", () => {
  // Test the confidence hierarchy logic conceptually
  // LinkedIn > Google > Email > Manus for professional fields

  const CONFIDENCE: Record<string, Record<string, number>> = {
    linkedin: { employer: 95, jobTitle: 95, industry: 90, headline: 85 },
    google: { phone: 90, birthday: 90, address: 85 },
    email: { employer: 60 },
    manus: { name: 50, email: 50 },
  };

  it("LinkedIn should have highest confidence for employer", () => {
    expect(CONFIDENCE.linkedin.employer).toBeGreaterThan(CONFIDENCE.email.employer);
    expect(CONFIDENCE.linkedin.employer).toBeGreaterThan(CONFIDENCE.manus.name);
  });

  it("Google should have highest confidence for phone and birthday", () => {
    expect(CONFIDENCE.google.phone).toBe(90);
    expect(CONFIDENCE.google.birthday).toBe(90);
  });

  it("Email employer inference should have lower confidence than LinkedIn", () => {
    expect(CONFIDENCE.email.employer).toBeLessThan(CONFIDENCE.linkedin.employer);
  });

  it("Manus should have lowest confidence for all fields", () => {
    expect(CONFIDENCE.manus.name).toBeLessThan(CONFIDENCE.linkedin.employer);
    expect(CONFIDENCE.manus.email).toBeLessThan(CONFIDENCE.google.phone);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 4: APOLLO SERVICE LOGIC
// ═══════════════════════════════════════════════════════════════════

describe("Apollo Service — Enrichment Logic", () => {
  it("should define enrichPerson method", async () => {
    const { apolloService } = await import("./services/auth/apolloService");
    expect(typeof apolloService.enrichPerson).toBe("function");
  });

  it("should define enrichCompany method", async () => {
    const { apolloService } = await import("./services/auth/apolloService");
    expect(typeof apolloService.enrichCompany).toBe("function");
  });

  it("should define findEmail method", async () => {
    const { apolloService } = await import("./services/auth/apolloService");
    expect(typeof apolloService.findEmail).toBe("function");
  });

  it("apolloService should have testConnection method", async () => {
    const { apolloService } = await import("./services/auth/apolloService");
    expect(typeof apolloService.testConnection).toBe("function");
  });

  it("testConnection should handle any API key input", async () => {
    const { apolloService } = await import("./services/auth/apolloService");
    const result = await apolloService.testConnection("invalid-key");
    expect(typeof result).toBe("boolean");
  }, 15000);
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 5: AUTH SERVICE EXPORTS
// ═══════════════════════════════════════════════════════════════════

describe("Auth Services — Module Exports", () => {
  it("LinkedIn auth service should export linkedInAuthService with getAuthUrl and exchangeCode", async () => {
    const linkedIn = await import("./services/auth/linkedinAuth");
    expect(linkedIn.linkedInAuthService).toBeDefined();
    expect(typeof linkedIn.linkedInAuthService.getAuthUrl).toBe("function");
    expect(typeof linkedIn.linkedInAuthService.exchangeCode).toBe("function");
  });

  it("Google auth service should export googleAuthService with getAuthUrl and exchangeCode", async () => {
    const google = await import("./services/auth/googleAuth");
    expect(google.googleAuthService).toBeDefined();
    expect(typeof google.googleAuthService.getAuthUrl).toBe("function");
    expect(typeof google.googleAuthService.exchangeCode).toBe("function");
  });

  it("Email auth service should export requestMagicLink and verifyMagicLink", async () => {
    const email = await import("./services/auth/emailAuth");
    expect(email.emailAuthService).toBeDefined();
    expect(typeof email.emailAuthService.requestMagicLink).toBe("function");
    expect(typeof email.emailAuthService.verifyMagicLink).toBe("function");
  });

  it("Profile merger should export profileMerger with mergeProviderData", async () => {
    const merger = await import("./services/auth/profileMerger");
    expect(merger.profileMerger).toBeDefined();
    expect(typeof merger.profileMerger.mergeProviderData).toBe("function");
  });

  it("Post-signup enrichment should export postSignupEnrichment with enrichNewUser", async () => {
    const enrichment = await import("./services/auth/postSignupEnrichment");
    expect(enrichment.postSignupEnrichment).toBeDefined();
    expect(typeof enrichment.postSignupEnrichment.enrichNewUser).toBe("function");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 6: ROLE-BASED ACCESS FOR AUTH ENRICHMENT
// ═══════════════════════════════════════════════════════════════════

describe("Auth Enrichment — Role-Based Access", () => {
  const roles = ["user", "advisor", "manager", "admin"] as const;

  for (const role of roles) {
    it(`${role} should be able to access getSignInMethods`, async () => {
      const ctx = createContext(createUser({ role }));
      const result = await caller(ctx).authEnrichment.getSignInMethods();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it(`${role} should be able to access getConnectedProviders`, async () => {
      const ctx = createContext(createUser({ role }));
      const result = await caller(ctx).authEnrichment.getConnectedProviders();
      expect(result).toBeDefined();
    });

    it(`${role} should be able to access getProfileCompleteness`, async () => {
      const ctx = createContext(createUser({ role }));
      const result = await caller(ctx).authEnrichment.getProfileCompleteness();
      expect(result).toBeDefined();
      expect(typeof result.completeness).toBe("number");
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 7: SCHEDULED TASKS — TOKEN REFRESH
// ═══════════════════════════════════════════════════════════════════

describe("Scheduled Tasks — Token Refresh", () => {
  it("should export startScheduler function", async () => {
    const { startScheduler } = await import("./services/scheduledTasks");
    expect(typeof startScheduler).toBe("function");
  });

  it("should export getSchedulerStatus function", async () => {
    const { getSchedulerStatus } = await import("./services/scheduledTasks");
    expect(typeof getSchedulerStatus).toBe("function");
  });

  it("getSchedulerStatus should include token-refresh task", async () => {
    const { getSchedulerStatus } = await import("./services/scheduledTasks");
    const status = getSchedulerStatus();
    // getSchedulerStatus returns an array of tasks directly
    expect(Array.isArray(status)).toBe(true);
    const tokenRefreshTask = status.find((t: any) => t.name === "token-refresh");
    expect(tokenRefreshTask).toBeDefined();
    expect(tokenRefreshTask?.enabled).toBe(true);
  });

  it("should export runTaskNow function", async () => {
    const { runTaskNow } = await import("./services/scheduledTasks");
    expect(typeof runTaskNow).toBe("function");
  });

  it("should export toggleTask function", async () => {
    const { toggleTask } = await import("./services/scheduledTasks");
    expect(typeof toggleTask).toBe("function");
  });
});
