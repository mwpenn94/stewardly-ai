/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @platform/config — Test Suite
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveAIConfig,
  buildLayerOverlayPrompt,
  validateInheritance,
  DEFAULT_CONFIG,
} from "../aiConfigResolver";
import type { ConfigStore, LayerSettings } from "../aiConfigResolver";
import {
  createLayerHandlers,
  createAllLayerHandlers,
  hasMinRole,
} from "../aiLayersRouter";
import type { LayerStore, AuthContext } from "../aiLayersRouter";
import type { ResolvedAIConfig, LayerLevel } from "../types";
import { LAYER_NAMES, FIELD_MERGE_STRATEGIES } from "../types";

// ─── MOCK CONFIG STORE ───────────────────────────────────────────────────────

function createMockStore(layers: LayerSettings[]): ConfigStore {
  return {
    getLayerSettings: vi.fn(async () => layers),
  };
}

// ─── RESOLVE AI CONFIG ──────────────────────────────────────────────────────

describe("resolveAIConfig", () => {
  it("should return defaults when no layers have settings", async () => {
    const store = createMockStore([
      { layer: 1, name: "Platform", settings: null },
      { layer: 2, name: "Organization", settings: null },
      { layer: 3, name: "Manager", settings: null },
      { layer: 4, name: "Professional", settings: null },
      { layer: 5, name: "User", settings: null },
    ]);

    const config = await resolveAIConfig(store, 1);

    expect(config.toneStyle).toBe("professional");
    expect(config.temperature).toBe(0.7);
    expect(config.maxTokens).toBe(4096);
    expect(config.guardrails).toEqual([]);
    expect(config.promptOverlays).toEqual([]);
  });

  it("should APPEND prompt overlays from all layers", async () => {
    const store = createMockStore([
      { layer: 1, name: "Platform", settings: { baseSystemPrompt: "Platform context" } },
      { layer: 2, name: "Organization", settings: { promptOverlay: "Org context" } },
      { layer: 5, name: "User", settings: null },
    ]);

    const config = await resolveAIConfig(store, 1);

    expect(config.promptOverlays).toHaveLength(2);
    expect(config.promptOverlays[0]).toEqual({ layer: "Platform", content: "Platform context" });
    expect(config.promptOverlays[1]).toEqual({ layer: "Organization", content: "Org context" });
  });

  it("should OVERRIDE scalar fields (lower layer wins)", async () => {
    const store = createMockStore([
      { layer: 1, name: "Platform", settings: { defaultTone: "formal", temperatureDefault: 0.3 } },
      { layer: 5, name: "User", settings: { toneStyle: "casual", temperature: 0.9 } },
    ]);

    const config = await resolveAIConfig(store, 1);

    // User (L5) overrides Platform (L1)
    expect(config.toneStyle).toBe("casual");
    expect(config.temperature).toBe(0.9);
  });

  it("should UNION guardrails and prohibited topics", async () => {
    const store = createMockStore([
      { layer: 1, name: "Platform", settings: { globalGuardrails: ["no_medical_advice"], prohibitedTopics: ["politics"] } },
      { layer: 2, name: "Organization", settings: { guardrails: ["no_legal_advice"], prohibitedTopics: ["religion"] } },
    ]);

    const config = await resolveAIConfig(store, 1);

    expect(config.guardrails).toContain("no_medical_advice");
    expect(config.guardrails).toContain("no_legal_advice");
    expect(config.prohibitedTopics).toContain("politics");
    expect(config.prohibitedTopics).toContain("religion");
  });

  it("should INTERSECT approved product categories", async () => {
    const store = createMockStore([
      { layer: 1, name: "Platform", settings: { approvedProductCategories: ["stocks", "bonds", "crypto", "insurance"] } },
      { layer: 2, name: "Organization", settings: { approvedProductCategories: ["stocks", "bonds", "insurance"] } },
    ]);

    const config = await resolveAIConfig(store, 1);

    expect(config.approvedProductCategories).toEqual(["stocks", "bonds", "insurance"]);
    expect(config.approvedProductCategories).not.toContain("crypto");
  });

  it("should include AMP phase defaults", async () => {
    const config = await resolveAIConfig(createMockStore([]), 1);

    expect(config.ampPhaseDefaults.orientation.enabled).toBe(true);
    expect(config.ampPhaseDefaults.orientation.tierSelection).toBe("fast");
    expect(config.ampPhaseDefaults.foundation.timeTargetMinutes).toBe(20);
    expect(config.ampPhaseDefaults.independentApplication.tierSelection).toBe("deep");
  });

  it("should merge AMP phase overrides from layers", async () => {
    const store = createMockStore([
      {
        layer: 2,
        name: "Organization",
        settings: {
          ampPhaseDefaults: {
            orientation: { timeTargetMinutes: 5, tierSelection: "balanced" },
          },
        },
      },
    ]);

    const config = await resolveAIConfig(store, 1);

    expect(config.ampPhaseDefaults.orientation.timeTargetMinutes).toBe(5);
    expect(config.ampPhaseDefaults.orientation.tierSelection).toBe("balanced");
    // Other phases should retain defaults
    expect(config.ampPhaseDefaults.foundation.timeTargetMinutes).toBe(20);
  });

  it("should include Human Output dimensions", async () => {
    const config = await resolveAIConfig(createMockStore([]), 1);

    expect(config.humanOutputDimensions.criticalThinking.tracked).toBe(true);
    expect(config.humanOutputDimensions.criticalThinking.targetScore).toBe(0.7);
    expect(config.humanOutputDimensions.physicalHealth.coachingFrequency).toBe("monthly");
  });

  it("should merge Human Output dimension overrides", async () => {
    const store = createMockStore([
      {
        layer: 3,
        name: "Manager",
        settings: {
          humanOutputDimensions: {
            financialAcumen: { targetScore: 0.9, coachingFrequency: "every_session" },
          },
        },
      },
    ]);

    const config = await resolveAIConfig(store, 1);

    expect(config.humanOutputDimensions.financialAcumen.targetScore).toBe(0.9);
    expect(config.humanOutputDimensions.financialAcumen.coachingFrequency).toBe("every_session");
    // Other domains retain defaults
    expect(config.humanOutputDimensions.criticalThinking.targetScore).toBe(0.7);
  });

  it("should include autonomy policy", async () => {
    const config = await resolveAIConfig(createMockStore([]), 1);

    expect(config.autonomyPolicy.autonomyThreshold).toBe(0.85);
    expect(config.autonomyPolicy.auditAutonomousDecisions).toBe(true);
    expect(config.autonomyPolicy.escalationPolicy).toBe("notify");
  });

  it("should merge autonomy policy overrides and UNION requireApprovalCategories", async () => {
    const store = createMockStore([
      {
        layer: 1,
        name: "Platform",
        settings: {
          autonomyPolicy: {
            autonomyThreshold: 0.9,
            requireApprovalCategories: ["data_export"],
          },
        },
      },
    ]);

    const config = await resolveAIConfig(store, 1);

    expect(config.autonomyPolicy.autonomyThreshold).toBe(0.9);
    // Should union with defaults
    expect(config.autonomyPolicy.requireApprovalCategories).toContain("data_export");
    expect(config.autonomyPolicy.requireApprovalCategories).toContain("financial_transaction");
  });

  it("should track layer sources for transparency", async () => {
    const store = createMockStore([
      { layer: 1, name: "Platform", settings: { defaultTone: "formal" } },
      { layer: 2, name: "Organization", settings: null },
    ]);

    const config = await resolveAIConfig(store, 1);

    expect(config.layerSources).toHaveLength(2);
    expect(config.layerSources[0]).toEqual({ layer: 1, name: "Platform", hasConfig: true });
    expect(config.layerSources[1]).toEqual({ layer: 2, name: "Organization", hasConfig: false });
  });
});

