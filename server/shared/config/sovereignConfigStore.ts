/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sovereign Config Store — ConfigStore + LayerStore Implementation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Extends the Stewardly config store with Sovereign-specific configuration:
 *   - Provider routing preferences (model selection, failover order)
 *   - Budget constraints (per-user spending limits, alert thresholds)
 *   - Graduated autonomy persistence (DB-backed instead of in-memory)
 *   - Quality score normalization settings
 *   - Model version tracking
 *
 * Delegates base 5-layer config resolution to stewardlyConfigStore while
 * overlaying Sovereign-specific settings.
 */

import type { LayerLevel } from "./types";
import type { LayerSettings, ConfigStore } from "./aiConfigResolver";
import type { LayerStore } from "./aiLayersRouter";
import { stewardlyConfigStore } from "./stewardlyConfigStore";
import { getDb } from "../../db";
import { eq } from "drizzle-orm";

// ── Sovereign-specific config types ─────────────────────────────────────────

export interface SovereignProviderConfig {
  /** Primary model for this context type */
  primaryModel: string;
  /** Fallback models in priority order */
  fallbackModels: string[];
  /** Maximum cost per call in USD */
  maxCostPerCall: number;
  /** Maximum latency in ms before failover */
  maxLatencyMs: number;
  /** Model version identifier for tracking */
  modelVersion: string;
}

export interface SovereignBudgetConfig {
  /** Monthly spending limit in USD */
  monthlyLimitUsd: number;
  /** Alert threshold as percentage (0-100) */
  alertThresholdPct: number;
  /** Whether to hard-stop at limit or just warn */
  hardStop: boolean;
  /** Current period spend tracking */
  currentSpendUsd: number;
  /** Period start date */
  periodStartDate: string;
}

export interface SovereignAutonomyConfig {
  /** Current autonomy level */
  level: "supervised" | "guided" | "semi_autonomous" | "autonomous";
  /** Trust score (0-100) */
  trustScore: number;
  /** Total interactions count */
  totalInteractions: number;
  /** Successful actions count */
  successfulActions: number;
  /** Overridden actions count */
  overriddenActions: number;
  /** Escalation count */
  escalations: number;
  /** Last escalation timestamp */
  lastEscalation: string | null;
  /** Level transition history */
  levelHistory: Array<{ level: string; achievedAt: string; reason: string }>;
}

export interface SovereignConfig {
  provider: SovereignProviderConfig;
  budget: SovereignBudgetConfig;
  autonomy: SovereignAutonomyConfig;
}

// ── Default Sovereign Config ────────────────────────────────────────────────

export const DEFAULT_SOVEREIGN_CONFIG: SovereignConfig = {
  provider: {
    primaryModel: "gemini-2.5-flash",
    fallbackModels: ["gpt-4o-mini", "gpt-4.1-nano"],
    maxCostPerCall: 0.10,
    maxLatencyMs: 30000,
    modelVersion: "1.0.0",
  },
  budget: {
    monthlyLimitUsd: 50.0,
    alertThresholdPct: 80,
    hardStop: false,
    currentSpendUsd: 0,
    periodStartDate: new Date().toISOString().split("T")[0],
  },
  autonomy: {
    level: "supervised",
    trustScore: 0,
    totalInteractions: 0,
    successfulActions: 0,
    overriddenActions: 0,
    escalations: 0,
    lastEscalation: null,
    levelHistory: [{ level: "supervised", achievedAt: new Date().toISOString(), reason: "Initial level" }],
  },
};

// ── Sovereign Config Store ──────────────────────────────────────────────────

export const sovereignConfigStore: LayerStore = {
  /**
   * Get all layer settings for a user, including Sovereign overlay.
   * Delegates to stewardlyConfigStore and appends Sovereign config.
   */
  async getLayerSettings(userId: number): Promise<LayerSettings[]> {
    const baseLayers = await stewardlyConfigStore.getLayerSettings(userId);

    // Load Sovereign-specific config
    const sovereignConfig = await loadSovereignConfig(userId);

    // Inject Sovereign settings into the platform layer (L1)
    // This ensures Sovereign config is available at the base level
    if (baseLayers.length > 0 && baseLayers[0].layer === 1) {
      const existingSettings = baseLayers[0].settings || {};
      baseLayers[0].settings = {
        ...existingSettings,
        sovereignProvider: sovereignConfig.provider,
        sovereignBudget: sovereignConfig.budget,
        sovereignAutonomy: sovereignConfig.autonomy,
      };
    }

    return baseLayers;
  },

  /**
   * Get layer config for a specific layer and entity.
   */
  async getLayerConfig(layer: LayerLevel, entityId: number): Promise<Record<string, unknown> | null> {
    return stewardlyConfigStore.getLayerConfig(layer, entityId);
  },

  /**
   * Upsert layer config with Sovereign-specific field handling.
   */
  async upsertLayerConfig(
    layer: LayerLevel,
    entityId: number,
    settings: Record<string, unknown>,
  ): Promise<void> {
    // Extract and persist Sovereign-specific fields separately
    const { sovereignProvider, sovereignBudget, sovereignAutonomy, ...baseSettings } = settings;

    if (sovereignAutonomy) {
      await persistAutonomyState(entityId, sovereignAutonomy as SovereignAutonomyConfig);
    }

    if (sovereignBudget) {
      await persistBudgetConfig(entityId, sovereignBudget as SovereignBudgetConfig);
    }

    // Delegate base settings to stewardlyConfigStore
    await stewardlyConfigStore.upsertLayerConfig(layer, entityId, baseSettings);
  },
};

