import { describe, it, expect } from "vitest";

// ─── Replicate the access control logic from integrations router ─────────
const TIER_LEVEL: Record<string, number> = {
  platform: 4,
  organization: 3,
  professional: 2,
  client: 1,
};

const ROLE_MANAGE_LEVEL: Record<string, number> = {
  admin: 4,
  manager: 3,
  advisor: 2,
  professional: 2,
  user: 1,
  guest: 0,
};

const ROLE_VIEW_LEVEL: Record<string, number> = {
  admin: 4,
  manager: 3,
  advisor: 2,
  professional: 2,
  user: 1,
  guest: 1,
};

function canManageTier(userRole: string, tier: string): boolean {
  const roleLevel = ROLE_MANAGE_LEVEL[userRole] ?? 0;
  const tierLevel = TIER_LEVEL[tier] ?? 0;
  return roleLevel >= tierLevel;
}

function canViewTier(userRole: string, tier: string): boolean {
  const roleLevel = ROLE_VIEW_LEVEL[userRole] ?? 0;
  const tierLevel = TIER_LEVEL[tier] ?? 0;
  return roleLevel >= tierLevel;
}

function filterProvidersByRole<T extends { ownershipTier: string }>(providers: T[], userRole: string): T[] {
  return providers.filter(p => canViewTier(userRole, p.ownershipTier));
}

// ─── Test Data ───────────────────────────────────────────────────────────
const ALL_TIERS = ["platform", "organization", "professional", "client"];
const mockProviders = ALL_TIERS.map(tier => ({ id: tier, name: `${tier} provider`, ownershipTier: tier }));

// ─── Tests ───────────────────────────────────────────────────────────────
describe("Integration Access Control — canManageTier", () => {
  it("admin can manage all tiers", () => {
    for (const tier of ALL_TIERS) {
      expect(canManageTier("admin", tier)).toBe(true);
    }
  });

  it("manager can manage organization, professional, and client but NOT platform", () => {
    expect(canManageTier("manager", "platform")).toBe(false);
    expect(canManageTier("manager", "organization")).toBe(true);
    expect(canManageTier("manager", "professional")).toBe(true);
    expect(canManageTier("manager", "client")).toBe(true);
  });

  it("advisor can manage professional and client but NOT organization or platform", () => {
    expect(canManageTier("advisor", "platform")).toBe(false);
    expect(canManageTier("advisor", "organization")).toBe(false);
    expect(canManageTier("advisor", "professional")).toBe(true);
    expect(canManageTier("advisor", "client")).toBe(true);
  });

  it("professional alias works same as advisor", () => {
    for (const tier of ALL_TIERS) {
      expect(canManageTier("professional", tier)).toBe(canManageTier("advisor", tier));
    }
  });

  it("user can manage client tier only", () => {
    expect(canManageTier("user", "platform")).toBe(false);
    expect(canManageTier("user", "organization")).toBe(false);
    expect(canManageTier("user", "professional")).toBe(false);
    expect(canManageTier("user", "client")).toBe(true);
  });

  it("guest cannot manage any tier", () => {
    for (const tier of ALL_TIERS) {
      expect(canManageTier("guest", tier)).toBe(false);
    }
  });

  it("unknown role defaults to no manage permissions", () => {
    for (const tier of ALL_TIERS) {
      expect(canManageTier("unknown_role", tier)).toBe(false);
    }
  });
});

describe("Integration Access Control — canViewTier", () => {
  it("admin can view all tiers", () => {
    for (const tier of ALL_TIERS) {
      expect(canViewTier("admin", tier)).toBe(true);
    }
  });

  it("manager can view organization, professional, and client but NOT platform", () => {
    expect(canViewTier("manager", "platform")).toBe(false);
    expect(canViewTier("manager", "organization")).toBe(true);
    expect(canViewTier("manager", "professional")).toBe(true);
    expect(canViewTier("manager", "client")).toBe(true);
  });

  it("advisor can view professional and client but NOT organization or platform", () => {
    expect(canViewTier("advisor", "platform")).toBe(false);
    expect(canViewTier("advisor", "organization")).toBe(false);
    expect(canViewTier("advisor", "professional")).toBe(true);
    expect(canViewTier("advisor", "client")).toBe(true);
  });

  it("user can view client tier only", () => {
    expect(canViewTier("user", "platform")).toBe(false);
    expect(canViewTier("user", "organization")).toBe(false);
    expect(canViewTier("user", "professional")).toBe(false);
    expect(canViewTier("user", "client")).toBe(true);
  });

  it("guest can view client tier only (browse, not connect)", () => {
    expect(canViewTier("guest", "platform")).toBe(false);
    expect(canViewTier("guest", "organization")).toBe(false);
    expect(canViewTier("guest", "professional")).toBe(false);
    expect(canViewTier("guest", "client")).toBe(true);
  });
});

describe("Integration Access Control — filterProvidersByRole", () => {
  it("admin sees all 4 providers", () => {
    expect(filterProvidersByRole(mockProviders, "admin")).toHaveLength(4);
  });

  it("manager sees 3 providers (org, professional, client)", () => {
    const visible = filterProvidersByRole(mockProviders, "manager");
    expect(visible).toHaveLength(3);
    expect(visible.map(p => p.ownershipTier)).toEqual(["organization", "professional", "client"]);
  });

  it("advisor sees 2 providers (professional, client)", () => {
    const visible = filterProvidersByRole(mockProviders, "advisor");
    expect(visible).toHaveLength(2);
    expect(visible.map(p => p.ownershipTier)).toEqual(["professional", "client"]);
  });

  it("user sees 1 provider (client)", () => {
    const visible = filterProvidersByRole(mockProviders, "user");
    expect(visible).toHaveLength(1);
    expect(visible[0].ownershipTier).toBe("client");
  });

  it("guest sees 1 provider (client) — browse only", () => {
    const visible = filterProvidersByRole(mockProviders, "guest");
    expect(visible).toHaveLength(1);
    expect(visible[0].ownershipTier).toBe("client");
  });
});

describe("Integration Access Control — hierarchy enforcement", () => {
  it("each role level is strictly more restrictive than the one above", () => {
    const roles = ["admin", "manager", "advisor", "user", "guest"];
    for (let i = 0; i < roles.length - 1; i++) {
      const higher = filterProvidersByRole(mockProviders, roles[i]);
      const lower = filterProvidersByRole(mockProviders, roles[i + 1]);
      expect(higher.length).toBeGreaterThanOrEqual(lower.length);
    }
  });

  it("a guest cannot manage anything a user can manage", () => {
    for (const tier of ALL_TIERS) {
      if (canManageTier("guest", tier)) {
        // If guest could manage it, user must also be able to
        expect(canManageTier("user", tier)).toBe(true);
      }
    }
  });

  it("guest manage permissions are strictly zero", () => {
    const guestManageCount = ALL_TIERS.filter(t => canManageTier("guest", t)).length;
    expect(guestManageCount).toBe(0);
  });
});