// ─── PROMPT BUILDER ──────────────────────────────────────────────────────────

describe("buildLayerOverlayPrompt", () => {
  it("should build overlay prompt from all layers", () => {
    const config = {
      ...DEFAULT_CONFIG,
      promptOverlays: [
        { layer: "Platform", content: "Be professional" },
        { layer: "Organization", content: "Focus on compliance" },
      ],
    };

    const prompt = buildLayerOverlayPrompt(config);

    expect(prompt).toContain("[Platform]: Be professional");
    expect(prompt).toContain("[Organization]: Focus on compliance");
  });

  it("should include response_style even when no overlays", () => {
    const prompt = buildLayerOverlayPrompt(DEFAULT_CONFIG);
    // The full implementation always generates response_style and ai_tuning blocks
    expect(prompt).toContain("<response_style>");
    expect(prompt).toContain("Tone: professional");
    // Should NOT contain layer_overlays when promptOverlays is empty
    expect(prompt).not.toContain("<layer_overlays>");
  });
});

// ─── VALIDATION ──────────────────────────────────────────────────────────────

describe("validateInheritance", () => {
  it("should warn about low autonomy threshold", () => {
    const config = {
      ...DEFAULT_CONFIG,
      autonomyPolicy: { ...DEFAULT_CONFIG.autonomyPolicy, autonomyThreshold: 0.3 },
    };

    const warnings = validateInheritance(config);
    expect(warnings.some((w) => w.includes("unusually permissive"))).toBe(true);
  });

  it("should warn about disabled AMP phases with zero time targets", () => {
    const config = {
      ...DEFAULT_CONFIG,
      ampPhaseDefaults: {
        ...DEFAULT_CONFIG.ampPhaseDefaults,
        orientation: { enabled: true, timeTargetMinutes: 0, tierSelection: "fast" as const },
      },
    };

    const warnings = validateInheritance(config);
    expect(warnings.some((w) => w.includes("orientation"))).toBe(true);
  });

  it("should return no warnings for valid default config", () => {
    const warnings = validateInheritance(DEFAULT_CONFIG);
    expect(warnings).toEqual([]);
  });
});

