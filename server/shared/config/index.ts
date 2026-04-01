/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @platform/config — Public API
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Reusable 5-layer AI configuration system for any project.
 *
 * Usage:
 *   import {
 *     resolveAIConfig,
 *     createAllLayerHandlers,
 *     DEFAULT_CONFIG,
 *   } from "@platform/config";
 */

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  ResolvedAIConfig,
  AMPPhaseDefaults,
  AMPPhaseConfig,
  HumanOutputDimensions,
  HumanOutputDomainConfig,
  AutonomyPolicy,
  LayerLevel,
  MergeStrategy,
} from "./types";

export { LAYER_NAMES, FIELD_MERGE_STRATEGIES } from "./types";

// ── Config Resolver ──────────────────────────────────────────────────────────
export {
  resolveAIConfig,
  buildLayerOverlayPrompt,
  validateInheritance,
  DEFAULT_CONFIG,
} from "./aiConfigResolver";
export type { ConfigStore, LayerSettings } from "./aiConfigResolver";

// ── Layer Router ─────────────────────────────────────────────────────────────
export {
  createLayerHandlers,
  createAllLayerHandlers,
  hasMinRole,
} from "./aiLayersRouter";
export type { LayerStore, AuthContext, LayerHandlers } from "./aiLayersRouter";
