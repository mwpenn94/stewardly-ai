/**
 * C6 — AI Tools Registry Service
 * Register tools, call them from chat, chain multiple tools, discover available tools
 */
import { getDb } from "../db";
import { aiTools, aiToolCalls } from "../../drizzle/schema";
import { eq, and, desc, like } from "drizzle-orm";

// ─── Tool Registration ───────────────────────────────────────────────────
export async function registerTool(data: {
  toolName: string; toolType: "calculator"|"model"|"action"|"query"|"report";
  description: string; inputSchema: any; outputSchema?: any;
  trpcProcedure: string; requiresAuth?: boolean; requiresConfirmation?: boolean;
}) {
  const db = await getDb(); if (!db) return null as any;
  const [row] = await db.insert(aiTools).values({
    toolName: data.toolName,
    toolType: data.toolType,
    description: data.description,
    inputSchema: data.inputSchema,
    outputSchema: data.outputSchema ?? null,
    trpcProcedure: data.trpcProcedure,
    requiresAuth: data.requiresAuth ?? true,
    requiresConfirmation: data.requiresConfirmation ?? false,
  });
  return { id: row.insertId };
}

export async function updateTool(id: number, data: Partial<{
  description: string; inputSchema: any; outputSchema: any;
  trpcProcedure: string; requiresAuth: boolean; requiresConfirmation: boolean; active: boolean;
}>) {
  const db = await getDb(); if (!db) return null as any;
  await db.update(aiTools).set(data as any).where(eq(aiTools.id, id));
  return getTool(id);
}

export async function getTool(id: number) {
  const db = await getDb(); if (!db) return null as any;
  const [tool] = await db.select().from(aiTools).where(eq(aiTools.id, id));
  return tool ?? null;
}

export async function getToolByName(name: string) {
  const db = await getDb(); if (!db) return null as any;
  const [tool] = await db.select().from(aiTools).where(eq(aiTools.toolName, name));
  return tool ?? null;
}

// ─── Tool Discovery ──────────────────────────────────────────────────────
export async function discoverTools(opts?: {
  toolType?: string; query?: string; limit?: number;
}) {
  const db = await getDb(); if (!db) return null as any;
  const conditions: any[] = [eq(aiTools.active, true)];
  if (opts?.toolType) conditions.push(eq(aiTools.toolType, opts.toolType as any));
  if (opts?.query) {
    const pattern = `%${opts.query}%`;
    conditions.push(like(aiTools.description, pattern));
  }

  return db.select().from(aiTools)
    .where(and(...conditions))
    .orderBy(desc(aiTools.usageCount))
    .limit(opts?.limit ?? 50);
}

// ─── Generate OpenAI-compatible tool definitions for LLM ─────────────────
export async function getToolDefinitionsForLLM(toolTypes?: string[]) {
  const db = await getDb(); if (!db) return null as any;
  const conditions: any[] = [eq(aiTools.active, true)];
  const tools = await db.select().from(aiTools).where(and(...conditions));

  const filtered = toolTypes
    ? tools.filter(t => toolTypes.includes(t.toolType))
    : tools;

  return filtered.map(t => ({
    type: "function" as const,
    function: {
      name: t.toolName,
      description: t.description,
      parameters: typeof t.inputSchema === "string" ? JSON.parse(t.inputSchema) : t.inputSchema,
    },
  }));
}

// ─── Tool Execution Logging ──────────────────────────────────────────────
export async function logToolCall(data: {
  toolId: number; conversationId?: number; messageId?: number; userId?: number;
  inputJson: any; outputJson: any; success: boolean; latencyMs: number;
  userModifiedInput?: boolean; errorMessage?: string;
}) {
  const db = await getDb(); if (!db) return null as any;
  await db.insert(aiToolCalls).values({
    toolId: data.toolId,
    conversationId: data.conversationId ?? null,
    messageId: data.messageId ?? null,
    userId: data.userId ?? null,
    inputJson: data.inputJson,
    outputJson: data.outputJson,
    success: data.success,
    latencyMs: data.latencyMs,
    userModifiedInput: data.userModifiedInput ?? false,
    errorMessage: data.errorMessage ?? null,
  });

  // Update tool usage stats
  const tool = await getTool(data.toolId);
  if (tool) {
    const newUsageCount = tool.usageCount + 1;
    const currentSuccessTotal = Math.round((tool.successRate ?? 1) * tool.usageCount);
    const newSuccessRate = (currentSuccessTotal + (data.success ? 1 : 0)) / newUsageCount;
    await db.update(aiTools).set({
      usageCount: newUsageCount,
      successRate: Math.round(newSuccessRate * 1000) / 1000,
    } as any).where(eq(aiTools.id, data.toolId));
  }
}

export async function getToolCallHistory(opts?: {
  toolId?: number; userId?: number; conversationId?: number; limit?: number;
}) {
  const db = await getDb(); if (!db) return null as any;
  const conditions: any[] = [];
  if (opts?.toolId) conditions.push(eq(aiToolCalls.toolId, opts.toolId));
  if (opts?.userId) conditions.push(eq(aiToolCalls.userId, opts.userId));
  if (opts?.conversationId) conditions.push(eq(aiToolCalls.conversationId, opts.conversationId));

  return db.select().from(aiToolCalls)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiToolCalls.createdAt))
    .limit(opts?.limit ?? 50);
}

// ─── Tool Chaining ───────────────────────────────────────────────────────
export interface ToolChainStep {
  toolName: string;
  inputMapping: Record<string, string>; // Maps output field from previous step to input field
  staticInputs?: Record<string, any>;
}

export async function buildToolChainDescription(steps: ToolChainStep[]) {
  const descriptions: string[] = [];
  for (const step of steps) {
    const tool = await getToolByName(step.toolName);
    if (tool) {
      descriptions.push(`Step: ${tool.toolName} - ${tool.description}`);
    }
  }
  return descriptions.join("\n→ ");
}

// ─── Tool Stats ──────────────────────────────────────────────────────────
export async function getToolStats() {
  const db = await getDb(); if (!db) return null as any;
  const tools = await db.select().from(aiTools).where(eq(aiTools.active, true));
  return {
    totalTools: tools.length,
    byType: {
      calculator: tools.filter(t => t.toolType === "calculator").length,
      model: tools.filter(t => t.toolType === "model").length,
      action: tools.filter(t => t.toolType === "action").length,
      query: tools.filter(t => t.toolType === "query").length,
      report: tools.filter(t => t.toolType === "report").length,
    },
    topUsed: tools.sort((a, b) => b.usageCount - a.usageCount).slice(0, 10).map(t => ({
      name: t.toolName, type: t.toolType, usageCount: t.usageCount, successRate: t.successRate,
    })),
    avgSuccessRate: tools.length > 0
      ? Math.round(tools.reduce((s, t) => s + (t.successRate ?? 1), 0) / tools.length * 100) / 100
      : 1,
  };
}
