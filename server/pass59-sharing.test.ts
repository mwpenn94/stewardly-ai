import { describe, it, expect } from "vitest";
import { FEATURE_REGISTRY } from "./services/featurePermissions";

// ─── Feature Registry Tests ──────────────────────────────────────────────
describe("Feature Registry", () => {
  it("contains all expected feature categories", () => {
    const categories = new Set(Object.values(FEATURE_REGISTRY).map((f) => f.category));
    expect(categories.has("person")).toBe(true);
    expect(categories.has("client")).toBe(true);
    expect(categories.has("advisor")).toBe(true);
    expect(categories.has("manager")).toBe(true);
    expect(categories.has("steward")).toBe(true);
  });

  it("has valid disclosure levels (1-4) for all features", () => {
    for (const [key, feature] of Object.entries(FEATURE_REGISTRY)) {
      expect(feature.defaultDisclosure).toBeGreaterThanOrEqual(1);
      expect(feature.defaultDisclosure).toBeLessThanOrEqual(4);
      expect(feature.label).toBeTruthy();
    }
  });

  it("has at least 20 registered features", () => {
    expect(Object.keys(FEATURE_REGISTRY).length).toBeGreaterThanOrEqual(20);
  });

  it("person layer features have disclosure levels 1-2", () => {
    const personFeatures = Object.entries(FEATURE_REGISTRY).filter(([_, f]) => f.category === "person");
    for (const [key, feature] of personFeatures) {
      expect(feature.defaultDisclosure).toBeLessThanOrEqual(2);
    }
  });

  it("steward layer features have disclosure levels 2-4", () => {
    const stewardFeatures = Object.entries(FEATURE_REGISTRY).filter(([_, f]) => f.category === "steward");
    for (const [key, feature] of stewardFeatures) {
      expect(feature.defaultDisclosure).toBeGreaterThanOrEqual(2);
    }
  });

  it("all features have unique labels", () => {
    const labels = Object.values(FEATURE_REGISTRY).map((f) => f.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });
});

// ─── ShareKit Component Tests ──────────────────────────────────────────────
describe("ShareKit Components", () => {
  it("ShareKit module exports required components", async () => {
    const mod = await import("../client/src/components/sharing/ShareKit");
    expect(mod.ShareButton).toBeDefined();
    expect(mod.PermissionSelector).toBeDefined();
    expect(mod.RecipientPicker).toBeDefined();
  });
});

// ─── Sharing Router Tests ──────────────────────────────────────────────────
describe("Sharing Router", () => {
  it("sharing router module exports correctly", async () => {
    const mod = await import("./routers/sharing");
    expect(mod.sharingRouter).toBeDefined();
  });
});

// ─── Feature Permissions Service Tests ──────────────────────────────────────
describe("Feature Permissions Service", () => {
  it("exports all required functions", async () => {
    const mod = await import("./services/featurePermissions");
    expect(mod.resolveFeaturePermission).toBeDefined();
    expect(mod.resolveAllFeaturePermissions).toBeDefined();
    expect(mod.setFeaturePermission).toBeDefined();
    expect(mod.createContentShare).toBeDefined();
    expect(mod.getContentShares).toBeDefined();
    expect(mod.revokeContentShare).toBeDefined();
    expect(mod.checkContentAccess).toBeDefined();
    expect(mod.FEATURE_REGISTRY).toBeDefined();
  });

  it("FEATURE_REGISTRY covers all persona layers", () => {
    const categories = Object.values(FEATURE_REGISTRY).map((f) => f.category);
    expect(categories).toContain("person");
    expect(categories).toContain("client");
    expect(categories).toContain("advisor");
    expect(categories).toContain("manager");
    expect(categories).toContain("steward");
  });

  it("all features have defaultEnabled as boolean", () => {
    for (const [key, feature] of Object.entries(FEATURE_REGISTRY)) {
      expect(typeof feature.defaultEnabled).toBe("boolean");
    }
  });
});

// ─── Permission Level Hierarchy Tests ──────────────────────────────────────
describe("Permission Level Hierarchy", () => {
  const levels = ["view", "comment", "edit", "admin"];

  it("permission levels are ordered correctly", () => {
    expect(levels.indexOf("view")).toBeLessThan(levels.indexOf("comment"));
    expect(levels.indexOf("comment")).toBeLessThan(levels.indexOf("edit"));
    expect(levels.indexOf("edit")).toBeLessThan(levels.indexOf("admin"));
  });

  it("admin is the highest permission level", () => {
    expect(levels[levels.length - 1]).toBe("admin");
  });

  it("view is the lowest permission level", () => {
    expect(levels[0]).toBe("view");
  });
});

// ─── Database Schema Tests ──────────────────────────────────────────────────
describe("Sharing Database Schema", () => {
  it("schema exports sharing-related tables", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.featurePermissions).toBeDefined();
    expect(schema.permissionAuditLog).toBeDefined();
    expect(schema.contentShares).toBeDefined();
    expect(schema.viewShares).toBeDefined();
  });
});
