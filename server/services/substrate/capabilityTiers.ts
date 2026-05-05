/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Substrate Primitive: Capability Tiers
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Quality-first degradation architecture for all agent capabilities.
 * Every capability follows a tiered cascade:
 *   Tier 0 (Built-in):     Platform services (Forge LLM, Forge Image, etc.)
 *   Tier 1 (Free Premium): Best free APIs with monthly quotas
 *   Tier 2 (Free Unlimited): Unlimited free fallbacks
 *   Tier 3 (Degraded):     Minimal fallback (placeholder, static)
 *   Tier U (User BYO):     User-configured paid APIs for unlimited premium
 *
 * @substrate-primitive: capability-tiers
 * @absorbed-from: manus-next-app/server/services/capabilityTiers.ts
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "substrate:capabilityTiers" });

// ─── Types ───────────────────────────────────────────────────────────────────

export type CapabilityDomain =
  | "search"
  | "image_generation"
  | "voice_tts"
  | "voice_stt"
  | "browser"
  | "research"
  | "llm"
  | "code_execution"
  | "document_generation";

export type TierLevel = 0 | 1 | 2 | 3;

export interface TierDefinition {
  level: TierLevel;
  name: string;
  provider: string;
  quality: "premium" | "high" | "standard" | "degraded";
  monthlyQuota: number; // 0 = unlimited, -1 = built-in/no limit
  requiresApiKey: boolean;
  apiKeyEnvName?: string;
  description: string;
  available: boolean;
}

export interface CapabilityConfig {
  domain: CapabilityDomain;
  displayName: string;
  description: string;
  tiers: TierDefinition[];
  activeTier: TierLevel;
  usageThisMonth: number;
}

export interface DegradationEvent {
  domain: CapabilityDomain;
  fromTier: TierLevel;
  toTier: TierLevel;
  reason: string;
  timestamp: number;
}

// ─── Tier Registry ───────────────────────────────────────────────────────────

const CAPABILITY_REGISTRY: CapabilityConfig[] = [
  {
    domain: "llm",
    displayName: "Language Model",
    description: "AI text generation and reasoning",
    activeTier: 0,
    usageThisMonth: 0,
    tiers: [
      { level: 0, name: "Forge Default", provider: "forge", quality: "premium", monthlyQuota: -1, requiresApiKey: false, description: "Built-in platform LLM (GPT-4 class)", available: true },
      { level: 1, name: "Forge Economy", provider: "forge", quality: "high", monthlyQuota: -1, requiresApiKey: false, description: "Built-in economy model for simple tasks", available: true },
    ],
  },
  {
    domain: "search",
    displayName: "Web Search",
    description: "Search the web for information",
    activeTier: 0,
    usageThisMonth: 0,
    tiers: [
      { level: 0, name: "Google Search (Forge)", provider: "forge", quality: "premium", monthlyQuota: -1, requiresApiKey: false, description: "Built-in Google Search via Forge grounding", available: true },
      { level: 1, name: "Tavily", provider: "tavily", quality: "high", monthlyQuota: 1000, requiresApiKey: true, apiKeyEnvName: "TAVILY_API_KEY", description: "AI-optimized search (1000 free/month)", available: false },
      { level: 2, name: "DuckDuckGo", provider: "ddg", quality: "standard", monthlyQuota: 0, requiresApiKey: false, description: "Free unlimited search (may be rate-limited)", available: true },
      { level: 3, name: "Wikipedia + FRED", provider: "reference", quality: "degraded", monthlyQuota: 0, requiresApiKey: false, description: "Reference data only", available: true },
    ],
  },
  {
    domain: "image_generation",
    displayName: "Image Generation",
    description: "Generate images from text prompts",
    activeTier: 0,
    usageThisMonth: 0,
    tiers: [
      { level: 0, name: "Forge Image", provider: "forge", quality: "premium", monthlyQuota: -1, requiresApiKey: false, description: "Built-in image generation via Forge", available: true },
    ],
  },
  {
    domain: "voice_tts",
    displayName: "Text-to-Speech",
    description: "Convert text to spoken audio",
    activeTier: 0,
    usageThisMonth: 0,
    tiers: [
      { level: 0, name: "Edge TTS", provider: "edge", quality: "premium", monthlyQuota: 0, requiresApiKey: false, description: "Microsoft Edge TTS (free, unlimited)", available: true },
      { level: 1, name: "Deepgram TTS", provider: "deepgram", quality: "premium", monthlyQuota: 500, requiresApiKey: true, apiKeyEnvName: "DEEPGRAM_API_KEY", description: "Deepgram neural TTS", available: true },
    ],
  },
  {
    domain: "voice_stt",
    displayName: "Speech-to-Text",
    description: "Transcribe spoken audio to text",
    activeTier: 0,
    usageThisMonth: 0,
    tiers: [
      { level: 0, name: "Whisper (Forge)", provider: "forge", quality: "premium", monthlyQuota: -1, requiresApiKey: false, description: "Built-in Whisper transcription", available: true },
      { level: 1, name: "Deepgram STT", provider: "deepgram", quality: "premium", monthlyQuota: 500, requiresApiKey: true, apiKeyEnvName: "DEEPGRAM_API_KEY", description: "Deepgram neural STT", available: true },
    ],
  },
  {
    domain: "document_generation",
    displayName: "Document Generation",
    description: "Generate PDF, DOCX, XLSX documents",
    activeTier: 0,
    usageThisMonth: 0,
    tiers: [
      { level: 0, name: "Built-in Templates", provider: "internal", quality: "premium", monthlyQuota: 0, requiresApiKey: false, description: "9 built-in financial document templates", available: true },
    ],
  },
  {
    domain: "research",
    displayName: "Deep Research",
    description: "Multi-step research with source synthesis",
    activeTier: 0,
    usageThisMonth: 0,
    tiers: [
      { level: 0, name: "Forge Research", provider: "forge", quality: "premium", monthlyQuota: -1, requiresApiKey: false, description: "Built-in research via Forge LLM + Search", available: true },
    ],
  },
];

