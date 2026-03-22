/**
 * Reg BI Documentation Generator (1D) + COI Disclosure (1E) + Report Builder (1F)
 * Model Card (2A) + Fairness Testing (2C) + Performance Monitoring (2D) + Recommendation Explanations (2E)
 */
import { getDb } from "../db";
import { coiDisclosures, recommendationsLog, modelCards, performanceMetrics, reportTemplates, reportJobs } from "../../drizzle/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm"
import { contextualLLM } from "./contextualLLM";

// ═══════════════════════════════════════════════════════════════════════════
// 1D: Reg BI Documentation Generator
// ═══════════════════════════════════════════════════════════════════════════
export interface RegBIDocument {
  clientId: number;
  advisorId: number;
  recommendationType: string;
  productName: string;
  reasonableBasis: string;
  customerSpecificBasis: string;
  quantitativeAnalysis: string;
  conflictsDisclosed: string[];
  alternativesConsidered: string[];
  costAnalysis: string;
  generatedAt: number;
}

export async function generateRegBIDocumentation(params: {
  userId: number;
  clientId: number;
  productId: number;
  recommendationSummary: string;
  clientProfile: Record<string, unknown>;
}): Promise<RegBIDocument> {
  const response = await contextualLLM({ userId: userId, contextType: "compliance",
    messages: [
      { role: "system", content: `You are a Reg BI compliance documentation specialist. Generate comprehensive Regulation Best Interest documentation for a financial product recommendation. Include: reasonable basis, customer-specific basis, quantitative analysis, conflicts, alternatives, and cost analysis. Return JSON.` },
      { role: "user", content: `Generate Reg BI documentation for: ${JSON.stringify(params)}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "reg_bi_doc",
        strict: true,
        schema: {
          type: "object",
          properties: {
            reasonableBasis: { type: "string" },
            customerSpecificBasis: { type: "string" },
            quantitativeAnalysis: { type: "string" },
            conflictsDisclosed: { type: "array", items: { type: "string" } },
            alternativesConsidered: { type: "array", items: { type: "string" } },
            costAnalysis: { type: "string" },
          },
          required: ["reasonableBasis", "customerSpecificBasis", "quantitativeAnalysis", "conflictsDisclosed", "alternativesConsidered", "costAnalysis"],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(response.choices[0].message.content as string);
  return {
    clientId: params.clientId,
    advisorId: params.userId,
    recommendationType: "product",
    productName: `Product ${params.productId}`,
    ...parsed,
    generatedAt: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1E: Conflict of Interest Disclosure
// ═══════════════════════════════════════════════════════════════════════════
export async function createCOIDisclosure(params: {
  userId: number;
  advisorId?: number;
  orgId?: number;
  disclosureType: "compensation" | "affiliation" | "ownership" | "referral" | "other";
  description: string;
  relatedProductId?: number;
  severity: "low" | "medium" | "high";
}) {
  const db = (await getDb())!;
  const [result] = await db.insert(coiDisclosures).values({
    userId: params.userId,
    advisorId: params.advisorId,
    orgId: params.orgId,
    disclosureType: params.disclosureType,
    description: params.description,
    relatedProductId: params.relatedProductId,
    severity: params.severity,
    status: "pending",
  });
  return { id: (result as any).insertId, status: "pending" };
}

export async function listCOIDisclosures(userId: number) {
  const db = (await getDb())!;
  return db.select().from(coiDisclosures).where(eq(coiDisclosures.userId, userId)).orderBy(desc(coiDisclosures.createdAt));
}

export async function acknowledgeCOI(disclosureId: number) {
  const db = (await getDb())!;
  await db.update(coiDisclosures).set({ status: "acknowledged", acknowledgedAt: new Date() }).where(eq(coiDisclosures.id, disclosureId));
}

export async function detectConflicts(userId: number, productId: number): Promise<Array<{ type: string; severity: string; description: string }>> {
  // AI-powered conflict detection
  const response = await contextualLLM({ userId: userId, contextType: "compliance",
    messages: [
      { role: "system", content: "You are a compliance officer. Identify potential conflicts of interest for a financial product recommendation. Return JSON array of {type, severity, description}." },
      { role: "user", content: `Check for conflicts: advisor ${userId}, product ${productId}` },
    ],
  });
  try {
    return JSON.parse(response.choices[0].message.content as string);
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1F: Branded Report Builder
// ═══════════════════════════════════════════════════════════════════════════
export async function createReportTemplate(params: {
  orgId?: number;
  name: string;
  category: string;
  templateBody: string;
  sections?: unknown;
  branding?: unknown;
  createdBy: number;
}) {
  const db = (await getDb())!;
  const [result] = await db.insert(reportTemplates).values({
    orgId: params.orgId,
    name: params.name,
    category: params.category as any,
    templateBody: params.templateBody,
    sections: params.sections as any,
    branding: params.branding as any,
    createdBy: params.createdBy,
  });
  return { id: (result as any).insertId };
}

export async function listReportTemplates(orgId?: number) {
  const db = (await getDb())!;
  if (orgId) {
    return db.select().from(reportTemplates).where(eq(reportTemplates.orgId, orgId)).orderBy(desc(reportTemplates.createdAt));
  }
  return db.select().from(reportTemplates).orderBy(desc(reportTemplates.createdAt));
}

export async function generateReport(params: {
  userId: number;
  orgId?: number;
  templateId: number;
  clientId?: number;
  parameters?: Record<string, unknown>;
}) {
  const db = (await getDb())!;
  const [result] = await db.insert(reportJobs).values({
    userId: params.userId,
    orgId: params.orgId,
    templateId: params.templateId,
    clientId: params.clientId,
    parameters: params.parameters as any,
    status: "pending",
  });
  const jobId = (result as any).insertId;

  // Async generation — mark as generating
  await db.update(reportJobs).set({ status: "generating", startedAt: new Date() }).where(eq(reportJobs.id, jobId));

  try {
    // Fetch template
    const [template] = await db.select().from(reportTemplates).where(eq(reportTemplates.id, params.templateId));
    if (!template) throw new Error("Template not found");

    // Generate report content via LLM
    const response = await contextualLLM({ userId: userId, contextType: "compliance",
      messages: [
        { role: "system", content: `You are a financial report generator. Generate a professional report based on the template and parameters provided. Use HTML format.` },
        { role: "user", content: `Template: ${template.templateBody}\nParameters: ${JSON.stringify(params.parameters)}` },
      ],
    });

    const content = response.choices[0].message.content as string;
    const { storagePut } = await import("../storage");
    const { url } = await storagePut(`reports/${params.userId}/${jobId}.html`, Buffer.from(content), "text/html");

    await db.update(reportJobs).set({ status: "completed", outputUrl: url, completedAt: new Date() }).where(eq(reportJobs.id, jobId));
    return { jobId, status: "completed", url };
  } catch (error: any) {
    await db.update(reportJobs).set({ status: "failed", errorMessage: error.message }).where(eq(reportJobs.id, jobId));
    return { jobId, status: "failed", error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2A: Model Card + AI Documentation
// ═══════════════════════════════════════════════════════════════════════════
export async function createModelCard(params: {
  modelName: string;
  version: string;
  description: string;
  intendedUse: string;
  limitations: string;
  trainingDataSummary: string;
  performanceMetrics: Record<string, unknown>;
  fairnessMetrics: Record<string, unknown>;
  ethicalConsiderations: string;
  createdBy: number;
}) {
  const db = (await getDb())!;
  const [result] = await db.insert(modelCards).values({
    modelName: params.modelName,
    version: params.version,
    description: params.description,
    intendedUse: params.intendedUse,
    limitations: params.limitations,
    trainingDataSummary: params.trainingDataSummary,
    performanceMetrics: params.performanceMetrics,
    fairnessMetrics: params.fairnessMetrics,
    ethicalConsiderations: params.ethicalConsiderations,
    createdBy: params.createdBy,
  });
  return { id: (result as any).insertId };
}

export async function listModelCards() {
  const db = (await getDb())!;
  return db.select().from(modelCards).orderBy(desc(modelCards.createdAt));
}

export async function getModelCard(id: number) {
  const db = (await getDb())!;
  const [card] = await db.select().from(modelCards).where(eq(modelCards.id, id));
  return card || null;
}

export async function publishModelCard(id: number) {
  const db = (await getDb())!;
  await db.update(modelCards).set({ published: true, lastEvaluatedAt: new Date() }).where(eq(modelCards.id, id));
}

// ═══════════════════════════════════════════════════════════════════════════
// 2D: Performance Monitoring Dashboard
// ═══════════════════════════════════════════════════════════════════════════
export async function recordMetric(params: {
  metricName: string;
  metricCategory: "latency" | "throughput" | "error_rate" | "availability" | "ai_quality" | "user_satisfaction";
  value: number;
  unit?: string;
  tags?: Record<string, unknown>;
  slaTarget?: number;
}) {
  const db = (await getDb())!;
  const slaMet = params.slaTarget ? params.value <= params.slaTarget : undefined;
  await db.insert(performanceMetrics).values({
    metricName: params.metricName,
    metricCategory: params.metricCategory,
    value: params.value,
    unit: params.unit,
    tags: params.tags as any,
    slaTarget: params.slaTarget,
    slaMet: slaMet,
  });
}

export async function getMetricsSummary(category?: string, since?: Date) {
  const db = (await getDb())!;
  const conditions = [];
  if (category) conditions.push(eq(performanceMetrics.metricCategory, category as any));
  if (since) conditions.push(gte(performanceMetrics.recordedAt, since));

  const metrics = conditions.length > 0
    ? await db.select().from(performanceMetrics).where(and(...conditions)).orderBy(desc(performanceMetrics.recordedAt)).limit(1000)
    : await db.select().from(performanceMetrics).orderBy(desc(performanceMetrics.recordedAt)).limit(1000);

  // Aggregate by metric name
  const grouped: Record<string, { avg: number; min: number; max: number; count: number; slaMet: number }> = {};
  for (const m of metrics) {
    if (!grouped[m.metricName]) grouped[m.metricName] = { avg: 0, min: Infinity, max: -Infinity, count: 0, slaMet: 0 };
    const g = grouped[m.metricName];
    g.avg += m.value;
    g.min = Math.min(g.min, m.value);
    g.max = Math.max(g.max, m.value);
    g.count++;
    if (m.slaMet) g.slaMet++;
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].avg /= grouped[key].count;
  }
  return grouped;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2E: Structured Recommendation Explanations
// ═══════════════════════════════════════════════════════════════════════════
export async function logRecommendation(params: {
  userId: number;
  advisorId?: number;
  conversationId?: number;
  messageId?: number;
  productId?: number;
  recommendationType: "product" | "strategy" | "action" | "allocation" | "rebalance";
  summary: string;
  reasoning: string;
  factors: Record<string, unknown>;
  confidenceScore: number;
  suitabilityScore: number;
  riskLevel: "low" | "medium" | "high" | "very_high";
  disclaimers: string[];
}) {
  const db = (await getDb())!;
  const [result] = await db.insert(recommendationsLog).values({
    userId: params.userId,
    advisorId: params.advisorId,
    conversationId: params.conversationId,
    messageId: params.messageId,
    productId: params.productId,
    recommendationType: params.recommendationType,
    summary: params.summary,
    reasoning: params.reasoning,
    factors: params.factors,
    confidenceScore: params.confidenceScore,
    suitabilityScore: params.suitabilityScore,
    riskLevel: params.riskLevel,
    disclaimers: params.disclaimers,
    status: "suggested",
  });
  return { id: (result as any).insertId };
}

export async function getRecommendationExplanation(recommendationId: number) {
  const db = (await getDb())!;
  const [rec] = await db.select().from(recommendationsLog).where(eq(recommendationsLog.id, recommendationId));
  if (!rec) return null;

  // Generate human-readable explanation
  const response = await contextualLLM({ userId: userId, contextType: "compliance",
    messages: [
      { role: "system", content: "You are a financial advisor explanation generator. Create a clear, client-friendly explanation of why this recommendation was made. Include the reasoning, key factors, risk considerations, and relevant disclaimers." },
      { role: "user", content: `Explain this recommendation: ${JSON.stringify({ summary: rec.summary, reasoning: rec.reasoning, factors: rec.factors, riskLevel: rec.riskLevel, confidenceScore: rec.confidenceScore })}` },
    ],
  });

  return {
    ...rec,
    humanExplanation: response.choices[0].message.content,
  };
}

export async function listRecommendations(userId: number, limit = 50) {
  const db = (await getDb())!;
  return db.select().from(recommendationsLog).where(eq(recommendationsLog.userId, userId)).orderBy(desc(recommendationsLog.createdAt)).limit(limit);
}

export async function updateRecommendationStatus(id: number, status: "accepted" | "rejected" | "implemented" | "expired") {
  const db = (await getDb())!;
  await db.update(recommendationsLog).set({ status }).where(eq(recommendationsLog.id, id));
}
