/**
 * Adaptive Suggested Prompts (1B) + UX Polish (5A) + Multi-Tenant (5B) + Data Ingestion Activation (5C)
 */
import { getDb } from "../db";
import { conversations, messages } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { invokeLLM } from "../shared/intelligence/sovereignWiring"
import { contextualLLM } from "./contextualLLM";

// ═══════════════════════════════════════════════════════════════════════════
// 1B: Adaptive Suggested Prompts
// ═══════════════════════════════════════════════════════════════════════════
export interface SuggestedPrompt {
  text: string;
  category: "planning" | "investment" | "insurance" | "tax" | "estate" | "general";
  relevanceScore: number;
  icon: string;
}

const BASE_PROMPTS: SuggestedPrompt[] = [
  { text: "Review my portfolio allocation", category: "investment", relevanceScore: 0.8, icon: "📊" },
  { text: "Calculate my retirement readiness", category: "planning", relevanceScore: 0.8, icon: "🎯" },
  { text: "Compare term vs whole life insurance", category: "insurance", relevanceScore: 0.7, icon: "🛡️" },
  { text: "Optimize my tax strategy", category: "tax", relevanceScore: 0.7, icon: "📋" },
  { text: "Review my estate plan", category: "estate", relevanceScore: 0.6, icon: "🏛️" },
  { text: "Analyze my debt payoff options", category: "planning", relevanceScore: 0.7, icon: "💳" },
  { text: "Check my emergency fund adequacy", category: "planning", relevanceScore: 0.8, icon: "🏦" },
  { text: "Run a Monte Carlo simulation", category: "investment", relevanceScore: 0.6, icon: "🎲" },
];

export async function getAdaptivePrompts(userId: number, limit = 4): Promise<SuggestedPrompt[]> {
  const db = (await getDb())!;

  // Get recent conversation topics
  const recentConvos = await db.select({ topic: conversations.title })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.createdAt))
    .limit(10);

  const recentTopics = recentConvos.map(c => c.topic).filter(Boolean);

  // Score prompts based on recency and relevance
  const scored = BASE_PROMPTS.map(prompt => {
    let score = prompt.relevanceScore;
    // Boost prompts in categories the user hasn't explored recently
    const categoryMentioned = recentTopics.some(t => t?.toLowerCase().includes(prompt.category));
    if (!categoryMentioned) score += 0.2; // Encourage exploration
    // Slight randomization for variety
    score += (Math.random() - 0.5) * 0.1;
    return { ...prompt, relevanceScore: Math.min(1, Math.max(0, score)) };
  });

  return scored.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
}

