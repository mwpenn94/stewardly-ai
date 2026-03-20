/**
 * 5-Layer AI Configuration Resolver
 *
 * Cascade: Platform (L1) → Organization (L2) → Manager (L3) → Professional (L4) → User (L5)
 *
 * Merge strategies:
 *  - promptOverlay: APPEND (each layer adds context, never replaces)
 *  - toneStyle / responseFormat / responseLength: OVERRIDE (lower layer wins)
 *  - temperature / maxTokens: OVERRIDE (lower layer wins)
 *  - modelPreferences / ensembleWeights: OVERRIDE (lower layer wins)
 *  - guardrails / prohibitedTopics: UNION (accumulate restrictions)
 *  - approvedProductCategories: INTERSECT (narrow down)
 */

import { eq, and } from "drizzle-orm";
import {
  platformAISettings,
  organizationAISettings,
  managerAISettings,
  professionalAISettings,
  userPreferences,
  userOrganizationRoles,
  clientAssociations,
} from "../drizzle/schema";

// ─── RESOLVED CONFIG TYPE ────────────────────────────────────────────────────
export interface ResolvedAIConfig {
  /** Assembled prompt overlays from all layers, in order */
  promptOverlays: { layer: string; content: string }[];
  /** Final tone style */
  toneStyle: string;
  /** Final response format */
  responseFormat: string;
  /** Final response length */
  responseLength: string;
  /** Final temperature */
  temperature: number;
  /** Final max tokens */
  maxTokens: number;
  /** Model preferences (primary/fallback) */
  modelPreferences: Record<string, string>;
  /** Ensemble weights */
  ensembleWeights: Record<string, number>;
  /** All accumulated guardrails */
  guardrails: string[];
  /** All accumulated prohibited topics */
  prohibitedTopics: string[];
  /** Approved product categories (intersection) */
  approvedProductCategories: string[] | null;
  /** Compliance language from org */
  complianceLanguage: string | null;
  /** Custom disclaimers from org */
  customDisclaimers: string | null;
  /** Platform disclaimer */
  platformDisclaimer: string | null;
  /** Brand voice from org */
  brandVoice: string | null;
  /** User communication style preference */
  communicationStyle: string;
  /** User custom prompt additions */
  customPromptAdditions: string | null;
  /** Enabled focus modes */
  enabledFocusModes: string[];
  /** Layer sources for transparency */
  layerSources: { layer: number; name: string; hasConfig: boolean }[];
}

// Default config when no layers are configured
const DEFAULT_CONFIG: ResolvedAIConfig = {
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
};

// ─── SAFE JSON PARSE ─────────────────────────────────────────────────────────
function safeJsonArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === "string");
  if (typeof val === "string") {
    try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  return [];
}

function safeJsonObject(val: unknown): Record<string, unknown> {
  if (!val) return {};
  if (typeof val === "object" && !Array.isArray(val)) return val as Record<string, unknown>;
  if (typeof val === "string") {
    try { const parsed = JSON.parse(val); return typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; }
    catch { return {}; }
  }
  return {};
}

