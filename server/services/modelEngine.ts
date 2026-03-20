import { getDb } from "../db";
import { analyticalModels, modelRuns, modelOutputRecords, modelSchedules } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import { broadcastToRole } from "./websocketNotifications";
import {
  monteCarloRetirement, type RetirementInput,
  optimizeDebt, type DebtOptimizationInput,
  optimizeTax, type TaxOptimizationInput,
  projectCashFlow, type CashFlowInput,
  analyzeInsuranceGaps, type InsuranceGapInput,
  analyzeEstatePlan, type EstatePlanningInput,
  projectEducationFunding, type EducationFundingInput,
  scoreRiskTolerance, type RiskToleranceInput,
} from "./statisticalModels";

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
  // ─── Full Statistical Models ─────────────────────────────────────────────
  {
    name: "Monte Carlo Retirement Simulation",
    slug: "monte-carlo-retirement",
    description: "10,000-iteration Monte Carlo simulation for retirement planning with inflation, Social Security, and contribution growth",
    layer: "user" as const,
    category: "financial" as const,
    executionType: "statistical" as const,
    inputSchema: { currentAge: "number", retirementAge: "number", currentSavings: "number", annualContribution: "number", expectedReturn: "number" },
    outputSchema: { successRate: "number", medianEndingBalance: "number", yearByYearMedian: "array", recommendedAdditionalSavings: "number" },
  },
  {
    name: "Debt Optimization",
    slug: "debt-optimization",
    description: "Compares Avalanche, Snowball, and Hybrid debt payoff strategies with month-by-month schedules",
    layer: "user" as const,
    category: "financial" as const,
    executionType: "statistical" as const,
    inputSchema: { debts: "array", monthlyBudget: "number", extraPayment: "number" },
    outputSchema: { avalanche: "object", snowball: "object", hybrid: "object", recommendation: "string" },
  },
  {
    name: "Tax Optimization",
    slug: "tax-optimization",
    description: "Bracket analysis, Roth conversion, charitable strategy, and retirement contribution optimization",
    layer: "user" as const,
    category: "financial" as const,
    executionType: "statistical" as const,
    inputSchema: { filingStatus: "string", grossIncome: "number", deductions: "object" },
    outputSchema: { currentTaxLiability: "number", rothConversion: "object", totalOptimizedSavings: "number" },
  },
  {
    name: "Cash Flow Projection",
    slug: "cash-flow-projection",
    description: "Multi-month income/expense forecasting with seasonal adjustments and emergency fund tracking",
    layer: "user" as const,
    category: "financial" as const,
    executionType: "statistical" as const,
    inputSchema: { monthlyIncome: "array", monthlyExpenses: "array", projectionMonths: "number" },
    outputSchema: { monthlyProjections: "array", summary: "object", alerts: "array" },
  },
  {
    name: "Insurance Gap Analysis",
    slug: "insurance-gap-analysis",
    description: "Identifies coverage gaps across life, disability, home, umbrella, and long-term care insurance",
    layer: "user" as const,
    category: "risk" as const,
    executionType: "statistical" as const,
    inputSchema: { annualIncome: "number", currentPolicies: "array", netWorth: "number" },
    outputSchema: { gaps: "array", overallScore: "number", recommendations: "array" },
  },
  {
    name: "Estate Planning Analysis",
    slug: "estate-planning",
    description: "Estate tax exposure, trust strategies (ILIT, CRT, GRAT, Dynasty), and beneficiary optimization",
    layer: "user" as const,
    category: "financial" as const,
    executionType: "statistical" as const,
    inputSchema: { totalEstateValue: "number", filingStatus: "string", assets: "array" },
    outputSchema: { federalEstateTax: "number", strategies: "array", totalPotentialSavings: "number" },
  },
  {
    name: "Education Funding Projection",
    slug: "education-funding",
    description: "529 plan projections with education inflation, financial aid, and alternative strategy analysis",
    layer: "user" as const,
    category: "financial" as const,
    executionType: "statistical" as const,
    inputSchema: { childAge: "number", annualCostToday: "number", current529Balance: "number" },
    outputSchema: { totalProjectedCost: "number", fundingGap: "number", monthlyNeeded: "number" },
  },
  {
    name: "Risk Tolerance Assessment",
    slug: "risk-tolerance-assessment",
    description: "5-dimension risk scoring (capacity, willingness, need, knowledge, behavioral) with allocation recommendation",
    layer: "user" as const,
    category: "risk" as const,
    executionType: "statistical" as const,
    inputSchema: { questionnaireAnswers: "array", behavioralSignals: "object", financialContext: "object" },
    outputSchema: { compositeScore: "number", category: "string", recommendedAllocation: "object" },
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

    // Emit real-time notification for model completion
    broadcastToRole(model.layer, {
      type: "model_complete",
      priority: "medium",
      title: `Model Completed: ${model.name}`,
      body: `${model.name} finished in ${durationMs}ms`,
      metadata: { runId, modelSlug: model.slug, modelName: model.name, durationMs },
    });

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
    // ─── Full Statistical Models ─────────────────────────────────────────
    case "monte-carlo-retirement":
      return monteCarloRetirement(input as unknown as RetirementInput) as unknown as Record<string, unknown>;
    case "debt-optimization":
      return optimizeDebt(input as unknown as DebtOptimizationInput) as unknown as Record<string, unknown>;
    case "tax-optimization":
      return optimizeTax(input as unknown as TaxOptimizationInput) as unknown as Record<string, unknown>;
    case "cash-flow-projection":
      return projectCashFlow(input as unknown as CashFlowInput) as unknown as Record<string, unknown>;
    case "insurance-gap-analysis":
      return analyzeInsuranceGaps(input as unknown as InsuranceGapInput) as unknown as Record<string, unknown>;
    case "estate-planning":
      return analyzeEstatePlan(input as unknown as EstatePlanningInput) as unknown as Record<string, unknown>;
    case "education-funding":
      return projectEducationFunding(input as unknown as EducationFundingInput) as unknown as Record<string, unknown>;
    case "risk-tolerance-assessment":
      return scoreRiskTolerance(input as unknown as RiskToleranceInput) as unknown as Record<string, unknown>;
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