export async function generateContextualPrompts(userId: number, lastMessage: string): Promise<SuggestedPrompt[]> {
  const response = await contextualLLM({ userId: userId, contextType: "analysis",
    messages: [
      { role: "system", content: "Generate 3 follow-up financial question suggestions based on the last message. Return JSON array of {text, category, icon}." },
      { role: "user", content: `Last message: "${lastMessage}". Suggest follow-up questions.` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "suggestions",
        strict: true,
        schema: {
          type: "object",
          properties: {
            suggestions: { type: "array", items: { type: "object", properties: { text: { type: "string" }, category: { type: "string" }, icon: { type: "string" } }, required: ["text", "category", "icon"], additionalProperties: false } },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(response.choices[0].message.content as string);
  return (parsed.suggestions || []).map((s: any) => ({ ...s, relevanceScore: 0.9 }));
}

// ═══════════════════════════════════════════════════════════════════════════
// 5A: UX Polish — Collapsible responses, micro-interactions, offline handling
// ═══════════════════════════════════════════════════════════════════════════
export interface UXConfig {
  collapsibleThreshold: number; // Characters before auto-collapse
  animationsEnabled: boolean;
  offlineMode: "cache-first" | "network-first" | "disabled";
  compactMode: boolean;
  fontSize: "small" | "medium" | "large";
  reducedMotion: boolean;
}

const DEFAULT_UX_CONFIG: UXConfig = {
  collapsibleThreshold: 2000,
  animationsEnabled: true,
  offlineMode: "cache-first",
  compactMode: false,
  fontSize: "medium",
  reducedMotion: false,
};

const userUXConfigs: Map<number, UXConfig> = new Map();

export function getUXConfig(userId: number): UXConfig {
  return userUXConfigs.get(userId) || { ...DEFAULT_UX_CONFIG };
}

export function updateUXConfig(userId: number, updates: Partial<UXConfig>): UXConfig {
  const current = getUXConfig(userId);
  const updated = { ...current, ...updates };
  userUXConfigs.set(userId, updated);
  return updated;
}

export function shouldCollapseResponse(content: string, config: UXConfig): boolean {
  return content.length > config.collapsibleThreshold;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5B: Multi-Tenant Enhancement — White-label, self-service provisioning
// ═══════════════════════════════════════════════════════════════════════════
export interface TenantConfig {
  orgId: number;
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  faviconUrl?: string;
  customDomain?: string;
  features: string[];
  maxUsers: number;
  maxConversations: number;
  aiTokenBudget: number;
  createdAt: number;
}

const tenantConfigs: Map<number, TenantConfig> = new Map();

export function createTenant(params: Omit<TenantConfig, "createdAt">): TenantConfig {
  const config: TenantConfig = { ...params, createdAt: Date.now() };
  tenantConfigs.set(params.orgId, config);
  return config;
}

export function getTenantConfig(orgId: number): TenantConfig | undefined {
  return tenantConfigs.get(orgId);
}

export function updateTenantConfig(orgId: number, updates: Partial<TenantConfig>): TenantConfig {
  const current = tenantConfigs.get(orgId);
  if (!current) throw new Error("Tenant not found");
  const updated = { ...current, ...updates };
  tenantConfigs.set(orgId, updated);
  return updated;
}

export function listTenants(): TenantConfig[] {
  return Array.from(tenantConfigs.values());
}

// ═══════════════════════════════════════════════════════════════════════════
// 5C: Data Ingestion Activation — Pipeline observability, self-healing
// ═══════════════════════════════════════════════════════════════════════════
export interface PipelineStatus {
  pipelineId: string;
  name: string;
  status: "running" | "paused" | "error" | "idle";
  lastRunAt?: number;
  lastSuccessAt?: number;
  lastErrorAt?: number;
  lastError?: string;
  recordsProcessed: number;
  recordsFailed: number;
  avgProcessingMs: number;
  selfHealingAttempts: number;
}

const pipelines: Map<string, PipelineStatus> = new Map([
  ["plaid-transactions", { pipelineId: "plaid-transactions", name: "Plaid Transaction Sync", status: "idle", recordsProcessed: 0, recordsFailed: 0, avgProcessingMs: 0, selfHealingAttempts: 0 }],
  ["market-data", { pipelineId: "market-data", name: "Market Data Feed", status: "idle", recordsProcessed: 0, recordsFailed: 0, avgProcessingMs: 0, selfHealingAttempts: 0 }],
  ["document-ocr", { pipelineId: "document-ocr", name: "Document OCR Pipeline", status: "idle", recordsProcessed: 0, recordsFailed: 0, avgProcessingMs: 0, selfHealingAttempts: 0 }],
  ["crm-sync", { pipelineId: "crm-sync", name: "CRM Bidirectional Sync", status: "idle", recordsProcessed: 0, recordsFailed: 0, avgProcessingMs: 0, selfHealingAttempts: 0 }],
  ["regulatory-feed", { pipelineId: "regulatory-feed", name: "Regulatory Change Feed", status: "idle", recordsProcessed: 0, recordsFailed: 0, avgProcessingMs: 0, selfHealingAttempts: 0 }],
]);

export function getPipelineStatus(pipelineId: string): PipelineStatus | undefined {
  return pipelines.get(pipelineId);
}

export function listPipelines(): PipelineStatus[] {
  return Array.from(pipelines.values());
}

export function updatePipelineStatus(pipelineId: string, updates: Partial<PipelineStatus>) {
  const current = pipelines.get(pipelineId);
  if (current) {
    Object.assign(current, updates);
  }
}

export function triggerSelfHealing(pipelineId: string): { action: string; success: boolean } {
  const pipeline = pipelines.get(pipelineId);
  if (!pipeline) return { action: "none", success: false };

  pipeline.selfHealingAttempts++;
  if (pipeline.status === "error") {
    pipeline.status = "running";
    pipeline.lastError = undefined;
    return { action: "restart", success: true };
  }
  return { action: "none", success: false };
}

export function pausePipeline(pipelineId: string) {
  const pipeline = pipelines.get(pipelineId);
  if (pipeline) pipeline.status = "paused";
}

export function resumePipeline(pipelineId: string) {
  const pipeline = pipelines.get(pipelineId);
  if (pipeline && pipeline.status === "paused") pipeline.status = "running";
}