// ─── ROLE HIERARCHY ──────────────────────────────────────────────────────────

describe("hasMinRole", () => {
  it("should correctly check role hierarchy", () => {
    expect(hasMinRole("global_admin", "global_admin")).toBe(true);
    expect(hasMinRole("org_admin", "manager")).toBe(true);
    expect(hasMinRole("manager", "org_admin")).toBe(false);
    expect(hasMinRole("user", "professional")).toBe(false);
    expect(hasMinRole("professional", "user")).toBe(true);
    expect(hasMinRole(null, "user")).toBe(true);
    expect(hasMinRole(null, "professional")).toBe(false);
  });
});

// ─── LAYER NAMES & MERGE STRATEGIES ─────────────────────────────────────────

describe("constants", () => {
  it("should have all 5 layer names", () => {
    expect(LAYER_NAMES[1]).toBe("Platform");
    expect(LAYER_NAMES[2]).toBe("Organization");
    expect(LAYER_NAMES[3]).toBe("Manager");
    expect(LAYER_NAMES[4]).toBe("Professional");
    expect(LAYER_NAMES[5]).toBe("User");
  });

  it("should have merge strategies for key fields", () => {
    expect(FIELD_MERGE_STRATEGIES.promptOverlays).toBe("append");
    expect(FIELD_MERGE_STRATEGIES.guardrails).toBe("union");
    expect(FIELD_MERGE_STRATEGIES.approvedProductCategories).toBe("intersect");
    expect(FIELD_MERGE_STRATEGIES.toneStyle).toBe("override");
    expect(FIELD_MERGE_STRATEGIES.ampPhaseDefaults).toBe("override");
    expect(FIELD_MERGE_STRATEGIES.humanOutputDimensions).toBe("override");
    expect(FIELD_MERGE_STRATEGIES.autonomyPolicy).toBe("override");
  });
});

