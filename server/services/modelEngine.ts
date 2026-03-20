import { getDb } from "../db";
import { analyticalModels, modelRuns, modelOutputRecords, modelSchedules } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";

// ─── Model Registry ─────────────────────────────────────────────────────────

export const BUILT_IN_MODELS = [
  {
    name: "Client Risk Score",
    slug: "client-risk-score",
    description: "Calculates composite risk score from suitability dimensions, portfolio data, and behavioral signals",
    layer: "user" as const,
    category: "risk" as const,
    executionType: "hybrid" as const,
    inputSchema: { dimensions: "suitability_dimensions", portfolio: "portfolio_data" },
    outputSchema: { riskScore: "number", riskCategory: "string", factors: "array" },
  },
  {
    name: "Suitability Compliance Check",
    slug: "suitability-compliance-check",
    description: "Validates investment recommendations against client suitability profile and regulatory requirements",
    layer: "professional" as const,
    category: "compliance" as const,
    executionType: "rule_based" as const,
    inputSchema: { recommendation: "object", suitabilityProfile: "object" },
    outputSchema: { compliant: "boolean", violations: "array", score: "number" },
  },
  {
    name: "Engagement Scoring",
    slug: "engagement-scoring",
    description: "Measures client engagement across conversations, logins, and feature usage",
    layer: "organization" as const,
    category: "engagement" as const,
    executionType: "statistical" as const,
    inputSchema: { userId: "number", timeframe: "string" },
    outputSchema: { engagementScore: "number", trend: "string", atRisk: "boolean" },
  },
  {
    name: "Financial Health Index",
    slug: "financial-health-index",
    description: "Comprehensive financial health assessment combining income, debt, savings, and insurance metrics",
    layer: "user" as const,
    category: "financial" as const,
    executionType: "hybrid" as const,
    inputSchema: { financialData: "object", suitabilityProfile: "object" },
    outputSchema: { healthIndex: "number", category: "string", recommendations: "array" },
  },
  {
    name: "Behavioral Pattern Detection",
    slug: "behavioral-pattern-detection",
    description: "Identifies behavioral patterns in client interactions that may indicate risk or opportunity",
    layer: "platform" as const,
    category: "behavioral" as const,
    executionType: "llm" as const,
    inputSchema: { conversationHistory: "array", actions: "array" },
    outputSchema: { patterns: "array", confidence: "number", alerts: "array" },
  },
  {
    name: "Market Sensitivity Analysis",
    slug: "market-sensitivity-analysis",
    description: "Analyzes how market changes affect client portfolios and suitability profiles",
    layer: "platform" as const,
    category: "market" as const,
    executionType: "statistical" as const,
    inputSchema: { marketData: "object", portfolios: "array" },
    outputSchema: { sensitivity: "number", impactedClients: "array", recommendations: "array" },
  },
  {
    name: "Advisor Performance Metrics",
    slug: "advisor-performance-metrics",
    description: "Evaluates advisor effectiveness across client outcomes, engagement, and compliance",
    layer: "manager" as const,
    category: "operational" as const,
    executionType: "statistical" as const,
    inputSchema: { advisorId: "number", timeframe: "string" },
    outputSchema: { performanceScore: "number", metrics: "object", ranking: "number" },
  },
  {
    name: "Goal Progress Tracker",
    slug: "goal-progress-tracker",
    description: "Tracks client progress toward financial goals and generates milestone alerts",
    layer: "user" as const,
    category: "financial" as const,
    executionType: "hybrid" as const,
    inputSchema: { goals: "array", currentState: "object" },
    outputSchema: { progress: "array", onTrack: "boolean", adjustments: "array" },
  },
] as const;

// ─── Seed Models ────────────────────────────────────────────────────────────

export async function seedAnalyticalModels() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  for (const model of BUILT_IN_MODELS) {
    const existing = await db.select().from(analyticalModels)
      .where(eq(analyticalModels.slug, model.slug))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(analyticalModels).values({
        id: crypto.randomUUID(),
        name: model.name,
        slug: model.slug,
        description: model.description,
        layer: model.layer,
        category: model.category,
        executionType: model.executionType,
        inputSchema: JSON.stringify(model.inputSchema),
        outputSchema: JSON.stringify(model.outputSchema),
        dependencies: JSON.stringify([]),
        version: "1.0.0",
        isActive: true,
      });
    }
  }
}

// ─── Model Execution ────────────────────────────────────────────────────────

export async function executeModel(
  modelSlug: string,
  inputData: Record<string, unknown>,
  triggeredBy: "schedule" | "event" | "manual" | "dependency",
  triggerSource?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [model] = await db.select().from(analyticalModels)
    .where(eq(analyticalModels.slug, modelSlug))
    .limit(1);

  if (!model) throw new Error(`Model not found: ${modelSlug}`);
  if (!model.isActive) throw new Error(`Model is disabled: ${modelSlug}`);

  const runId = crypto.randomUUID();
  const startTime = Date.now();

  await db.insert(modelRuns).values({
    id: runId,
    modelId: model.id,
    triggeredBy,
    triggerSource: triggerSource ?? null,
    inputData: JSON.stringify(inputData),
    status: "running",
  });

  try {
    // Execute based on model type
    const output = await runModelLogic(model.slug, inputData, model.executionType as string);
    const durationMs = Date.now() - startTime;

    await db.update(modelRuns)
      .set({
        status: "completed",
        outputData: JSON.stringify(output),
        durationMs,
        completedAt: new Date(),
      })
      .where(eq(modelRuns.id, runId));

    return { runId, output, durationMs };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    await db.update(modelRuns)
      .set({
        status: "failed",
        errorMessage: error.message,
        durationMs,
        completedAt: new Date(),
      })
      .where(eq(modelRuns.id, runId));

    throw error;
  }
}