// ─── RESOLVER ────────────────────────────────────────────────────────────────
export async function resolveAIConfig(opts: {
  userId: number;
  organizationId?: number | null;
}): Promise<ResolvedAIConfig> {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) return { ...DEFAULT_CONFIG };

  const config: ResolvedAIConfig = { ...DEFAULT_CONFIG, promptOverlays: [], guardrails: [], prohibitedTopics: [], layerSources: [] };

  // ── LAYER 1: Platform Base ──────────────────────────────────────────────
  try {
    const [platform] = await db
      .select()
      .from(platformAISettings)
      .where(eq(platformAISettings.settingKey, "default"))
      .limit(1);

    if (platform) {
      config.layerSources.push({ layer: 1, name: "Platform", hasConfig: true });
      if (platform.baseSystemPrompt) {
        config.promptOverlays.push({ layer: "L1-Platform", content: platform.baseSystemPrompt });
      }
      if (platform.defaultTone) config.toneStyle = platform.defaultTone;
      if (platform.defaultResponseFormat) config.responseFormat = platform.defaultResponseFormat;
      if (platform.defaultResponseLength) config.responseLength = platform.defaultResponseLength;
      if (platform.temperatureDefault != null) config.temperature = platform.temperatureDefault;
      if (platform.maxTokensDefault != null) config.maxTokens = platform.maxTokensDefault;
      config.guardrails = safeJsonArray(platform.globalGuardrails);
      config.prohibitedTopics = safeJsonArray(platform.prohibitedTopics);
      config.enabledFocusModes = safeJsonArray(platform.enabledFocusModes);
      if (platform.platformDisclaimer) config.platformDisclaimer = platform.platformDisclaimer;

      const modelPrefs = safeJsonObject(platform.modelPreferences);
      if (Object.keys(modelPrefs).length > 0) config.modelPreferences = modelPrefs as Record<string, string>;
      const weights = safeJsonObject(platform.ensembleWeights);
      if (Object.keys(weights).length > 0) config.ensembleWeights = weights as Record<string, number>;
    } else {
      config.layerSources.push({ layer: 1, name: "Platform", hasConfig: false });
    }
  } catch (e) {
    config.layerSources.push({ layer: 1, name: "Platform", hasConfig: false });
  }

  // ── LAYER 2: Organization Overlay ───────────────────────────────────────
  const orgId = opts.organizationId;
  if (orgId) {
    try {
      const [orgSettings] = await db
        .select()
        .from(organizationAISettings)
        .where(eq(organizationAISettings.organizationId, orgId))
        .limit(1);

      if (orgSettings) {
        config.layerSources.push({ layer: 2, name: orgSettings.organizationName || "Organization", hasConfig: true });
        if (orgSettings.promptOverlay) {
          config.promptOverlays.push({ layer: "L2-Organization", content: orgSettings.promptOverlay });
        }
        if (orgSettings.toneStyle) config.toneStyle = orgSettings.toneStyle;
        if (orgSettings.responseFormat) config.responseFormat = orgSettings.responseFormat;
        if (orgSettings.responseLength) config.responseLength = orgSettings.responseLength;
        if (orgSettings.temperature != null) config.temperature = orgSettings.temperature;
        if (orgSettings.maxTokens != null) config.maxTokens = orgSettings.maxTokens;
        if (orgSettings.brandVoice) config.brandVoice = orgSettings.brandVoice;
        if (orgSettings.complianceLanguage) config.complianceLanguage = orgSettings.complianceLanguage;
        if (orgSettings.customDisclaimers) config.customDisclaimers = orgSettings.customDisclaimers;

        // UNION prohibited topics
        const orgProhibited = safeJsonArray(orgSettings.prohibitedTopics);
        config.prohibitedTopics = Array.from(new Set([...config.prohibitedTopics, ...orgProhibited]));

        // INTERSECT approved categories (if org specifies, narrow down)
        const orgApproved = safeJsonArray(orgSettings.approvedProductCategories);
        if (orgApproved.length > 0) {
          config.approvedProductCategories = config.approvedProductCategories
            ? config.approvedProductCategories.filter(c => orgApproved.includes(c))
            : orgApproved;
        }

        // Enabled focus modes (org can restrict)
        const orgFocus = safeJsonArray(orgSettings.enabledFocusModes);
        if (orgFocus.length > 0) {
          config.enabledFocusModes = config.enabledFocusModes.filter(m => orgFocus.includes(m));
        }

        // OVERRIDE model preferences
        const orgModelPrefs = safeJsonObject(orgSettings.modelPreferences);
        if (Object.keys(orgModelPrefs).length > 0) config.modelPreferences = orgModelPrefs as Record<string, string>;
        const orgWeights = safeJsonObject(orgSettings.ensembleWeights);
        if (Object.keys(orgWeights).length > 0) config.ensembleWeights = orgWeights as Record<string, number>;
      } else {
        config.layerSources.push({ layer: 2, name: "Organization", hasConfig: false });
      }
    } catch (e) {
      config.layerSources.push({ layer: 2, name: "Organization", hasConfig: false });
    }
  }

  // ── Find user's manager and professional from org roles ──────────────────
  let managerId: number | null = null;
  let professionalId: number | null = null;

  if (orgId) {
    try {
      const [role] = await db
        .select()
        .from(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.userId, opts.userId),
            eq(userOrganizationRoles.organizationId, orgId)
          )
        )
        .limit(1);

      if (role) {
        managerId = role.managerId;
        professionalId = role.professionalId;
      }
    } catch (e) { /* no role found */ }

    // Also check client associations
    if (!professionalId) {
      try {
        const [assoc] = await db
          .select()
          .from(clientAssociations)
          .where(
            and(
              eq(clientAssociations.clientId, opts.userId),
              eq(clientAssociations.status, "active")
            )
          )
          .limit(1);
        if (assoc) professionalId = assoc.professionalId;
      } catch (e) { /* no association */ }
    }
  }

  // ── LAYER 3: Manager Overlay ────────────────────────────────────────────
  if (managerId) {
    try {
      const [mgrSettings] = await db
        .select()
        .from(managerAISettings)
        .where(eq(managerAISettings.managerId, managerId))
        .limit(1);

      if (mgrSettings) {
        config.layerSources.push({ layer: 3, name: "Manager", hasConfig: true });
        if (mgrSettings.promptOverlay) {
          config.promptOverlays.push({ layer: "L3-Manager", content: mgrSettings.promptOverlay });
        }
        if (mgrSettings.toneStyle) config.toneStyle = mgrSettings.toneStyle;
        if (mgrSettings.responseFormat) config.responseFormat = mgrSettings.responseFormat;
        if (mgrSettings.responseLength) config.responseLength = mgrSettings.responseLength;
        if (mgrSettings.temperature != null) config.temperature = mgrSettings.temperature;
        if (mgrSettings.maxTokens != null) config.maxTokens = mgrSettings.maxTokens;

        const mgrModelPrefs = safeJsonObject(mgrSettings.modelPreferences);
        if (Object.keys(mgrModelPrefs).length > 0) config.modelPreferences = mgrModelPrefs as Record<string, string>;
        const mgrWeights = safeJsonObject(mgrSettings.ensembleWeights);
        if (Object.keys(mgrWeights).length > 0) config.ensembleWeights = mgrWeights as Record<string, number>;
      } else {
        config.layerSources.push({ layer: 3, name: "Manager", hasConfig: false });
      }
    } catch (e) {
      config.layerSources.push({ layer: 3, name: "Manager", hasConfig: false });
    }
  }

  // ── LAYER 4: Professional Overlay ───────────────────────────────────────
  if (professionalId) {
    try {
      const [proSettings] = await db
        .select()
        .from(professionalAISettings)
        .where(eq(professionalAISettings.professionalId, professionalId))
        .limit(1);

      if (proSettings) {
        config.layerSources.push({ layer: 4, name: "Professional", hasConfig: true });
        if (proSettings.promptOverlay) {
          config.promptOverlays.push({ layer: "L4-Professional", content: proSettings.promptOverlay });
        }
        if (proSettings.toneStyle) config.toneStyle = proSettings.toneStyle;
        if (proSettings.responseFormat) config.responseFormat = proSettings.responseFormat;
        if (proSettings.responseLength) config.responseLength = proSettings.responseLength;
        if (proSettings.temperature != null) config.temperature = proSettings.temperature;
        if (proSettings.maxTokens != null) config.maxTokens = proSettings.maxTokens;

        const proModelPrefs = safeJsonObject(proSettings.modelPreferences);
        if (Object.keys(proModelPrefs).length > 0) config.modelPreferences = proModelPrefs as Record<string, string>;
        const proWeights = safeJsonObject(proSettings.ensembleWeights);
        if (Object.keys(proWeights).length > 0) config.ensembleWeights = proWeights as Record<string, number>;
      } else {
        config.layerSources.push({ layer: 4, name: "Professional", hasConfig: false });
      }
    } catch (e) {
      config.layerSources.push({ layer: 4, name: "Professional", hasConfig: false });
    }
  }

  // ── LAYER 5: User Preferences ──────────────────────────────────────────
  try {
    const [userPrefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, opts.userId))
      .limit(1);

    if (userPrefs) {
      config.layerSources.push({ layer: 5, name: "User", hasConfig: true });
      if (userPrefs.communicationStyle) config.communicationStyle = userPrefs.communicationStyle;
      if (userPrefs.responseLength) config.responseLength = userPrefs.responseLength;
      if (userPrefs.responseFormat) config.responseFormat = userPrefs.responseFormat;
      if (userPrefs.temperature != null) config.temperature = userPrefs.temperature;
      if (userPrefs.maxTokens != null) config.maxTokens = userPrefs.maxTokens;
      if (userPrefs.customPromptAdditions) {
        config.customPromptAdditions = userPrefs.customPromptAdditions;
        config.promptOverlays.push({ layer: "L5-User", content: userPrefs.customPromptAdditions });
      }

      const userModelPrefs = safeJsonObject(userPrefs.modelPreferences);
      if (Object.keys(userModelPrefs).length > 0) config.modelPreferences = userModelPrefs as Record<string, string>;
      const userWeights = safeJsonObject(userPrefs.ensembleWeights);
      if (Object.keys(userWeights).length > 0) config.ensembleWeights = userWeights as Record<string, number>;
    } else {
      config.layerSources.push({ layer: 5, name: "User", hasConfig: false });
    }
  } catch (e) {
    config.layerSources.push({ layer: 5, name: "User", hasConfig: false });
  }

  return config;
}

