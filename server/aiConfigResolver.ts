/**
 * 5-Layer AI Configuration Resolver — Thin Adapter
 *
 * Cascade: Platform (L1) → Organization (L2) → Manager (L3) → Professional (L4) → User (L5)
 *
 * This file now delegates to @platform/config via the Stewardly config store.
 * All callers continue to import from this path with zero changes.
 */

import {
  resolveAIConfig as sharedResolveAIConfig,
  buildLayerOverlayPrompt as sharedBuildLayerOverlayPrompt,
  validateInheritance as sharedValidateInheritance,
} from "./shared/config/aiConfigResolver";
import { createStewardlyConfigStore } from "./shared/config/stewardlyConfigStore";
import type { ResolvedAIConfig } from "./shared/config/types";

// Re-export types for backward compatibility
export type { ResolvedAIConfig } from "./shared/config/types";
export type { InheritanceViolation } from "./shared/config/types";

/**
 * Resolve the full AI configuration for a user by cascading through
 * all 5 layers. Backward-compatible wrapper that creates a Stewardly
 * config store and delegates to the shared resolver.
 */
export async function resolveAIConfig(opts: {
  userId: number;
  organizationId?: number | null;
}): Promise<ResolvedAIConfig> {
  const store = createStewardlyConfigStore(opts.organizationId ?? undefined);
  return sharedResolveAIConfig(store, opts.userId);
}

/**
 * Build a single prompt string from all layer overlays.
 * Re-exported from the shared config module.
 */
export const buildLayerOverlayPrompt = sharedBuildLayerOverlayPrompt;

/**
 * Validate that lower layers don't violate higher-layer constraints.
 * Re-exported from the shared config module.
 */
export const validateInheritance = sharedValidateInheritance;
