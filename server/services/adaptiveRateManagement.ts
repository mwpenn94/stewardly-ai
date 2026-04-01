/**
 * Adaptive Rate Management — Phase J
 * 
 * AI-driven rate probing, onboarding analysis, extraction planning,
 * rate recommendation engine, and data value scoring.
 */

import { getDb } from "../db";
import { eq, and, sql, desc } from "drizzle-orm";
import { logger } from "../_core/logger";
import {
  probeResults, integrationAnalysisLog, extractionPlans, extractionPlanJobs,
  rateRecommendations, dataValueScores, rateProfiles, rateSignalLog,
} from "../../drizzle/schema";
import { contextualLLM } from "../shared/intelligence/sovereignWiring"

// ─── DB HELPER ──────────────────────────────────────────────────────────

async function db() {
  const instance = await getDb();
  if (!instance) throw new Error("Database not available");
  return instance;
}

// ═══════════════════════════════════════════════════════════════════════
// Rate Probing — Discover actual API rate limits via controlled testing
// ═══════════════════════════════════════════════════════════════════════

export interface ProbeConfig {
  domain: string;
  provider: string;
  testEndpoint: string;
  startRpm: number;
  maxRpm: number;
  stepSize: number;
  safetyFactor: number;
}

export interface ProbeResultData {
  domain: string;
  provider: string;
  discoveredMaxRpm: number;
  recommendedRpm: number;
  probeMethod: string;
  httpStatusPattern: string;
  headerSignals: Record<string, string>;
  confidence: number;
  probeLatencyMs: number;
}

export async function runRateProbe(config: ProbeConfig): Promise<ProbeResultData> {
  const startTime = Date.now();
  let lastSuccessRpm = config.startRpm;
  let httpStatusPattern = "";
  const headerSignals: Record<string, string> = {};

  // Binary search for rate limit
  let low = config.startRpm;
  let high = config.maxRpm;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const testResult = await probeAtRate(config.domain, config.testEndpoint);

    if (testResult.success) {
      lastSuccessRpm = mid;
      low = mid + 1;
      if (testResult.headers["x-ratelimit-limit"]) {
        headerSignals["x-ratelimit-limit"] = testResult.headers["x-ratelimit-limit"];
      }
      if (testResult.headers["retry-after"]) {
        headerSignals["retry-after"] = testResult.headers["retry-after"];
      }
    } else {
      high = mid - 1;
      httpStatusPattern = `${testResult.statusCode}`;
    }
  }

  const discoveredMax = lastSuccessRpm;
  const recommendedRpm = Math.floor(discoveredMax * config.safetyFactor);
  const confidence = discoveredMax > config.startRpm ? 0.85 : 0.5;
  const probeLatencyMs = Date.now() - startTime;

  // Save to DB — matches actual schema: domain, batchesCompleted, firstThrottleBatch, discoveredRpm, confidence, rawLog
  try {
    const d = await db();
    await d.insert(probeResults).values({
      domain: config.domain,
      batchesCompleted: Math.ceil((config.maxRpm - config.startRpm) / config.stepSize),
      firstThrottleBatch: discoveredMax < config.maxRpm ? Math.ceil((discoveredMax - config.startRpm) / config.stepSize) : null,
      discoveredRpm: discoveredMax,
      confidence: String(confidence),
      rawLog: { provider: config.provider, recommendedRpm, httpStatusPattern, headerSignals, probeLatencyMs },
    });
  } catch (e) {
    logger.error( { operation: "probe", err: e },"[Probe] Failed to save result:", e);
  }

  return {
    domain: config.domain,
    provider: config.provider,
    discoveredMaxRpm: discoveredMax,
    recommendedRpm,
    probeMethod: "binary_search",
    httpStatusPattern,
    headerSignals,
    confidence,
    probeLatencyMs,
  };
}

