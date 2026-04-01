/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @platform/config — 5-Layer AI Personalization Router (Platform-Agnostic)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Provides factory functions for creating layer-specific CRUD handlers.
 * Projects wire these into their own routing framework (tRPC, Express, etc.).
 *
 * Role-gated access:
 *   L1 (Platform) — global_admin only
 *   L2 (Organization) — org_admin
 *   L3 (Manager) — manager+ in org
 *   L4 (Professional) — professional+ in org
 *   L5 (User) — own user only
 */

import type { ResolvedAIConfig, LayerLevel } from "./types";
import { resolveAIConfig, buildLayerOverlayPrompt, validateInheritance } from "./aiConfigResolver";
import type { ConfigStore, LayerSettings } from "./aiConfigResolver";

// ─── ROLE HIERARCHY ──────────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<string, number> = {
  user: 0,
  professional: 1,
  manager: 2,
  org_admin: 3,
  global_admin: 4,
};

export function hasMinRole(actualRole: string | null | undefined, minRole: string): boolean {
  return (ROLE_HIERARCHY[actualRole ?? "user"] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

// ─── LAYER STORE INTERFACE ───────────────────────────────────────────────────
//
// Projects implement this for per-layer CRUD operations.

export interface LayerStore extends ConfigStore {
  /** Get settings for a specific layer. */
  getLayerConfig(layer: LayerLevel, entityId: number): Promise<Record<string, unknown> | null>;
  /** Upsert settings for a specific layer. */
  upsertLayerConfig(
    layer: LayerLevel,
    entityId: number,
    settings: Record<string, unknown>,
  ): Promise<void>;
}

// ─── AUTH CONTEXT ────────────────────────────────────────────────────────────

export interface AuthContext {
  userId: number;
  /** User's role in the relevant organization. */
  orgRole?: string | null;
  /** Whether the user has global admin privileges. */
  isGlobalAdmin?: boolean;
  /** Organization ID (for L2–L4 operations). */
  organizationId?: number;
}

// ─── LAYER HANDLERS ──────────────────────────────────────────────────────────

export interface LayerHandlers {
  getSettings(auth: AuthContext, entityId: number): Promise<Record<string, unknown> | null>;
  updateSettings(
    auth: AuthContext,
    entityId: number,
    settings: Record<string, unknown>,
  ): Promise<void>;
  previewConfig(auth: AuthContext, targetUserId: number): Promise<{
    config: ResolvedAIConfig;
    overlayPrompt: string;
    warnings: string[];
  }>;
}

/**
 * Create layer-specific handlers for a given layer level.
 */
export function createLayerHandlers(
  store: LayerStore,
  layer: LayerLevel,
  requiredRole: string,
): LayerHandlers {
  function assertAccess(auth: AuthContext): void {
    if (layer === 1 && !auth.isGlobalAdmin) {
      throw new Error("Global admin required for platform layer");
    }
    if (layer >= 2 && layer <= 4 && !hasMinRole(auth.orgRole, requiredRole)) {
      throw new Error(`Role "${requiredRole}" or higher required for layer ${layer}`);
    }
    // Layer 5: users can only access their own settings
    // (entityId enforcement happens below in get/update)
  }

  return {
    async getSettings(auth: AuthContext, entityId: number) {
      assertAccess(auth);
      if (layer === 5 && entityId !== auth.userId && !auth.isGlobalAdmin) {
        throw new Error("Users can only access their own settings");
      }
      return store.getLayerConfig(layer, entityId);
    },

    async updateSettings(auth: AuthContext, entityId: number, settings: Record<string, unknown>) {
      assertAccess(auth);
      if (layer === 5 && entityId !== auth.userId && !auth.isGlobalAdmin) {
        throw new Error("Users can only update their own settings");
      }
      await store.upsertLayerConfig(layer, entityId, settings);
    },

    async previewConfig(auth: AuthContext, targetUserId: number) {
      if (layer <= 3 || auth.isGlobalAdmin) {
        // Admins and managers can preview any user's config
      } else if (auth.userId !== targetUserId) {
        throw new Error("Can only preview own config");
      }

      const config = await resolveAIConfig(store, targetUserId);
      const overlayPrompt = buildLayerOverlayPrompt(config);
      const warnings = validateInheritance(config);

      return { config, overlayPrompt, warnings };
    },
  };
}

/**
 * Create all five layer handlers at once.
 */
export function createAllLayerHandlers(store: LayerStore): Record<LayerLevel, LayerHandlers> {
  return {
    1: createLayerHandlers(store, 1, "global_admin"),
    2: createLayerHandlers(store, 2, "org_admin"),
    3: createLayerHandlers(store, 3, "manager"),
    4: createLayerHandlers(store, 4, "professional"),
    5: createLayerHandlers(store, 5, "user"),
  };
}