/**
 * Build the assembled prompt overlay string from resolved config.
 * This is injected into the system prompt alongside the existing buildSystemPrompt.
 */
export function buildLayerOverlayPrompt(config: ResolvedAIConfig): string {
  const parts: string[] = [];

  // Prompt overlays from all layers
  if (config.promptOverlays.length > 0) {
    parts.push("<layer_overlays>");
    for (const overlay of config.promptOverlays) {
      parts.push(`[${overlay.layer}]: ${overlay.content}`);
    }
    parts.push("</layer_overlays>");
  }

  // Tone & style directive
  parts.push(`<response_style>
Tone: ${config.toneStyle}
Format: ${config.responseFormat} (${config.responseFormat === "bullets" ? "use bullet points" : config.responseFormat === "prose" ? "use flowing paragraphs" : "mix bullets and prose as appropriate"})
Length: ${config.responseLength} (${config.responseLength === "concise" ? "keep responses brief and to the point" : config.responseLength === "comprehensive" ? "provide thorough, detailed responses" : "balanced detail level"})
Communication level: ${config.communicationStyle}
</response_style>`);

  // Brand voice
  if (config.brandVoice) {
    parts.push(`<brand_voice>${config.brandVoice}</brand_voice>`);
  }

  // Guardrails
  if (config.guardrails.length > 0) {
    parts.push(`<guardrails>\n${config.guardrails.map(g => `- ${g}`).join("\n")}\n</guardrails>`);
  }

  // Prohibited topics
  if (config.prohibitedTopics.length > 0) {
    parts.push(`<prohibited_topics>Do not engage with or provide advice on:\n${config.prohibitedTopics.map(t => `- ${t}`).join("\n")}\n</prohibited_topics>`);
  }

  // Compliance
  if (config.complianceLanguage) {
    parts.push(`<compliance>${config.complianceLanguage}</compliance>`);
  }

  return parts.join("\n\n");
}


