/**
 * Task #26 — Adaptive Context Management Service
 * Multi-layer context assembly with token budgeting, complexity detection,
 * and intelligent pruning based on conversation needs.
 */
import { requireDb } from "../db";
import { contextAssemblyLog } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

type ComplexityLevel = "simple" | "moderate" | "complex";

interface ContextLayer {
  name: string;
  items: Array<{ content: string; relevance: number; tokens: number }>;
  priority: number;
}

interface AssembledContext {
  layers: Array<{
    name: string;
    itemsIncluded: number;
    itemsPruned: number;
    tokensUsed: number;
  }>;
  totalTokens: number;
  complexityLevel: ComplexityLevel;
  assembledText: string;
}

// ─── Token Estimation ────────────────────────────────────────────────────
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Complexity Detection ────────────────────────────────────────────────
export function detectComplexity(message: string, conversationLength: number): ComplexityLevel {
  const complexIndicators = [
    /\b(compare|versus|vs\.?|difference between)\b/i,
    /\b(tax implications?|estate planning|trust|beneficiar)\b/i,
    /\b(multiple|several|various)\s+(accounts?|portfolios?|strategies)\b/i,
    /\b(scenario|what if|hypothetical)\b/i,
    /\b(regulation|compliance|fiduciary|sec|finra)\b/i,
  ];
  const moderateIndicators = [
    /\b(explain|how does|what is|why)\b/i,
    /\b(portfolio|investment|retirement|savings)\b/i,
    /\b(risk|return|allocation|diversif)\b/i,
  ];

  const complexCount = complexIndicators.filter(p => p.test(message)).length;
  const moderateCount = moderateIndicators.filter(p => p.test(message)).length;

  if (complexCount >= 2 || (complexCount >= 1 && conversationLength > 10)) return "complex";
  if (moderateCount >= 2 || conversationLength > 5) return "moderate";
  return "simple";
}

// ─── Token Budget Allocation ─────────────────────────────────────────────
function getTokenBudget(complexity: ComplexityLevel): number {
  switch (complexity) {
    case "simple": return 2000;
    case "moderate": return 4000;
    case "complex": return 8000;
  }
}

function getLayerBudgets(complexity: ComplexityLevel): Record<string, number> {
  const total = getTokenBudget(complexity);
  switch (complexity) {
    case "simple":
      return { system: 0.3, conversation: 0.5, profile: 0.1, memory: 0.1 };
    case "moderate":
      return { system: 0.2, conversation: 0.35, profile: 0.15, memory: 0.15, knowledge: 0.15 };
    case "complex":
      return { system: 0.15, conversation: 0.25, profile: 0.15, memory: 0.15, knowledge: 0.15, compliance: 0.15 };
  }
}

// ─── Context Assembly ────────────────────────────────────────────────────
export async function assembleContext(
  conversationId: number,
  messageId: number | undefined,
  layers: ContextLayer[],
  userMessage: string,
  conversationLength: number
): Promise<AssembledContext> {
  const complexity = detectComplexity(userMessage, conversationLength);
  const totalBudget = getTokenBudget(complexity);
  const layerBudgetRatios = getLayerBudgets(complexity);

  const assembledLayers: AssembledContext["layers"] = [];
  const assembledParts: string[] = [];
  let totalTokensUsed = 0;

  // Sort layers by priority (lower = higher priority)
  const sortedLayers = [...layers].sort((a, b) => a.priority - b.priority);

  for (const layer of sortedLayers) {
    const budgetRatio = layerBudgetRatios[layer.name] ?? 0.1;
    const layerBudget = Math.floor(totalBudget * budgetRatio);

    // Sort items by relevance (higher = more relevant)
    const sortedItems = [...layer.items].sort((a, b) => b.relevance - a.relevance);

    let layerTokens = 0;
    let included = 0;
    let pruned = 0;
    const layerParts: string[] = [];

    for (const item of sortedItems) {
      if (layerTokens + item.tokens <= layerBudget) {
        layerParts.push(item.content);
        layerTokens += item.tokens;
        included++;
      } else {
        pruned++;
      }
    }

    assembledLayers.push({
      name: layer.name,
      itemsIncluded: included,
      itemsPruned: pruned,
      tokensUsed: layerTokens,
    });

    if (layerParts.length > 0) {
      assembledParts.push(`[${layer.name.toUpperCase()}]\n${layerParts.join("\n")}`);
    }
    totalTokensUsed += layerTokens;
  }

  // Log assembly
  const db = await requireDb();
  for (const layer of assembledLayers) {
    await db.insert(contextAssemblyLog).values({
      conversationId,
      messageId,
      layer: layer.name,
      itemsConsidered: layer.itemsIncluded + layer.itemsPruned,
      itemsIncluded: layer.itemsIncluded,
      itemsPruned: layer.itemsPruned,
      tokenBudget: totalBudget,
      tokensUsed: layer.tokensUsed,
      complexityLevel: complexity,
    });
  }

  return {
    layers: assembledLayers,
    totalTokens: totalTokensUsed,
    complexityLevel: complexity,
    assembledText: assembledParts.join("\n\n"),
  };
}

// ─── Query Helpers ───────────────────────────────────────────────────────
export async function getAssemblyLog(conversationId: number) {
  const db = await requireDb();
  return db.select().from(contextAssemblyLog)
    .where(eq(contextAssemblyLog.conversationId, conversationId))
    .orderBy(desc(contextAssemblyLog.createdAt)).limit(50);
}

export async function getContextStats() {
  const db = await requireDb();
  const rows = await db.select().from(contextAssemblyLog).orderBy(desc(contextAssemblyLog.createdAt)).limit(100);
  const complexityDist = { simple: 0, moderate: 0, complex: 0 };
  let totalTokens = 0;
  let totalPruned = 0;

  for (const row of rows) {
    complexityDist[row.complexityLevel as ComplexityLevel]++;
    totalTokens += row.tokensUsed ?? 0;
    totalPruned += row.itemsPruned ?? 0;
  }

  return {
    recentAssemblies: rows.length,
    complexityDistribution: complexityDist,
    avgTokensPerAssembly: rows.length > 0 ? Math.round(totalTokens / rows.length) : 0,
    totalItemsPruned: totalPruned,
  };
}
