import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Audit tests for new routers:
 * - organizations (CRUD)
 * - relationships (user-to-user, org-to-org)
 * - emailAuth (sign-up, sign-in, profile, password)
 *
 * These tests verify the routers are properly wired and
 * reject unauthorized access appropriately.
 */

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-open-id",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "email",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as any,
  };
}

function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as any,
  };
}

// ─── ORGANIZATIONS ROUTER ─────────────────────────────────────────

describe("organizations router", () => {
  it("is registered in the appRouter", () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.organizations).toBeDefined();
    expect(caller.organizations.create).toBeDefined();
    expect(caller.organizations.list).toBeDefined();
    expect(caller.organizations.get).toBeDefined();
    expect(caller.organizations.getBySlug).toBeDefined();
    expect(caller.organizations.update).toBeDefined();
    expect(caller.organizations.delete).toBeDefined();
    expect(caller.organizations.listMembers).toBeDefined();
    expect(caller.organizations.inviteMember).toBeDefined();
    expect(caller.organizations.removeMember).toBeDefined();
  });

  it("rejects unauthenticated create", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.create({
        name: "Test Org",
        slug: "test-org",
      })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated list", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.organizations.list()).rejects.toThrow();
  });

  it("validates create input — empty name rejected", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.create({
        name: "",
        slug: "test-org",
      })
    ).rejects.toThrow();
  });

  it("validates create input — invalid slug rejected", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.create({
        name: "Test Org",
        slug: "INVALID SLUG!",
      })
    ).rejects.toThrow();
  });
});

// ─── RELATIONSHIPS ROUTER ─────────────────────────────────────────

describe("relationships router", () => {
  it("is registered in the appRouter", () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.relationships).toBeDefined();
    expect(caller.relationships.createUserRelationship).toBeDefined();
    expect(caller.relationships.listUserRelationships).toBeDefined();
    expect(caller.relationships.respondToUserRelationship).toBeDefined();
    expect(caller.relationships.removeUserRelationship).toBeDefined();
    expect(caller.relationships.createOrgRelationship).toBeDefined();
    expect(caller.relationships.listOrgRelationships).toBeDefined();
    expect(caller.relationships.respondToOrgRelationship).toBeDefined();
    expect(caller.relationships.removeOrgRelationship).toBeDefined();
  });

  it("rejects unauthenticated user relationship creation", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.relationships.createUserRelationship({
        relatedUserId: 2,
        relationshipType: "advisor",
      })
    ).rejects.toThrow();
  });

  it("rejects self-referencing user relationship", async () => {
    const ctx = createAuthContext({ id: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.relationships.createUserRelationship({
        relatedUserId: 1,
        relationshipType: "peer",
      })
    ).rejects.toThrow(/yourself/i);
  });

  it("rejects unauthenticated org relationship creation", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.relationships.createOrgRelationship({
        parentOrgId: 1,
        childOrgId: 2,
        relationshipType: "partner",
      })
    ).rejects.toThrow();
  });

  it("rejects self-referencing org relationship", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.relationships.createOrgRelationship({
        parentOrgId: 1,
        childOrgId: 1,
        relationshipType: "subsidiary",
      })
    ).rejects.toThrow(/itself/i);
  });
});

// ─── EMAIL AUTH ROUTER ────────────────────────────────────────────

describe("emailAuth router", () => {
  it("is registered in the appRouter", () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.emailAuth).toBeDefined();
    expect(caller.emailAuth.signUp).toBeDefined();
    expect(caller.emailAuth.signIn).toBeDefined();
    expect(caller.emailAuth.updatePassword).toBeDefined();
    expect(caller.emailAuth.updateProfile).toBeDefined();
    expect(caller.emailAuth.deleteAccount).toBeDefined();
  });

  it("validates sign-up — rejects short password", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.emailAuth.signUp({
        email: "new@example.com",
        password: "short",
        name: "New User",
      })
    ).rejects.toThrow();
  });

  it("validates sign-up — rejects invalid email", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.emailAuth.signUp({
        email: "not-an-email",
        password: "StrongPass1!",
        name: "New User",
      })
    ).rejects.toThrow();
  });

  it("validates sign-in — rejects empty email", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.emailAuth.signIn({
        email: "",
        password: "StrongPass1!",
      })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated password update", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.emailAuth.updatePassword({
        currentPassword: "OldPass1!",
        newPassword: "NewPass1!",
      })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated profile update", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.emailAuth.updateProfile({
        name: "Updated Name",
      })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated account deletion", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.emailAuth.deleteAccount({
        confirmEmail: "test@example.com",
      })
    ).rejects.toThrow();
  });
});