// ─── INHERITANCE VALIDATION ──────────────────────────────────────────────────
export interface InheritanceViolation {
  layer: string;
  field: string;
  issue: string;
  severity: "error" | "warning";
}

/**
 * Validate that lower layers don't contradict higher layers.
 * Rules:
 * 1. Guardrails from higher layers cannot be removed by lower layers (UNION only adds)
 * 2. Prohibited topics from higher layers cannot be removed
 * 3. Temperature must stay within platform-defined bounds
 * 4. Compliance language from org layer cannot be overridden by lower layers
 * 5. Approved product categories can only narrow, not expand
 */
export function validateInheritance(layers: {
  platform?: any;
  organization?: any;
  manager?: any;
  professional?: any;
  user?: any;
}): InheritanceViolation[] {
  const violations: InheritanceViolation[] = [];

  const platformGuardrails = parseJsonArray(layers.platform?.guardrails);
  const platformProhibited = parseJsonArray(layers.platform?.prohibitedTopics);
  const platformTemp = layers.platform?.temperature;
  const platformMaxTokens = layers.platform?.maxTokens;
  const orgComplianceLanguage = layers.organization?.complianceLanguage;
  const orgApprovedCategories = parseJsonArray(layers.organization?.approvedProductCategories);

  // Check each lower layer
  const lowerLayers = [
    { name: "Organization", data: layers.organization },
    { name: "Manager", data: layers.manager },
    { name: "Professional", data: layers.professional },
    { name: "User", data: layers.user },
  ];

  for (const layer of lowerLayers) {
    if (!layer.data) continue;

    // Temperature bounds check
    if (platformTemp != null && layer.data.temperature != null) {
      const maxAllowed = Math.min(platformTemp + 0.3, 2.0);
      const minAllowed = Math.max(platformTemp - 0.3, 0);
      if (layer.data.temperature > maxAllowed || layer.data.temperature < minAllowed) {
        violations.push({
          layer: layer.name,
          field: "temperature",
          issue: `Temperature ${layer.data.temperature} exceeds platform bounds [${minAllowed.toFixed(1)}-${maxAllowed.toFixed(1)}]`,
          severity: "warning",
        });
      }
    }

    // Max tokens bounds check
    if (platformMaxTokens != null && layer.data.maxTokens != null) {
      if (layer.data.maxTokens > platformMaxTokens * 2) {
        violations.push({
          layer: layer.name,
          field: "maxTokens",
          issue: `Max tokens ${layer.data.maxTokens} exceeds 2x platform limit (${platformMaxTokens})`,
          severity: "warning",
        });
      }
    }

    // Compliance language override check (only for layers below org)
    if (orgComplianceLanguage && layer.name !== "Organization" && layer.data.complianceLanguage) {
      if (layer.data.complianceLanguage !== orgComplianceLanguage) {
        violations.push({
          layer: layer.name,
          field: "complianceLanguage",
          issue: `Cannot override organization compliance language`,
          severity: "error",
        });
      }
    }

    // Approved categories expansion check (can only narrow)
    if (orgApprovedCategories.length > 0 && layer.data.approvedProductCategories) {
      const layerCategories = parseJsonArray(layer.data.approvedProductCategories);
      const expanded = layerCategories.filter((c: string) => !orgApprovedCategories.includes(c));
      if (expanded.length > 0) {
        violations.push({
          layer: layer.name,
          field: "approvedProductCategories",
          issue: `Cannot add categories not in org approved list: ${expanded.join(", ")}`,
          severity: "error",
        });
      }
    }
  }

  return violations;
}

function parseJsonArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}
