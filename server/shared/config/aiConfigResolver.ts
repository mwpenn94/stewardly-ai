/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @platform/config — 5-Layer AI Configuration Resolver
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cascade: Platform (L1) → Organization (L2) → Manager (L3) → Professional (L4) → User (L5)
 *
 * Merge strategies:
 *   - promptOverlay: APPEND (each layer adds context, never replaces)
 *   - toneStyle / responseFormat / responseLength: OVERRIDE (lower layer wins)
 *   - temperature / maxTokens: OVERRIDE (lower layer wins)
 *   - modelPreferences / ensembleWeights: OVERRIDE (lower layer wins)
 *   - guardrails / prohibitedTopics: UNION (accumulate restrictions)
 *   - approvedProductCategories: INTERSECT (narrow down)
 *   - ampPhaseDefaults / humanOutputDimensions / autonomyPolicy: OVERRIDE
 *
 * Key design decisions:
 *   - Database access is injected via a ConfigStore interface.
 *   - The resolver is pure logic; no ORM or schema dependencies.
 *   - New fields (AMP, Human Output, Autonomy) are first-class citizens.
 */

import type {
  ResolvedAIConfig,
  AMPPhaseDefaults,
  AMPPhaseConfig,
  HumanOutputDimensions,
  HumanOutputDomainConfig,
  AutonomyPolicy,
  LayerLevel,
} from "./types";

// ─── CONFIG STORE INTERFACE ──────────────────────────────────────────────────
//
// Projects implement this to connect the resolver to their database.

export interface LayerSettings {
  /** Layer level (1–5). */
  layer: LayerLevel;
  /** Display name for this layer source. */
  name: string;
  /** Raw settings object from the database. */
  settings: Record<string, unknown> | null;
}

export interface ConfigStore {
  /** Fetch all layer settings for a given user, ordered L1 → L5. */
  getLayerSettings(userId: number): Promise<LayerSettings[]>;
}

// ─── DEFAULTS ────────────────────────────────────────────────────────────────

const DEFAULT_AMP_PHASE: AMPPhaseConfig = {
  enabled: true,
  timeTargetMinutes: 15,
  tierSelection: "balanced",
};

const DEFAULT_AMP_PHASE_DEFAULTS: AMPPhaseDefaults = {
  orientation: { ...DEFAULT_AMP_PHASE, timeTargetMinutes: 10, tierSelection: "fast" },
  foundation: { ...DEFAULT_AMP_PHASE, timeTargetMinutes: 20 },
  guidedPractice: { ...DEFAULT_AMP_PHASE, timeTargetMinutes: 25 },
  independentApplication: { ...DEFAULT_AMP_PHASE, timeTargetMinutes: 30, tierSelection: "deep" },
  masteryAssessment: { ...DEFAULT_AMP_PHASE, timeTargetMinutes: 15, tierSelection: "deep" },
  continuousRefinement: { ...DEFAULT_AMP_PHASE, timeTargetMinutes: 10 },
};

const DEFAULT_HO_DOMAIN: HumanOutputDomainConfig = {
  tracked: true,
  targetScore: 0.7,
  coachingFrequency: "weekly",
  weight: 1.0,
};

const DEFAULT_HUMAN_OUTPUT_DIMENSIONS: HumanOutputDimensions = {
  criticalThinking: { ...DEFAULT_HO_DOMAIN },
  emotionalIntelligence: { ...DEFAULT_HO_DOMAIN },
  communicationInfluence: { ...DEFAULT_HO_DOMAIN },
  creativityInnovation: { ...DEFAULT_HO_DOMAIN },
  leadershipManagement: { ...DEFAULT_HO_DOMAIN },
  physicalHealth: { ...DEFAULT_HO_DOMAIN, coachingFrequency: "monthly" },
  financialAcumen: { ...DEFAULT_HO_DOMAIN },
  technicalMastery: { ...DEFAULT_HO_DOMAIN },
  strategicVision: { ...DEFAULT_HO_DOMAIN, coachingFrequency: "monthly" },
  resilienceAdaptability: { ...DEFAULT_HO_DOMAIN },
};