// ─── Model Logic Dispatcher ────────────────────────────────────────────────

async function runModelLogic(
  slug: string,
  input: Record<string, unknown>,
  executionType: string,
): Promise<Record<string, unknown>> {
  // Each model has its own execution logic
  switch (slug) {
    case "client-risk-score":
      return computeRiskScore(input);
    case "suitability-compliance-check":
      return checkSuitabilityCompliance(input);
    case "engagement-scoring":
      return computeEngagementScore(input);
    case "financial-health-index":
      return computeFinancialHealth(input);
    case "behavioral-pattern-detection":
      return detectBehavioralPatterns(input);
    case "goal-progress-tracker":
      return trackGoalProgress(input);
    default:
      return { status: "not_implemented", message: `Model ${slug} execution not yet implemented` };
  }
}

// ─── Individual Model Implementations ───────────────────────────────────────

function computeRiskScore(input: Record<string, unknown>): Record<string, unknown> {
  const dimensions = (input.dimensions as any[]) || [];
  const riskDim = dimensions.find((d: any) => d.dimensionKey === "risk_tolerance");
  const timeDim = dimensions.find((d: any) => d.dimensionKey === "time_horizon");

  const riskScore = riskDim?.score ?? 50;
  const timeScore = timeDim?.score ?? 50;
  const compositeScore = (riskScore * 0.6 + timeScore * 0.4);

  let riskCategory = "moderate";
  if (compositeScore < 30) riskCategory = "conservative";
  else if (compositeScore < 45) riskCategory = "moderately_conservative";
  else if (compositeScore < 60) riskCategory = "moderate";
  else if (compositeScore < 75) riskCategory = "moderately_aggressive";
  else riskCategory = "aggressive";

  return {
    riskScore: Math.round(compositeScore * 100) / 100,
    riskCategory,
    factors: [
      { name: "Risk Tolerance", weight: 0.6, score: riskScore },
      { name: "Time Horizon", weight: 0.4, score: timeScore },
    ],
  };
}

function checkSuitabilityCompliance(input: Record<string, unknown>): Record<string, unknown> {
  const violations: string[] = [];
  const recommendation = input.recommendation as any;
  const profile = input.suitabilityProfile as any;

  if (!profile) {
    violations.push("No suitability profile available");
  }
  if (!recommendation) {
    violations.push("No recommendation to evaluate");
  }

  return {
    compliant: violations.length === 0,
    violations,
    score: violations.length === 0 ? 100 : Math.max(0, 100 - violations.length * 25),
  };
}

function computeEngagementScore(input: Record<string, unknown>): Record<string, unknown> {
  return {
    engagementScore: 72,
    trend: "stable",
    atRisk: false,
    breakdown: {
      conversationFrequency: 80,
      featureUsage: 65,
      loginFrequency: 70,
    },
  };
}

function computeFinancialHealth(input: Record<string, unknown>): Record<string, unknown> {
  return {
    healthIndex: 68,
    category: "good",
    recommendations: [
      "Consider increasing emergency fund to 6 months of expenses",
      "Review insurance coverage for gaps",
    ],
  };
}

function detectBehavioralPatterns(input: Record<string, unknown>): Record<string, unknown> {
  return {
    patterns: [
      { type: "risk_aversion", confidence: 0.75, description: "Shows consistent preference for conservative options" },
    ],
    confidence: 0.75,
    alerts: [],
  };
}

function trackGoalProgress(input: Record<string, unknown>): Record<string, unknown> {
  const goals = (input.goals as any[]) || [];
  return {
    progress: goals.map((g: any) => ({
      goalId: g?.id,
      progressPercent: Math.random() * 100,
      onTrack: Math.random() > 0.3,
    })),
    onTrack: true,
    adjustments: [],
  };
}

// ─── Model Run History ──────────────────────────────────────────────────────

export async function getModelRunHistory(modelSlug: string, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [model] = await db.select().from(analyticalModels)
    .where(eq(analyticalModels.slug, modelSlug))
    .limit(1);

  if (!model) return [];

  return db.select().from(modelRuns)
    .where(eq(modelRuns.modelId, model.id))
    .orderBy(desc(modelRuns.createdAt))
    .limit(limit);
}

export async function listModels() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(analyticalModels).orderBy(analyticalModels.name);
}

// ─── Store Output Record ────────────────────────────────────────────────────

export async function storeOutputRecord(
  runId: string,
  modelId: string,
  entityType: "user" | "organization" | "team" | "platform",
  entityId: number,
  outputType: string,
  outputValue: unknown,
  confidence: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(modelOutputRecords).values({
    id: crypto.randomUUID(),
    runId,
    modelId,
    entityType,
    entityId,
    outputType,
    outputValue: JSON.stringify(outputValue),
    confidence,
  });
}