// ─── State Management ────────────────────────────────────────────────────────

const degradationHistory: DegradationEvent[] = [];
const MAX_HISTORY = 50;

/**
 * Get the current capability configuration for all domains.
 */
export function getCapabilities(): CapabilityConfig[] {
  return CAPABILITY_REGISTRY.map((c) => ({ ...c }));
}

/**
 * Get the capability configuration for a specific domain.
 */
export function getCapability(domain: CapabilityDomain): CapabilityConfig | undefined {
  return CAPABILITY_REGISTRY.find((c) => c.domain === domain);
}

/**
 * Get the active tier for a domain.
 */
export function getActiveTier(domain: CapabilityDomain): TierDefinition | undefined {
  const cap = CAPABILITY_REGISTRY.find((c) => c.domain === domain);
  if (!cap) return undefined;
  return cap.tiers.find((t) => t.level === cap.activeTier);
}

/**
 * Degrade a capability to the next available tier.
 * Returns the new tier level, or null if no further degradation is possible.
 */
export function degradeCapability(domain: CapabilityDomain, reason: string): TierLevel | null {
  const cap = CAPABILITY_REGISTRY.find((c) => c.domain === domain);
  if (!cap) return null;

  const currentTier = cap.activeTier;
  const nextTiers = cap.tiers
    .filter((t) => t.level > currentTier && t.available)
    .sort((a, b) => a.level - b.level);

  if (nextTiers.length === 0) {
    log.warn({ domain, currentTier }, "No further degradation possible");
    return null;
  }

  const newTier = nextTiers[0].level;
  cap.activeTier = newTier;

  const event: DegradationEvent = {
    domain,
    fromTier: currentTier,
    toTier: newTier,
    reason,
    timestamp: Date.now(),
  };
  degradationHistory.push(event);
  if (degradationHistory.length > MAX_HISTORY) degradationHistory.shift();

  log.info({ domain, fromTier: currentTier, toTier: newTier, reason }, "Capability degraded");
  return newTier;
}

/**
 * Restore a capability to a higher tier (e.g., when quota resets).
 */
export function restoreCapability(domain: CapabilityDomain, toTier: TierLevel): boolean {
  const cap = CAPABILITY_REGISTRY.find((c) => c.domain === domain);
  if (!cap) return false;

  const tier = cap.tiers.find((t) => t.level === toTier && t.available);
  if (!tier) return false;

  cap.activeTier = toTier;
  log.info({ domain, toTier }, "Capability restored");
  return true;
}

/**
 * Record usage for a capability (for quota tracking).
 */
export function recordUsage(domain: CapabilityDomain, count: number = 1): void {
  const cap = CAPABILITY_REGISTRY.find((c) => c.domain === domain);
  if (cap) cap.usageThisMonth += count;
}

/**
 * Get degradation history.
 */
export function getDegradationHistory(): DegradationEvent[] {
  return [...degradationHistory];
}

/**
 * Check if a BYO API key is configured for a domain.
 */
export function hasBYOKey(domain: CapabilityDomain, envVars: Record<string, string | undefined>): boolean {
  const cap = CAPABILITY_REGISTRY.find((c) => c.domain === domain);
  if (!cap) return false;

  return cap.tiers.some((t) => t.requiresApiKey && t.apiKeyEnvName && envVars[t.apiKeyEnvName]);
}