const DEFAULT_AUTONOMY_POLICY: AutonomyPolicy = {
  autonomyThreshold: 0.85,
  maxAutonomousAmount: 0,
  autonomousCategories: [],
  requireApprovalCategories: ["financial_transaction", "account_change", "compliance_action"],
  auditAutonomousDecisions: true,
  escalationPolicy: "notify",
  cooldownHours: 24,
};

export const DEFAULT_CONFIG: ResolvedAIConfig = {
  promptOverlays: [],
  toneStyle: "professional",
  responseFormat: "mixed",
  responseLength: "standard",
  temperature: 0.7,
  maxTokens: 4096,
  modelPreferences: { primary: "default", fallback: "default" },
  ensembleWeights: { default: 1.0 },
  guardrails: [],
  prohibitedTopics: [],
  approvedProductCategories: null,
  complianceLanguage: null,
  customDisclaimers: null,
  platformDisclaimer: null,
  brandVoice: null,
  communicationStyle: "detailed",
  customPromptAdditions: null,
  enabledFocusModes: ["general", "financial", "study"],
  layerSources: [],
  thinkingDepth: "standard",
  creativity: 0.7,
  contextDepth: "moderate",
  disclaimerVerbosity: "standard",
  autoFollowUp: false,
  autoFollowUpCount: 1,
  crossModelVerify: false,
  citationStyle: "none",
  reasoningTransparency: false,
  ampPhaseDefaults: DEFAULT_AMP_PHASE_DEFAULTS,
  humanOutputDimensions: DEFAULT_HUMAN_OUTPUT_DIMENSIONS,
  autonomyPolicy: DEFAULT_AUTONOMY_POLICY,
};

// ─── SAFE PARSERS ────────────────────────────────────────────────────────────

function safeJsonArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === "string");
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function safeJsonObject(val: unknown): Record<string, unknown> {
  if (!val) return {};
  if (typeof val === "object" && !Array.isArray(val)) return val as Record<string, unknown>;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function safeString(val: unknown, fallback: string): string {
  return typeof val === "string" && val.length > 0 ? val : fallback;
}

function safeNumber(val: unknown, fallback: number, min?: number, max?: number): number {
  const num = typeof val === "number" ? val : Number(val);
  if (isNaN(num)) return fallback;
  let result = num;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

function safeBool(val: unknown, fallback: boolean): boolean {
  if (typeof val === "boolean") return val;
  return fallback;
}

// ─── RESOLVER ────────────────────────────────────────────────────────────────

export async function resolveAIConfig(
  store: ConfigStore,
  userId: number,
): Promise<ResolvedAIConfig> {
  const layers = await store.getLayerSettings(userId);
  const config = structuredClone(DEFAULT_CONFIG);

  for (const layer of layers) {
    const s = layer.settings;
    if (!s) {
      config.layerSources.push({ layer: layer.layer, name: layer.name, hasConfig: false });
      continue;
    }

    config.layerSources.push({ layer: layer.layer, name: layer.name, hasConfig: true });

    // ── APPEND: prompt overlays ──────────────────────────────────────────
    const overlay = s.baseSystemPrompt ?? s.promptOverlay ?? s.systemPromptOverlay;
    if (typeof overlay === "string" && overlay.length > 0) {
      config.promptOverlays.push({ layer: layer.name, content: overlay });
    }

    // ── OVERRIDE: scalar fields ──────────────────────────────────────────
    if (s.defaultTone ?? s.toneStyle) {
      config.toneStyle = safeString(s.defaultTone ?? s.toneStyle, config.toneStyle);
    }
    if (s.defaultResponseFormat ?? s.responseFormat) {
      config.responseFormat = safeString(
        s.defaultResponseFormat ?? s.responseFormat,
        config.responseFormat,
      );
    }
    if (s.defaultResponseLength ?? s.responseLength) {
      config.responseLength = safeString(
        s.defaultResponseLength ?? s.responseLength,
        config.responseLength,
      );
    }
    if (s.temperatureDefault ?? s.temperature) {
      config.temperature = safeNumber(s.temperatureDefault ?? s.temperature, config.temperature, 0, 2);
    }
    if (s.maxTokensDefault ?? s.maxTokens) {
      config.maxTokens = safeNumber(s.maxTokensDefault ?? s.maxTokens, config.maxTokens, 256, 32768);
    }

    // ── OVERRIDE: objects ────────────────────────────────────────────────
    const mp = safeJsonObject(s.modelPreferences);
    if (Object.keys(mp).length > 0) {
      config.modelPreferences = mp as Record<string, string>;
    }
    const ew = safeJsonObject(s.ensembleWeights);
    if (Object.keys(ew).length > 0) {
      config.ensembleWeights = ew as Record<string, number>;
    }

    // ── UNION: arrays ────────────────────────────────────────────────────
    const gr = safeJsonArray(s.globalGuardrails ?? s.guardrails);
    if (gr.length > 0) {
      config.guardrails = [...new Set([...config.guardrails, ...gr])];
    }
    const pt = safeJsonArray(s.prohibitedTopics);
    if (pt.length > 0) {
      config.prohibitedTopics = [...new Set([...config.prohibitedTopics, ...pt])];
    }

    // ── INTERSECT: approved categories ───────────────────────────────────
    const ac = safeJsonArray(s.approvedProductCategories);
    if (ac.length > 0) {
      if (config.approvedProductCategories === null) {
        config.approvedProductCategories = ac;
      } else {
        const existing = new Set(config.approvedProductCategories);
        config.approvedProductCategories = ac.filter((c) => existing.has(c));
      }
    }

    // ── Org-specific fields ──────────────────────────────────────────────
    if (typeof s.complianceLanguage === "string") config.complianceLanguage = s.complianceLanguage;
    if (typeof s.customDisclaimers === "string") config.customDisclaimers = s.customDisclaimers;
    if (typeof s.platformDisclaimer === "string") config.platformDisclaimer = s.platformDisclaimer;
    if (typeof s.brandVoice === "string") config.brandVoice = s.brandVoice;

    // ── User-specific fields ─────────────────────────────────────────────
    if (typeof s.communicationStyle === "string") config.communicationStyle = s.communicationStyle;
    if (typeof s.customPromptAdditions === "string") config.customPromptAdditions = s.customPromptAdditions;
    const fm = safeJsonArray(s.enabledFocusModes);
    if (fm.length > 0) config.enabledFocusModes = fm;

    // ── AI Fine-Tuning fields ────────────────────────────────────────────
    if (s.thinkingDepth) config.thinkingDepth = safeString(s.thinkingDepth, config.thinkingDepth);
    if (s.creativity !== undefined) config.creativity = safeNumber(s.creativity, config.creativity, 0, 1);
    if (s.contextDepth) config.contextDepth = safeString(s.contextDepth, config.contextDepth);
    if (s.disclaimerVerbosity) config.disclaimerVerbosity = safeString(s.disclaimerVerbosity, config.disclaimerVerbosity);
    if (s.autoFollowUp !== undefined) config.autoFollowUp = safeBool(s.autoFollowUp, config.autoFollowUp);
    if (s.autoFollowUpCount !== undefined) config.autoFollowUpCount = safeNumber(s.autoFollowUpCount, config.autoFollowUpCount, 0, 10);
    if (s.crossModelVerify !== undefined) config.crossModelVerify = safeBool(s.crossModelVerify, config.crossModelVerify);
    if (s.citationStyle) config.citationStyle = safeString(s.citationStyle, config.citationStyle);
    if (s.reasoningTransparency !== undefined) config.reasoningTransparency = safeBool(s.reasoningTransparency, config.reasoningTransparency);

    // ── NEW: AMP Phase Defaults ──────────────────────────────────────────
    if (s.ampPhaseDefaults && typeof s.ampPhaseDefaults === "object") {
      config.ampPhaseDefaults = mergeAMPPhaseDefaults(
        config.ampPhaseDefaults,
        s.ampPhaseDefaults as Partial<AMPPhaseDefaults>,
      );
    }

    // ── NEW: Human Output Dimensions ─────────────────────────────────────
    if (s.humanOutputDimensions && typeof s.humanOutputDimensions === "object") {
      config.humanOutputDimensions = mergeHumanOutputDimensions(
        config.humanOutputDimensions,
        s.humanOutputDimensions as Partial<HumanOutputDimensions>,
      );
    }

    // ── NEW: Autonomy Policy ─────────────────────────────────────────────
    if (s.autonomyPolicy && typeof s.autonomyPolicy === "object") {
      config.autonomyPolicy = mergeAutonomyPolicy(
        config.autonomyPolicy,
        s.autonomyPolicy as Partial<AutonomyPolicy>,
      );
    }
  }

  return config;
}

// ─── MERGE HELPERS FOR NEW FIELDS ────────────────────────────────────────────

function mergeAMPPhaseDefaults(
  base: AMPPhaseDefaults,
  override: Partial<AMPPhaseDefaults>,
): AMPPhaseDefaults {
  const result = structuredClone(base);
  const phases = [
    "orientation",
    "foundation",
    "guidedPractice",
    "independentApplication",
    "masteryAssessment",
    "continuousRefinement",
  ] as const;

  for (const phase of phases) {
    if (override[phase]) {
      result[phase] = {
        ...result[phase],
        ...override[phase],
      };
    }
  }
  return result;
}

function mergeHumanOutputDimensions(
  base: HumanOutputDimensions,
  override: Partial<HumanOutputDimensions>,
): HumanOutputDimensions {
  const result = structuredClone(base);
  const domains = [
    "criticalThinking",
    "emotionalIntelligence",
    "communicationInfluence",
    "creativityInnovation",
    "leadershipManagement",
    "physicalHealth",
    "financialAcumen",
    "technicalMastery",
    "strategicVision",
    "resilienceAdaptability",
  ] as const;

  for (const domain of domains) {
    if (override[domain]) {
      result[domain] = {
        ...result[domain],
        ...override[domain],
      };
    }
  }
  return result;
}

function mergeAutonomyPolicy(
  base: AutonomyPolicy,
  override: Partial<AutonomyPolicy>,
): AutonomyPolicy {
  return {
    autonomyThreshold: override.autonomyThreshold ?? base.autonomyThreshold,
    maxAutonomousAmount: override.maxAutonomousAmount ?? base.maxAutonomousAmount,
    autonomousCategories: override.autonomousCategories ?? base.autonomousCategories,
    requireApprovalCategories: override.requireApprovalCategories
      ? [...new Set([...base.requireApprovalCategories, ...override.requireApprovalCategories])]
      : base.requireApprovalCategories,
    auditAutonomousDecisions: override.auditAutonomousDecisions ?? base.auditAutonomousDecisions,
    escalationPolicy: override.escalationPolicy ?? base.escalationPolicy,
    cooldownHours: override.cooldownHours ?? base.cooldownHours,
  };
}

// ─── PROMPT BUILDER ──────────────────────────────────────────────────────────

/**
 * Build the assembled overlay prompt from all layers.
 */
export function buildLayerOverlayPrompt(config: ResolvedAIConfig): string {
  if (config.promptOverlays.length === 0) return "";

  return config.promptOverlays
    .map((o) => `[${o.layer}]: ${o.content}`)
    .join("\n\n");
}

/**
 * Validate that lower layers don't violate higher-layer constraints.
 */
export function validateInheritance(config: ResolvedAIConfig): string[] {
  const warnings: string[] = [];

  // Check that prohibited topics aren't in approved categories
  if (config.approvedProductCategories) {
    for (const topic of config.prohibitedTopics) {
      if (config.approvedProductCategories.includes(topic)) {
        warnings.push(
          `Prohibited topic "${topic}" appears in approved product categories — this creates a conflict.`,
        );
      }
    }
  }

  // Check autonomy policy sanity
  if (config.autonomyPolicy.autonomyThreshold < 0.5) {
    warnings.push(
      "Autonomy threshold below 0.5 is unusually permissive — verify this is intentional.",
    );
  }

  // Check AMP phase time targets
  const { ampPhaseDefaults } = config;
  const phases = Object.entries(ampPhaseDefaults) as Array<[string, AMPPhaseConfig]>;
  for (const [name, phase] of phases) {
    if (phase.enabled && phase.timeTargetMinutes <= 0) {
      warnings.push(`AMP phase "${name}" is enabled but has a zero or negative time target.`);
    }
  }

  return warnings;
}