// ── Sovereign Config Persistence ────────────────────────────────────────────

/**
 * Load Sovereign-specific config for a user.
 * Falls back to defaults if no persisted config exists.
 */
async function loadSovereignConfig(userId: number): Promise<SovereignConfig> {
  try {
    const db = await getDb();
    if (!db) return { ...DEFAULT_SOVEREIGN_CONFIG };

    const schema = await import("../../../drizzle/schema").catch(() => null);
    if (!schema) return { ...DEFAULT_SOVEREIGN_CONFIG };

    let autonomy = { ...DEFAULT_SOVEREIGN_CONFIG.autonomy };
    let budget = { ...DEFAULT_SOVEREIGN_CONFIG.budget };
    let provider = { ...DEFAULT_SOVEREIGN_CONFIG.provider };

    // Load autonomy state from DB
    if (schema.sovereignAutonomyState) {
      const [state] = await db
        .select()
        .from(schema.sovereignAutonomyState)
        .where(eq(schema.sovereignAutonomyState.userId, userId))
        .limit(1);

      if (state) {
        autonomy = {
          level: state.level as SovereignAutonomyConfig["level"],
          trustScore: state.trustScore as number,
          totalInteractions: state.totalInteractions as number,
          successfulActions: state.successfulActions as number,
          overriddenActions: state.overriddenActions as number,
          escalations: state.escalations as number,
          lastEscalation: state.lastEscalation as string | null,
          levelHistory: (state.levelHistory as any[]) || [],
        };
      }
    }

    // Load budget from DB
    if (schema.sovereignBudgets) {
      const [budgetRow] = await db
        .select()
        .from(schema.sovereignBudgets)
        .where(eq(schema.sovereignBudgets.userId, userId))
        .limit(1);

      if (budgetRow) {
        budget = {
          monthlyLimitUsd: budgetRow.monthlyLimitUsd as number,
          alertThresholdPct: budgetRow.alertThresholdPct as number,
          hardStop: budgetRow.hardStop as boolean,
          currentSpendUsd: budgetRow.currentSpendUsd as number,
          periodStartDate: budgetRow.periodStartDate as string,
        };
      }
    }

    return { provider, budget, autonomy };
  } catch {
    return { ...DEFAULT_SOVEREIGN_CONFIG };
  }
}

/**
 * Persist graduated autonomy state to the database.
 * This replaces the in-memory Map-based storage in graduatedAutonomy.ts.
 */
export async function persistAutonomyState(
  userId: number,
  autonomy: SovereignAutonomyConfig,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const schema = await import("../../../drizzle/schema").catch(() => null);
    if (!schema?.sovereignAutonomyState) return;

    const existing = await db
      .select()
      .from(schema.sovereignAutonomyState)
      .where(eq(schema.sovereignAutonomyState.userId, userId))
      .limit(1);

    // levelHistory is a json column — Drizzle handles serialization.
    // Only JSON.stringify if the column type requires it (raw SQL); for Drizzle json(), pass the object.
    const levelHistoryValue = Array.isArray(autonomy.levelHistory)
      ? autonomy.levelHistory
      : [];

    const data = {
      level: autonomy.level,
      trustScore: autonomy.trustScore,
      totalInteractions: autonomy.totalInteractions,
      successfulActions: autonomy.successfulActions,
      overriddenActions: autonomy.overriddenActions,
      escalations: autonomy.escalations,
      lastEscalation: autonomy.lastEscalation,
      levelHistory: levelHistoryValue,
      modelVersion: DEFAULT_SOVEREIGN_CONFIG.provider.modelVersion,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db
        .update(schema.sovereignAutonomyState)
        .set(data)
        .where(eq(schema.sovereignAutonomyState.userId, userId));
    } else {
      await db.insert(schema.sovereignAutonomyState).values({
        userId,
        ...data,
      });
    }
  } catch (err) {
    console.error("[SovereignConfigStore] Failed to persist autonomy state:", err);
  }
}

/**
 * Persist budget configuration to the database.
 */
export async function persistBudgetConfig(
  userId: number,
  budget: SovereignBudgetConfig,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const schema = await import("../../../drizzle/schema").catch(() => null);
    if (!schema?.sovereignBudgets) return;

    const existing = await db
      .select()
      .from(schema.sovereignBudgets)
      .where(eq(schema.sovereignBudgets.userId, userId))
      .limit(1);

    // Auto-reset spend if period has rolled over
    const today = new Date().toISOString().split("T")[0];
    const periodStart = budget.periodStartDate || today;
    const periodStartMonth = periodStart.substring(0, 7); // YYYY-MM
    const currentMonth = today.substring(0, 7);
    const currentSpend = periodStartMonth !== currentMonth ? 0 : budget.currentSpendUsd;
    const effectivePeriodStart = periodStartMonth !== currentMonth ? today : periodStart;

    const data = {
      monthlyLimitUsd: budget.monthlyLimitUsd,
      alertThresholdPct: budget.alertThresholdPct,
      hardStop: budget.hardStop,
      currentSpendUsd: currentSpend,
      periodStartDate: effectivePeriodStart,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db
        .update(schema.sovereignBudgets)
        .set(data)
        .where(eq(schema.sovereignBudgets.userId, userId));
    } else {
      await db.insert(schema.sovereignBudgets).values({
        userId,
        ...data,
      });
    }
  } catch (err) {
    console.error("[SovereignConfigStore] Failed to persist budget config:", err);
  }
}

export default sovereignConfigStore;
