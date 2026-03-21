/**
 * Task #47 — Organization-Level AI Configuration Service
 * Per-org AI behavior customization, prompt overrides, and feature toggles
 */
import { getDb } from "../db";
import { eq } from "drizzle-orm";

export interface OrgAIConfig {
  orgId: number;
  aiEnabled: boolean;
  maxTokensPerResponse: number;
  allowedCapabilityModes: string[];
  customSystemPromptPrefix: string;
  customSystemPromptSuffix: string;
  disabledTools: string[];
  complianceLevel: "standard" | "enhanced" | "strict";
  autoEscalationThreshold: number;
  maxConversationsPerDay: number;
  allowVoiceMode: boolean;
  allowDocumentUpload: boolean;
  allowExports: boolean;
  customDisclaimer: string;
  brandingOverrides: {
    aiName?: string;
    aiAvatar?: string;
    primaryColor?: string;
  };
  updatedAt: string;
}

// In-memory config store (in production, stored in DB)
const orgConfigs = new Map<number, OrgAIConfig>();

function getDefaultConfig(orgId: number): OrgAIConfig {
  return {
    orgId,
    aiEnabled: true,
    maxTokensPerResponse: 4096,
    allowedCapabilityModes: ["General", "Financial Advisory", "Study", "Planning", "Research", "Coaching", "Onboarding"],
    customSystemPromptPrefix: "",
    customSystemPromptSuffix: "",
    disabledTools: [],
    complianceLevel: "standard",
    autoEscalationThreshold: 0.7,
    maxConversationsPerDay: 100,
    allowVoiceMode: true,
    allowDocumentUpload: true,
    allowExports: true,
    customDisclaimer: "",
    brandingOverrides: {},
    updatedAt: new Date().toISOString(),
  };
}

export function getOrgConfig(orgId: number): OrgAIConfig {
  return orgConfigs.get(orgId) ?? getDefaultConfig(orgId);
}

export function updateOrgConfig(orgId: number, updates: Partial<OrgAIConfig>): OrgAIConfig {
  const current = getOrgConfig(orgId);
  const updated = { ...current, ...updates, orgId, updatedAt: new Date().toISOString() };
  orgConfigs.set(orgId, updated);
  return updated;
}

export function isToolAllowed(orgId: number, toolName: string): boolean {
  const config = getOrgConfig(orgId);
  return config.aiEnabled && !config.disabledTools.includes(toolName);
}

export function isModeAllowed(orgId: number, modeName: string): boolean {
  const config = getOrgConfig(orgId);
  return config.aiEnabled && config.allowedCapabilityModes.includes(modeName);
}

export function getOrgPromptOverrides(orgId: number): { prefix: string; suffix: string; disclaimer: string } {
  const config = getOrgConfig(orgId);
  return {
    prefix: config.customSystemPromptPrefix,
    suffix: config.customSystemPromptSuffix,
    disclaimer: config.customDisclaimer,
  };
}

export function getOrgBranding(orgId: number): OrgAIConfig["brandingOverrides"] {
  return getOrgConfig(orgId).brandingOverrides;
}

export function listOrgConfigs(): OrgAIConfig[] {
  return Array.from(orgConfigs.values());
}
