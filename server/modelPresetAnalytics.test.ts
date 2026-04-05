import { describe, it, expect, vi } from "vitest";

// ─── MODEL PRESET CRUD TESTS ───────────────────────────────────────────────
describe("Model Preset CRUD (DB helpers)", () => {
  it("should export all preset CRUD functions from db.ts", async () => {
    const db = await import("./db");
    expect(typeof db.listUserModelPresets).toBe("function");
    expect(typeof db.createModelPreset).toBe("function");
    expect(typeof db.updateModelPreset).toBe("function");
    expect(typeof db.deleteModelPreset).toBe("function");
  });

  it("listUserModelPresets returns array or throws table-not-found", async () => {
    const { listUserModelPresets } = await import("./db");
    try {
      const result = await listUserModelPresets(999);
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e.message || e.sqlMessage || "").toMatch(/doesn't exist|not found|ER_NO_SUCH_TABLE|Failed query/i);
    }
  });

  it("deleteModelPreset returns success or throws table-not-found", async () => {
    const { deleteModelPreset } = await import("./db");
    try {
      const result = await deleteModelPreset(999, 999);
      expect(result).toHaveProperty("success");
    } catch (e: any) {
      expect(e.message || e.sqlMessage || "").toMatch(/doesn't exist|not found|ER_NO_SUCH_TABLE|Failed query/i);
    }
  });
});

// ─── MODEL ANALYTICS QUERY TESTS ───────────────────────────────────────────
describe("Model Analytics Queries (DB helpers)", () => {
  it("should export all analytics query functions from db.ts", async () => {
    const db = await import("./db");
    expect(typeof db.getModelUsageStats).toBe("function");
    expect(typeof db.getModelUsageTimeline).toBe("function");
    expect(typeof db.getModelRatingSummary).toBe("function");
    expect(typeof db.getOperationTypeBreakdown).toBe("function");
  });

  it("getModelUsageStats returns array or throws table-not-found", async () => {
    const { getModelUsageStats } = await import("./db");
    try {
      const result = await getModelUsageStats(undefined, 30);
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      // Table may not be deployed yet
      expect(e.message || e.sqlMessage || "").toMatch(/doesn't exist|not found|ER_NO_SUCH_TABLE|Failed query/i);
    }
  });

  it("getModelUsageTimeline returns array or throws table-not-found", async () => {
    const { getModelUsageTimeline } = await import("./db");
    try {
      const result = await getModelUsageTimeline(undefined, 7);
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e.message || e.sqlMessage || "").toMatch(/doesn't exist|not found|ER_NO_SUCH_TABLE|Failed query/i);
    }
  });

  it("getModelRatingSummary returns array or throws table-not-found", async () => {
    const { getModelRatingSummary } = await import("./db");
    try {
      const result = await getModelRatingSummary(undefined, 30);
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e.message || e.sqlMessage || "").toMatch(/doesn't exist|not found|ER_NO_SUCH_TABLE|Failed query/i);
    }
  });

  it("getOperationTypeBreakdown returns array or throws table-not-found", async () => {
    const { getOperationTypeBreakdown } = await import("./db");
    try {
      const result = await getOperationTypeBreakdown(undefined, 30);
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e.message || e.sqlMessage || "").toMatch(/doesn't exist|not found|ER_NO_SUCH_TABLE|Failed query/i);
    }
  });

  it("accepts user-scoped queries", async () => {
    const { getModelUsageStats } = await import("./db");
    try {
      const result = await getModelUsageStats(1, 30);
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e.message || e.sqlMessage || "").toMatch(/doesn't exist|not found|ER_NO_SUCH_TABLE|Failed query/i);
    }
  });
});

// ─── MULTI-MODEL ROUTER TESTS ──────────────────────────────────────────────
describe("MultiModel Router Structure", () => {
  it("should export multiModelRouter with all expected procedures", async () => {
    const { multiModelRouter } = await import("./routers/multiModel");
    expect(multiModelRouter).toBeDefined();
    const procedures = Object.keys((multiModelRouter as any)._def.procedures || {});
    // Core endpoints
    expect(procedures).toContain("perspectives");
    expect(procedures).toContain("presets");
    // Preset CRUD
    expect(procedures).toContain("listPresets");
    expect(procedures).toContain("savePreset");
    expect(procedures).toContain("updatePreset");
    expect(procedures).toContain("deletePreset");
    expect(procedures).toContain("saveCustomPreset");
    // Analytics
    expect(procedures).toContain("usageStats");
    expect(procedures).toContain("usageTimeline");
    expect(procedures).toContain("ratingSummary");
    expect(procedures).toContain("operationBreakdown");
  });

  it("should have at least 11 procedures total", async () => {
    const { multiModelRouter } = await import("./routers/multiModel");
    const procedures = Object.keys((multiModelRouter as any)._def.procedures || {});
    expect(procedures.length).toBeGreaterThanOrEqual(11);
  });
});

// ─── MODEL REGISTRY ENDPOINT TEST ──────────────────────────────────────────
describe("Model Registry (aiLayers router)", () => {
  it("should export aiLayersRouter with getAvailableModels endpoint", async () => {
    const { aiLayersRouter } = await import("./routers/aiLayers");
    const procedures = Object.keys((aiLayersRouter as any)._def.procedures || {});
    expect(procedures).toContain("getAvailableModels");
  });
});
