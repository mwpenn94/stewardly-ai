/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @platform/config — Shared Configuration Types
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Type definitions for the 5-layer AI configuration system.
 * Extended with AMP phase defaults, Human Output dimensions,
 * and autonomy policy configuration.
 */

// ─── RESOLVED AI CONFIG ──────────────────────────────────────────────────────

export interface ResolvedAIConfig {
  /** Assembled prompt overlays from all layers, in order. */
  promptOverlays: Array<{ layer: string; content: string }>;
  /** Final tone style. */
  toneStyle: string;
  /** Final response format. */
  responseFormat: string;
  /** Final response length. */
  responseLength: string;
  /** Final temperature. */
  temperature: number;
  /** Final max tokens. */
  maxTokens: number;
  /** Model preferences (primary/fallback). */
  modelPreferences: Record<string, string>;
  /** Ensemble weights. */
  ensembleWeights: Record<string, number>;
  /** All accumulated guardrails. */
  guardrails: string[];
  /** All accumulated prohibited topics. */
  prohibitedTopics: string[];
  /** Approved product categories (intersection). */
  approvedProductCategories: string[] | null;
  /** Compliance language from org. */
  complianceLanguage: string | null;
  /** Custom disclaimers from org. */
  customDisclaimers: string | null;
  /** Platform disclaimer. */
  platformDisclaimer: string | null;
  /** Brand voice from org. */
  brandVoice: string | null;
  /** User communication style preference. */
  communicationStyle: string;
  /** User custom prompt additions. */
  customPromptAdditions: string | null;
  /** Enabled focus modes. */
  enabledFocusModes: string[];
  /** Layer sources for transparency. */
  layerSources: Array<{ layer: number; name: string; hasConfig: boolean }>;

  // AI Fine-Tuning fields
  thinkingDepth: string;
  creativity: number;
  contextDepth: string;
  disclaimerVerbosity: string;
  autoFollowUp: boolean;
  autoFollowUpCount: number;
  crossModelVerify: boolean;
  citationStyle: string;
  reasoningTransparency: boolean;

  // ── NEW: AMP Phase Defaults ────────────────────────────────────────────
  ampPhaseDefaults: AMPPhaseDefaults;

  // ── NEW: Human Output Dimensions ───────────────────────────────────────
  humanOutputDimensions: HumanOutputDimensions;

  // ── NEW: Autonomy Policy ───────────────────────────────────────────────
  autonomyPolicy: AutonomyPolicy;

  // ── NEW: Ad & Monetization Policy ──────────────────────────────────────
  adPolicy: AdPolicy;
}

// ─── AD POLICY ──────────────────────────────────────────────────────────────
export interface AdPolicy {
  /** Whether ads are enabled at this layer */
  enabled: boolean;
  /** Max ads per session (0 = unlimited within UX caps) */
  maxPerSession: number;
  /** Allowed ad types */
  allowedTypes: Array<"contextual_banner" | "sponsored_content" | "product_recommendation" | "inline_cta">;
  /** Blocked advertiser names */
  blockedAdvertisers: string[];
  /** Whether to show ads in professional/client conversations */
  showInClientConversations: boolean;
  /** Revenue share percentage for the advisor (if applicable) */
  advisorRevenueSharePct: number;
}

// ─── AMP PHASE DEFAULTS ──────────────────────────────────────────────────────
//
// Configures which Adaptive Mastery Pathway phases are active per AI layer,
// with per-phase time targets and tier selection.

export interface AMPPhaseConfig {
  /** Whether this phase is active. */
  enabled: boolean;
  /** Target time in minutes for this phase. */
  timeTargetMinutes: number;
  /** Which AI tier to use for this phase (e.g., "fast", "balanced", "deep"). */
  tierSelection: "fast" | "balanced" | "deep";
  /** Optional custom prompt overlay for this phase. */
  promptOverlay?: string;
}

