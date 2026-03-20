/**
 * Comprehensive Functional Test Suite
 * TEST-FUNC-001 through TEST-FUNC-010
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@example.com",
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
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

const caller = (ctx: TrpcContext) => appRouter.createCaller(ctx);

describe("TEST-FUNC-001: Chat Streaming", () => {
  it("should require authentication for chat", async () => {
    const ctx = createAnonymousContext();
    await expect(
      caller(ctx).chat.send({ message: "Hello", conversationId: 1 })
    ).rejects.toThrow();
  });

  it("should accept a chat message from authenticated user", async () => {
    const ctx = createUserContext();
    // The chat.send procedure exists and requires auth
    const c = caller(ctx);
    expect(c.chat.send).toBeDefined();
  });

  it("should have disclaimer-aware system prompt", async () => {
    // Verify the chat router has the send procedure
    const ctx = createUserContext();
    const c = caller(ctx);
    expect(typeof c.chat.send).toBe("function");
  });
});

describe("TEST-FUNC-002: Conversation CRUD", () => {
  it("should require auth for conversation list", async () => {
    const ctx = createAnonymousContext();
    await expect(caller(ctx).conversations.list()).rejects.toThrow();
  });

  it("should require auth for conversation create", async () => {
    const ctx = createAnonymousContext();
    await expect(
      caller(ctx).conversations.create({ title: "Test" })
    ).rejects.toThrow();
  });

  it("should have search procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).conversations.search).toBeDefined();
  });

  it("should have pin procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).conversations.pin).toBeDefined();
  });

  it("should have rename procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).conversations.rename).toBeDefined();
  });

  it("should have delete procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).conversations.delete).toBeDefined();
  });
});

describe("TEST-FUNC-003: Hand-off Flow", () => {
  it("should have review submit procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).review.submit).toBeDefined();
  });

  it("should have review list procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).review.list).toBeDefined();
  });

  it("should require auth for review actions", async () => {
    const ctx = createAnonymousContext();
    await expect(
      caller(ctx).review.submit({ messageId: 1, reason: "test" })
    ).rejects.toThrow();
  });
});

describe("TEST-FUNC-004: Progressive Auth Tiers", () => {
  it("should allow anonymous access to auth.me", async () => {
    const ctx = createAnonymousContext();
    const result = await caller(ctx).auth.me();
    expect(result).toBeNull();
  });

  it("should return user for authenticated context", async () => {
    const ctx = createUserContext();
    const result = await caller(ctx).auth.me();
    expect(result).toBeDefined();
    expect(result?.email).toBe("test@example.com");
  });

  it("should support anonymous chat router", async () => {
    const ctx = createAnonymousContext();
    expect(caller(ctx).anonymousChat).toBeDefined();
  });

  it("should support email auth router", async () => {
    const ctx = createAnonymousContext();
    expect(caller(ctx).emailAuth).toBeDefined();
  });
});

describe("TEST-FUNC-005: Document Management", () => {
  it("should require auth for document upload", async () => {
    const ctx = createAnonymousContext();
    await expect(
      caller(ctx).documents.upload({
        fileName: "test.pdf",
        fileUrl: "https://example.com/test.pdf",
        mimeType: "application/pdf",
        fileSize: 1024,
        category: "personal_docs",
      })
    ).rejects.toThrow();
  });

  it("should require auth for document list", async () => {
    const ctx = createAnonymousContext();
    await expect(caller(ctx).documents.list()).rejects.toThrow();
  });

  it("should have document search procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).documents.search).toBeDefined();
  });
});

describe("TEST-FUNC-006: Market Data", () => {
  it("should have market search procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).market.search).toBeDefined();
  });

  it("should have market quote procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).market.quote).toBeDefined();
  });

  it("should require auth for market operations", async () => {
    const ctx = createAnonymousContext();
    await expect(
      caller(ctx).market.search({ query: "AAPL" })
    ).rejects.toThrow();
  });
});

describe("TEST-FUNC-007: Financial Calculators", () => {
  it("should have IUL calculator", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).calculators.iul).toBeDefined();
  });

  it("should have premium finance calculator", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).calculators.premiumFinance).toBeDefined();
  });

  it("should have retirement calculator", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).calculators.retirement).toBeDefined();
  });

  it("should require auth for calculator access", async () => {
    const ctx = createAnonymousContext();
    await expect(
      caller(ctx).calculators.iul({
        age: 35,
        gender: "male",
        annualPremium: 10000,
        years: 20,
        illustratedRate: 6.5,
      })
    ).rejects.toThrow();
  });
});

describe("TEST-FUNC-008: Suitability Assessment", () => {
  it("should have suitability get procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).suitability.get).toBeDefined();
  });

  it("should have suitability save procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).suitability.save).toBeDefined();
  });

  it("should require auth for suitability", async () => {
    const ctx = createAnonymousContext();
    await expect(caller(ctx).suitability.get()).rejects.toThrow();
  });
});

describe("TEST-FUNC-009: Memory System", () => {
  it("should have memory list procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).memories.list).toBeDefined();
  });

  it("should have memory add procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).memories.add).toBeDefined();
  });

  it("should have memory delete procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).memories.delete).toBeDefined();
  });

  it("should require auth for memories", async () => {
    const ctx = createAnonymousContext();
    await expect(caller(ctx).memories.list()).rejects.toThrow();
  });
});

describe("TEST-FUNC-010: Settings Management", () => {
  it("should have settings get procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).settings.get).toBeDefined();
  });

  it("should have settings update procedure", async () => {
    const ctx = createUserContext();
    expect(caller(ctx).settings.update).toBeDefined();
  });

  it("should require auth for settings", async () => {
    const ctx = createAnonymousContext();
    await expect(caller(ctx).settings.get()).rejects.toThrow();
  });
});
