import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-portal-user",
    email: "advisor@example.com",
    name: "Test Advisor",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("portal router", () => {
  // ─── STATS ────────────────────────────────────────────────────
  describe("portal.stats", () => {
    it("returns stats for admin user", async () => {
      const ctx = createContext({ role: "admin" });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.portal.stats();
      expect(result).toHaveProperty("totalClients");
      expect(result).toHaveProperty("activeClients");
      expect(result).toHaveProperty("teamSize");
      expect(result).toHaveProperty("orgs");
      expect(typeof result.totalClients).toBe("number");
      expect(typeof result.activeClients).toBe("number");
    });

    it("returns stats for advisor user", async () => {
      const ctx = createContext({ role: "advisor" });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.portal.stats();
      expect(result).toHaveProperty("totalClients");
      expect(result).toHaveProperty("activeClients");
    });

    it("rejects regular user from stats", async () => {
      const ctx = createContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.portal.stats()).rejects.toThrow(/advisor/i);
    });

    it("rejects unauthenticated user from stats", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.portal.stats()).rejects.toThrow();
    });
  });

  // ─── CLIENT BOOK ──────────────────────────────────────────────
  describe("portal.clientBook", () => {
    it("returns client book for admin", async () => {
      const ctx = createContext({ role: "admin" });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.portal.clientBook();
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns client book for advisor", async () => {
      const ctx = createContext({ role: "advisor" });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.portal.clientBook();
      expect(Array.isArray(result)).toBe(true);
    });

    it("rejects regular user from client book", async () => {
      const ctx = createContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.portal.clientBook()).rejects.toThrow(/advisor/i);
    });
  });

  // ─── TEAM MEMBERS ────────────────────────────────────────────
  describe("portal.teamMembers", () => {
    it("returns team members for manager", async () => {
      const ctx = createContext({ role: "manager" });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.portal.teamMembers();
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns team members for admin", async () => {
      const ctx = createContext({ role: "admin" });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.portal.teamMembers();
      expect(Array.isArray(result)).toBe(true);
    });

    it("rejects advisor from team members", async () => {
      const ctx = createContext({ role: "advisor" });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.portal.teamMembers()).rejects.toThrow(/manager/i);
    });
  });

  // ─── MY ORGANIZATIONS ────────────────────────────────────────
  describe("portal.myOrganizations", () => {
    it("returns organizations for advisor", async () => {
      const ctx = createContext({ role: "advisor" });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.portal.myOrganizations();
      expect(Array.isArray(result)).toBe(true);
    });

    it("rejects regular user from organizations", async () => {
      const ctx = createContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.portal.myOrganizations()).rejects.toThrow(/advisor/i);
    });
  });

  // ─── VIEW-AS ──────────────────────────────────────────────────
  describe("portal.viewAsStart", () => {
    it("rejects view-as self", async () => {
      const ctx = createContext({ id: 1, role: "admin" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.portal.viewAsStart({ targetUserId: 1 })
      ).rejects.toThrow(/yourself/i);
    });

    it("rejects regular user from view-as", async () => {
      const ctx = createContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.portal.viewAsStart({ targetUserId: 999 })
      ).rejects.toThrow(/advisor/i);
    });
  });

  // ─── VIEW-AS AUDIT ────────────────────────────────────────────
  describe("portal.viewAsAudit", () => {
    it("returns audit log for manager", async () => {
      const ctx = createContext({ role: "manager" });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.portal.viewAsAudit();
      expect(Array.isArray(result)).toBe(true);
    });

    it("rejects advisor from audit log", async () => {
      const ctx = createContext({ role: "advisor" });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.portal.viewAsAudit()).rejects.toThrow(/manager/i);
    });
  });

  // ─── SEARCH USERS ────────────────────────────────────────────
  describe("portal.searchUsers", () => {
    it("searches users for advisor", async () => {
      const ctx = createContext({ role: "advisor" });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.portal.searchUsers({ query: "test" });
      expect(Array.isArray(result)).toBe(true);
    });

    it("rejects regular user from search", async () => {
      const ctx = createContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.portal.searchUsers({ query: "test" })
      ).rejects.toThrow(/advisor/i);
    });
  });

  // ─── ADD/REMOVE CLIENT ───────────────────────────────────────
  describe("portal.addClient", () => {
    it("rejects regular user from adding clients", async () => {
      const ctx = createContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.portal.addClient({ clientId: 999 })
      ).rejects.toThrow(/advisor/i);
    });
  });

  describe("portal.removeClient", () => {
    it("rejects regular user from removing clients", async () => {
      const ctx = createContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.portal.removeClient({ associationId: 999 })
      ).rejects.toThrow(/advisor/i);
    });
  });
});