export interface AMPPhaseDefaults {
  /** Orientation / onboarding phase. */
  orientation: AMPPhaseConfig;
  /** Foundation building phase. */
  foundation: AMPPhaseConfig;
  /** Guided practice phase. */
  guidedPractice: AMPPhaseConfig;
  /** Independent application phase. */
  independentApplication: AMPPhaseConfig;
  /** Mastery assessment phase. */
  masteryAssessment: AMPPhaseConfig;
  /** Continuous refinement phase. */
  continuousRefinement: AMPPhaseConfig;
}

// ─── HUMAN OUTPUT DIMENSIONS ─────────────────────────────────────────────────
//
// Configures which of the 10 Human Output domains are tracked per AI layer,
// with target scores and coaching frequency.

export interface HumanOutputDomainConfig {
  /** Whether this domain is actively tracked. */
  tracked: boolean;
  /** Target score (0–1 scale). */
  targetScore: number;
  /** How often coaching is triggered: "every_session", "weekly", "monthly", "on_demand". */
  coachingFrequency: "every_session" | "weekly" | "monthly" | "on_demand";
  /** Optional weight for this domain in aggregate scoring. */
  weight?: number;
}

export interface HumanOutputDimensions {
  /** 1. Critical Thinking & Decision Making */
  criticalThinking: HumanOutputDomainConfig;
  /** 2. Emotional Intelligence & Relationships */
  emotionalIntelligence: HumanOutputDomainConfig;
  /** 3. Communication & Influence */
  communicationInfluence: HumanOutputDomainConfig;
  /** 4. Creativity & Innovation */
  creativityInnovation: HumanOutputDomainConfig;
  /** 5. Leadership & Management */
  leadershipManagement: HumanOutputDomainConfig;
  /** 6. Physical Health & Energy */
  physicalHealth: HumanOutputDomainConfig;
  /** 7. Financial Acumen */
  financialAcumen: HumanOutputDomainConfig;
  /** 8. Technical Mastery */
  technicalMastery: HumanOutputDomainConfig;
  /** 9. Strategic Vision & Planning */
  strategicVision: HumanOutputDomainConfig;
  /** 10. Resilience & Adaptability */
  resilienceAdaptability: HumanOutputDomainConfig;
}

// ─── AUTONOMY POLICY ─────────────────────────────────────────────────────────
//
// Defines the "build-first-then-delegate" threshold per AI layer.
// Controls when the AI should act autonomously vs. seek human approval.

export interface AutonomyPolicy {
  /** Confidence threshold (0–1) above which the AI can act autonomously. */
  autonomyThreshold: number;
  /** Maximum dollar amount for autonomous financial decisions. */
  maxAutonomousAmount: number;
  /** Categories where autonomous action is permitted. */
  autonomousCategories: string[];
  /** Categories that always require human approval. */
  requireApprovalCategories: string[];
  /** Whether to log all autonomous decisions for audit. */
  auditAutonomousDecisions: boolean;
  /** Escalation policy when confidence is below threshold. */
  escalationPolicy: "notify" | "block" | "queue_for_review";
  /** Cool-down period in hours between autonomous actions of the same type. */
  cooldownHours: number;
}

// ─── LAYER IDENTIFIERS ───────────────────────────────────────────────────────

export type LayerLevel = 1 | 2 | 3 | 4 | 5;

export const LAYER_NAMES: Record<LayerLevel, string> = {
  1: "Platform",
  2: "Organization",
  3: "Manager",
  4: "Professional",
  5: "User",
};

// ─── MERGE STRATEGIES ────────────────────────────────────────────────────────

export type MergeStrategy = "append" | "override" | "union" | "intersect";

export const FIELD_MERGE_STRATEGIES: Record<string, MergeStrategy> = {
  promptOverlays: "append",
  toneStyle: "override",
  responseFormat: "override",
  responseLength: "override",
  temperature: "override",
  maxTokens: "override",
  modelPreferences: "override",
  ensembleWeights: "override",
  guardrails: "union",
  prohibitedTopics: "union",
  approvedProductCategories: "intersect",
  ampPhaseDefaults: "override",
  humanOutputDimensions: "override",
  autonomyPolicy: "override",
};