async function probeAtRate(domain: string, endpoint: string): Promise<{
  success: boolean;
  statusCode: number;
  headers: Record<string, string>;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`https://${domain}${endpoint}`, {
      signal: controller.signal,
      headers: { "User-Agent": "Stewardly/1.0 (Rate Probe)" },
    });
    clearTimeout(timeout);

    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => { headers[k] = v; });

    return { success: response.status < 429, statusCode: response.status, headers };
  } catch {
    return { success: false, statusCode: 0, headers: {} };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// AI Onboarding Analysis — Analyze new integrations for optimal config
// ═══════════════════════════════════════════════════════════════════════

export interface OnboardingAnalysis {
  provider: string;
  suggestedRpm: number;
  suggestedDailyBudget: number;
  dataCategories: string[];
  estimatedValueScore: number;
  riskLevel: "low" | "medium" | "high";
  recommendations: string[];
  complianceNotes: string[];
}

export async function analyzeNewIntegration(
  provider: string,
  domain: string,
  docsUrl?: string,
  category?: string
): Promise<OnboardingAnalysis> {
  try {
    const response = await contextualLLM({ userId: null, contextType: "analysis",
      messages: [
        {
          role: "system",
          content: `You are a data integration analyst for a financial services platform. Analyze the following API provider and return a JSON object with optimal configuration recommendations.`
        },
        {
          role: "user",
          content: `Analyze this API integration:
Provider: ${provider}
Domain: ${domain}
Documentation: ${docsUrl || "N/A"}
Category: ${category || "unknown"}

Return JSON with: suggestedRpm (number), suggestedDailyBudget (number), dataCategories (string[]), estimatedValueScore (0-100), riskLevel ("low"|"medium"|"high"), recommendations (string[]), complianceNotes (string[])`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "onboarding_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestedRpm: { type: "integer" },
              suggestedDailyBudget: { type: "integer" },
              dataCategories: { type: "array", items: { type: "string" } },
              estimatedValueScore: { type: "integer" },
              riskLevel: { type: "string", enum: ["low", "medium", "high"] },
              recommendations: { type: "array", items: { type: "string" } },
              complianceNotes: { type: "array", items: { type: "string" } },
            },
            required: ["suggestedRpm", "suggestedDailyBudget", "dataCategories", "estimatedValueScore", "riskLevel", "recommendations", "complianceNotes"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

    // Log analysis — matches actual schema: sourceUrl, domain, robotsTxt, rateHeadersFound, sourceClassification, aiRecommendation
    try {
      const d = await db();
      await d.insert(integrationAnalysisLog).values({
        sourceUrl: docsUrl || `https://${domain}`,
        domain,
        robotsTxt: null,
        rateHeadersFound: null,
        sourceClassification: category || "api",
        aiRecommendation: parsed,
      });
    } catch { /* non-critical */ }

    return { provider, ...parsed };
  } catch {
    return {
      provider,
      suggestedRpm: 10,
      suggestedDailyBudget: 500,
      dataCategories: [category || "general"],
      estimatedValueScore: 50,
      riskLevel: "medium",
      recommendations: [
        "Start with conservative rate limits",
        "Monitor error rates for first 48 hours",
        "Verify API key permissions match required scopes",
      ],
      complianceNotes: [
        "Ensure data handling complies with SOC 2 requirements",
        "Review provider's data retention policies",
      ],
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Extraction Planner — AI-driven data extraction strategy
// ═══════════════════════════════════════════════════════════════════════

export interface ExtractionPlanConfig {
  planName: string;
  planType: "initial_seed" | "scheduled_refresh" | "on_demand" | "ai_suggested";
  provider: string;
  targetDataCategories: string[];
  availableEndpoints: string[];
  dailyBudget: number;
  priority: "critical" | "high" | "medium" | "low";
}

export interface ExtractionStep {
  order: number;
  endpoint: string;
  method: string;
  frequency: string;
  estimatedRecords: number;
  dependsOn: number[];
}

export interface ExtractionPlanResult {
  planId: number;
  provider: string;
  steps: ExtractionStep[];
  estimatedDurationHours: number;
  totalRecords: number;
  priority: string;
}

export async function createExtractionPlan(config: ExtractionPlanConfig): Promise<ExtractionPlanResult> {
  const steps: ExtractionStep[] = config.availableEndpoints.map((endpoint, i) => ({
    order: i + 1,
    endpoint,
    method: "GET",
    frequency: config.priority === "critical" ? "hourly" : config.priority === "high" ? "daily" : "weekly",
    estimatedRecords: Math.floor(config.dailyBudget / config.availableEndpoints.length),
    dependsOn: i > 0 ? [i] : [],
  }));

  const totalRecords = steps.reduce((sum, s) => sum + s.estimatedRecords, 0);
  const estimatedDurationHours = config.priority === "critical" ? 1 : 24;

  // Save plan — matches actual schema: planName, planType, totalRecords, estimatedDurationHours, planJson, status
  let planId = 0;
  try {
    const d = await db();
    const result = await d.insert(extractionPlans).values({
      planName: config.planName,
      planType: config.planType,
      totalRecords,
      estimatedDurationHours: String(estimatedDurationHours),
      planJson: { provider: config.provider, steps, targetCategories: config.targetDataCategories },
      status: "draft",
    });
    planId = result[0]?.insertId || 0;
  } catch (e) {
    logger.error( { operation: "extractionPlan", err: e },"[ExtractionPlan] Failed to save:", e);
  }

  return { planId, provider: config.provider, steps, estimatedDurationHours, totalRecords, priority: config.priority };
}

export async function executeExtractionStep(
  planId: number,
  stepOrder: number,
  provider: string,
  executor: (endpoint: string) => Promise<{ records: number; success: boolean }>
): Promise<{ success: boolean; records: number; error?: string }> {
  try {
    const d = await db();
    const [plan] = await d.select().from(extractionPlans)
      .where(eq(extractionPlans.id, planId)).limit(1);

    if (!plan) throw new Error("Plan not found");

    const planData = plan.planJson as { steps?: ExtractionStep[] };
    const steps = planData?.steps || [];
    const step = steps.find((s: ExtractionStep) => s.order === stepOrder);
    if (!step) throw new Error("Step not found");

    const result = await executor(step.endpoint);

    // Log job — matches actual schema: planId, provider, jobType, recordsCompleted, status
    await d.insert(extractionPlanJobs).values({
      planId,
      provider,
      jobType: `step_${stepOrder}`,
      recordsTarget: step.estimatedRecords,
      recordsCompleted: result.records,
      status: result.success ? "completed" : "failed",
    });

    return { success: result.success, records: result.records };
  } catch (e: any) {
    return { success: false, records: 0, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Rate Recommender — AI-driven rate limit recommendations
// ═══════════════════════════════════════════════════════════════════════

export async function generateRateRecommendation(provider: string): Promise<{
  recommendationId: number;
  currentRpm: number;
  suggestedRpm: number;
  reason: string;
  confidence: number;
}> {
  const d = await db();

  // Get current profile
  const [profile] = await d.select().from(rateProfiles)
    .where(eq(rateProfiles.provider, provider)).limit(1);

  if (!profile) {
    return { recommendationId: 0, currentRpm: 0, suggestedRpm: 10, reason: "No profile found", confidence: 0.5 };
  }

  // Get recent signals
  const signals = await d.select().from(rateSignalLog)
    .where(eq(rateSignalLog.provider, provider))
    .orderBy(desc(rateSignalLog.createdAt))
    .limit(50);

  // Analyze signals
  const throttleSignals = signals.filter(s => s.signalType === "http_429" || s.signalType === "rate_limit_header");
  const totalSignals = signals.length;

  let suggestedRpm = profile.currentRpm || 10;
  let reason = "";
  let confidence = 0.7;

  if (totalSignals > 0 && throttleSignals.length > totalSignals * 0.3) {
    suggestedRpm = Math.max(1, Math.floor((profile.currentRpm || 10) * 0.7));
    reason = `High throttle rate (${throttleSignals.length}/${totalSignals} signals). Reducing RPM by 30%.`;
    confidence = 0.9;
  } else if (totalSignals > 10 && throttleSignals.length === 0) {
    suggestedRpm = Math.min(
      profile.staticMaximum || 60,
      Math.floor((profile.currentRpm || 10) * 1.2)
    );
    reason = `Zero throttle signals in ${totalSignals} recent calls. Increasing RPM by 20%.`;
    confidence = 0.8;
  } else {
    reason = "Current rate appears optimal. No change recommended.";
    suggestedRpm = profile.currentRpm || 10;
  }

  // Save recommendation — matches actual schema: provider, recommendationType, recommendationJson, confidence, status
  let recommendationId = 0;
  try {
    const result = await d.insert(rateRecommendations).values({
      provider,
      recommendationType: "rate_adjustment",
      recommendationJson: { currentRpm: profile.currentRpm, suggestedRpm, reason },
      confidence: String(confidence),
      status: "pending_review",
    });
    recommendationId = result[0]?.insertId || 0;
  } catch (e) {
    logger.error( { operation: "rateRecommender", err: e },"[RateRecommender] Failed to save:", e);
  }

  return { recommendationId, currentRpm: profile.currentRpm || 10, suggestedRpm, reason, confidence };
}

export async function applyRecommendation(recommendationId: number): Promise<boolean> {
  const d = await db();

  const [rec] = await d.select().from(rateRecommendations)
    .where(eq(rateRecommendations.id, recommendationId)).limit(1);

  if (!rec || rec.status !== "pending_review") return false;

  const recData = rec.recommendationJson as { suggestedRpm?: number };
  if (!recData?.suggestedRpm) return false;

  // Apply the rate change
  await d.update(rateProfiles)
    .set({ currentRpm: recData.suggestedRpm })
    .where(eq(rateProfiles.provider, rec.provider));

  // Mark as applied
  await d.update(rateRecommendations)
    .set({ status: "applied", appliedAt: new Date() })
    .where(eq(rateRecommendations.id, recommendationId));

  return true;
}

export async function dismissRecommendation(recommendationId: number): Promise<boolean> {
  const d = await db();
  await d.update(rateRecommendations)
    .set({ status: "rejected" })
    .where(eq(rateRecommendations.id, recommendationId));
  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// Data Value Scoring — Prioritize data refresh based on usage value
// ═══════════════════════════════════════════════════════════════════════

export interface DataValueInput {
  provider: string;
  recordId: string;
  queryCount: number;
  uniqueUsers: number;
  avgResponseTime: number;
  lastAccessed: Date;
  dataAge: number; // hours since last refresh
  dependentFeatures: string[];
}

export function calculateDataValueScore(input: DataValueInput): {
  score: number;
  refreshPriority: "critical" | "high" | "normal" | "low" | "dormant";
  factors: Record<string, number>;
} {
  const factors: Record<string, number> = {};

  // Usage frequency (0-30 points)
  factors.usageFrequency = Math.min(30, input.queryCount * 0.3);

  // User breadth (0-20 points)
  factors.userBreadth = Math.min(20, input.uniqueUsers * 2);

  // Data freshness penalty (0-20 points)
  factors.stalenessPenalty = Math.min(20, (input.dataAge / 24) * 5);

  // Feature dependency (0-20 points)
  factors.featureDependency = Math.min(20, input.dependentFeatures.length * 5);

  // Response time bonus (0-10 points)
  factors.responseTimeBonus = input.avgResponseTime < 500 ? 10 : input.avgResponseTime < 2000 ? 5 : 0;

  const score = Object.values(factors).reduce((sum, v) => sum + v, 0);

  let refreshPriority: "critical" | "high" | "normal" | "low" | "dormant";
  if (score >= 70) refreshPriority = "critical";
  else if (score >= 50) refreshPriority = "high";
  else if (score >= 30) refreshPriority = "normal";
  else if (score >= 10) refreshPriority = "low";
  else refreshPriority = "dormant";

  return { score: Math.round(score), refreshPriority, factors };
}

export async function scoreAndSaveDataValue(input: DataValueInput): Promise<{
  score: number;
  refreshPriority: string;
}> {
  const { score, refreshPriority } = calculateDataValueScore(input);

  try {
    const d = await db();
    // Matches actual schema: provider, recordId, currentScore, refreshPriority, lastScoredAt
    await d.insert(dataValueScores).values({
      provider: input.provider,
      recordId: input.recordId,
      currentScore: String(score),
      refreshPriority,
      lastScoredAt: new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        currentScore: String(score),
        refreshPriority,
        lastScoredAt: new Date(),
      },
    });
  } catch (e) {
    logger.error( { operation: "dataValueScoring", err: e },"[DataValueScoring] Failed to save:", e);
  }

  return { score, refreshPriority };
}

export async function getRefreshQueue(): Promise<Array<{
  provider: string;
  recordId: string;
  score: string | null;
  refreshPriority: string | null;
}>> {
  try {
    const d = await db();
    return d.select({
      provider: dataValueScores.provider,
      recordId: dataValueScores.recordId,
      score: dataValueScores.currentScore,
      refreshPriority: dataValueScores.refreshPriority,
    }).from(dataValueScores)
      .where(sql`refresh_priority IN ('critical', 'high')`)
      .orderBy(desc(dataValueScores.currentScore))
      .limit(50);
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Stats for Admin Dashboard
// ═══════════════════════════════════════════════════════════════════════

export async function getAdaptiveRateStats(): Promise<{
  totalProbes: number;
  pendingRecommendations: number;
  activePlans: number;
  highValueRecords: number;
}> {
  try {
    const d = await db();
    const [probeCount] = await d.select({ count: sql<number>`COUNT(*)` }).from(probeResults);
    const [recCount] = await d.select({ count: sql<number>`COUNT(*)` }).from(rateRecommendations)
      .where(eq(rateRecommendations.status, "pending_review"));
    const [planCount] = await d.select({ count: sql<number>`COUNT(*)` }).from(extractionPlans)
      .where(eq(extractionPlans.status, "running"));
    const [valueCount] = await d.select({ count: sql<number>`COUNT(*)` }).from(dataValueScores)
      .where(sql`refresh_priority IN ('critical', 'high')`);

    return {
      totalProbes: Number(probeCount?.count || 0),
      pendingRecommendations: Number(recCount?.count || 0),
      activePlans: Number(planCount?.count || 0),
      highValueRecords: Number(valueCount?.count || 0),
    };
  } catch {
    return { totalProbes: 0, pendingRecommendations: 0, activePlans: 0, highValueRecords: 0 };
  }
}