// ─── LAYER HANDLERS ──────────────────────────────────────────────────────────

describe("createLayerHandlers", () => {
  const mockLayerStore: LayerStore = {
    getLayerSettings: vi.fn(async () => []),
    getLayerConfig: vi.fn(async () => ({ toneStyle: "formal" })),
    upsertLayerConfig: vi.fn(async () => {}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should enforce global_admin for layer 1", async () => {
    const handlers = createLayerHandlers(mockLayerStore, 1, "global_admin");

    await expect(
      handlers.getSettings({ userId: 1, isGlobalAdmin: false }, 1),
    ).rejects.toThrow("Global admin required");

    const result = await handlers.getSettings({ userId: 1, isGlobalAdmin: true }, 1);
    expect(result).toEqual({ toneStyle: "formal" });
  });

  it("should enforce role hierarchy for layer 2-4", async () => {
    const handlers = createLayerHandlers(mockLayerStore, 3, "manager");

    await expect(
      handlers.getSettings({ userId: 1, orgRole: "professional" }, 1),
    ).rejects.toThrow('Role "manager" or higher required');

    const result = await handlers.getSettings({ userId: 1, orgRole: "manager" }, 1);
    expect(result).toEqual({ toneStyle: "formal" });
  });

  it("should allow update operations", async () => {
    const handlers = createLayerHandlers(mockLayerStore, 2, "org_admin");

    await handlers.updateSettings(
      { userId: 1, orgRole: "org_admin" },
      1,
      { toneStyle: "casual" },
    );

    expect(mockLayerStore.upsertLayerConfig).toHaveBeenCalledWith(2, 1, { toneStyle: "casual" });
  });
});

describe("Layer 5 own-settings enforcement", () => {
  const mockLayerStore: LayerStore = {
    getLayerSettings: vi.fn(async () => []),
    getLayerConfig: vi.fn(async () => ({ communicationStyle: "casual" })),
    upsertLayerConfig: vi.fn(async () => {}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow users to access their own settings", async () => {
    const handlers = createLayerHandlers(mockLayerStore, 5, "user");
    const result = await handlers.getSettings({ userId: 42 }, 42);
    expect(result).toEqual({ communicationStyle: "casual" });
  });

  it("should reject users accessing other users' settings", async () => {
    const handlers = createLayerHandlers(mockLayerStore, 5, "user");
    await expect(
      handlers.getSettings({ userId: 42 }, 99),
    ).rejects.toThrow("Users can only access their own settings");
  });

  it("should reject users updating other users' settings", async () => {
    const handlers = createLayerHandlers(mockLayerStore, 5, "user");
    await expect(
      handlers.updateSettings({ userId: 42 }, 99, { communicationStyle: "formal" }),
    ).rejects.toThrow("Users can only update their own settings");
  });

  it("should allow global admin to access any user's settings", async () => {
    const handlers = createLayerHandlers(mockLayerStore, 5, "user");
    const result = await handlers.getSettings({ userId: 1, isGlobalAdmin: true }, 99);
    expect(result).toEqual({ communicationStyle: "casual" });
  });
});

describe("createAllLayerHandlers", () => {
  it("should create handlers for all 5 layers", () => {
    const mockLayerStore: LayerStore = {
      getLayerSettings: vi.fn(async () => []),
      getLayerConfig: vi.fn(async () => null),
      upsertLayerConfig: vi.fn(async () => {}),
    };

    const handlers = createAllLayerHandlers(mockLayerStore);

    expect(handlers[1]).toBeDefined();
    expect(handlers[2]).toBeDefined();
    expect(handlers[3]).toBeDefined();
    expect(handlers[4]).toBeDefined();
    expect(handlers[5]).toBeDefined();
  });
});
