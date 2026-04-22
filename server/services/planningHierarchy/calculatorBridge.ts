/**
 * Calculator → Planning Node Bridge
 * 
 * Wires Wealth Engine calculator outputs into the unified planning hierarchy.
 * When a calculator run completes, this bridge:
 *   1. Finds or creates the appropriate planning node for the calculator domain
 *   2. Stores the calculator output as the node's currentValue / metadata
 *   3. Triggers roll-up recalculation to parent nodes
 *   4. Attaches reasoning and references from the calculator context
 *
 * Supports: retirement, tax, estate, protection, business valuation,
 * income projection, social security, medicare, insurance analysis
 */
import { getDb } from "../../db";
import {
  planningNodes,
  planningReferences,
  type InsertPlanningNode,
} from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import * as phDb from "./db";

// ─── CALCULATOR DOMAIN MAPPING ─────────────────────────────────────────
export type CalculatorDomain =
  | "retirement"
  | "tax"
  | "estate"
  | "protection"
  | "business_valuation"
  | "income_projection"
  | "social_security"
  | "medicare"
  | "insurance_analysis"
  | "holistic_comparison"
  | "monte_carlo"
  | "sensitivity"
  | "business_income"
  | "premium_finance"
  | "quick_bundle";

interface DomainConfig {
  nodeLevel: "strategy" | "implementation";
  defaultLabel: string;
  parentDomain?: string; // If set, this node nests under the parent domain node
  referenceType: "regulatory" | "market_data" | "illustration" | "internal";
}

const DOMAIN_CONFIG: Record<CalculatorDomain, DomainConfig> = {
  retirement: {
    nodeLevel: "strategy",
    defaultLabel: "Retirement Strategy",
    referenceType: "illustration",
  },
  tax: {
    nodeLevel: "strategy",
    defaultLabel: "Tax Strategy",
    referenceType: "regulatory",
  },
  estate: {
    nodeLevel: "strategy",
    defaultLabel: "Estate Plan",
    referenceType: "regulatory",
  },
  protection: {
    nodeLevel: "strategy",
    defaultLabel: "Protection Strategy",
    referenceType: "illustration",
  },
  business_valuation: {
    nodeLevel: "strategy",
    defaultLabel: "Business Valuation",
    referenceType: "market_data",
  },
  income_projection: {
    nodeLevel: "implementation",
    defaultLabel: "Income Projection",
    parentDomain: "retirement",
    referenceType: "illustration",
  },
  social_security: {
    nodeLevel: "implementation",
    defaultLabel: "Social Security Optimization",
    parentDomain: "retirement",
    referenceType: "regulatory",
  },
  medicare: {
    nodeLevel: "implementation",
    defaultLabel: "Medicare Planning",
    parentDomain: "retirement",
    referenceType: "regulatory",
  },
  insurance_analysis: {
    nodeLevel: "implementation",
    defaultLabel: "Insurance Analysis",
    parentDomain: "protection",
    referenceType: "illustration",
  },
  holistic_comparison: {
    nodeLevel: "strategy",
    defaultLabel: "Holistic Comparison",
    referenceType: "internal",
  },
  monte_carlo: {
    nodeLevel: "implementation",
    defaultLabel: "Monte Carlo Simulation",
    parentDomain: "retirement",
    referenceType: "illustration",
  },
  sensitivity: {
    nodeLevel: "implementation",
    defaultLabel: "Sensitivity Analysis",
    referenceType: "internal",
  },
  business_income: {
    nodeLevel: "implementation",
    defaultLabel: "Business Income Projection",
    parentDomain: "business_valuation",
    referenceType: "market_data",
  },
  premium_finance: {
    nodeLevel: "implementation",
    defaultLabel: "Premium Finance Analysis",
    parentDomain: "protection",
    referenceType: "illustration",
  },
  quick_bundle: {
    nodeLevel: "strategy",
    defaultLabel: "Quick Bundle Strategy",
    referenceType: "illustration",
  },
};

// ─── CORE BRIDGE FUNCTION ──────────────────────────────────────────────
export interface CalculatorBridgeInput {
  domain: CalculatorDomain;
  userId: number;
  clientId?: number;
  runId: string;
  calculatorOutput: Record<string, unknown>;
  assumptions?: Record<string, unknown>;
  reasoning?: string;
  references?: Array<{
    title: string;
    citation?: string;
    url?: string;
    refType?: string;
  }>;
  label?: string;
}

export interface CalculatorBridgeResult {
  planningNodeId: number;
  parentNodeId: number | null;
  isNew: boolean;
  rollUpTriggered: boolean;
}

/**
 * Bridge a calculator output into the planning hierarchy.
 * Idempotent: if a node for this domain+entity already exists, it updates it.
 */
export async function bridgeCalculatorToPlanning(
  input: CalculatorBridgeInput
): Promise<CalculatorBridgeResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const config = DOMAIN_CONFIG[input.domain];
  if (!config) throw new Error(`Unknown calculator domain: ${input.domain}`);

  const entityType = input.clientId ? "client" : "user";
  const entityId = input.clientId ?? input.userId;

  // 1. Find or create the parent node (if this domain nests under another)
  let parentNodeId: number | null = null;
  if (config.parentDomain) {
    const parentConfig = DOMAIN_CONFIG[config.parentDomain as CalculatorDomain];
    if (parentConfig) {
      parentNodeId = await findOrCreateDomainNode(
        db,
        config.parentDomain,
        parentConfig,
        entityType,
        entityId,
        input.userId
      );
    }
  }

  // 2. Find or create this domain's node
  const existingNodes = await db
    .select()
    .from(planningNodes)
    .where(
      and(
        eq(planningNodes.entityType, entityType),
        eq(planningNodes.entityId, entityId),
        eq(planningNodes.label, input.label || config.defaultLabel)
      )
    )
    .limit(1);

  let nodeId: number;
  let isNew = false;

  if (existingNodes.length > 0) {
    // Update existing node with new calculator output
    nodeId = existingNodes[0].id;
    await phDb.updatePlanningNode(nodeId, {
      currentValue: extractPrimaryValue(input.calculatorOutput, input.domain),
      // @ts-expect-error — excess property in object literal
      metadata: {
        calculatorDomain: input.domain,
        runId: input.runId,
        output: input.calculatorOutput,
        assumptions: input.assumptions,
        lastUpdated: new Date().toISOString(),
      } as any,
    });
  } else {
    // Create new planning node
    isNew = true;
    const nodeData: InsertPlanningNode = {
      ownerId: input.userId,
      parentId: parentNodeId,
      level: config.nodeLevel,
      entityType,
      entityId,
      label: input.label || config.defaultLabel,
      currentValue: extractPrimaryValue(input.calculatorOutput, input.domain),
      // @ts-expect-error — excess property in object literal
      targetValue: null,
      timeHorizonMonths: extractTimeHorizon(input.calculatorOutput),
      metadata: {
        calculatorDomain: input.domain,
        runId: input.runId,
        output: input.calculatorOutput,
        assumptions: input.assumptions,
        lastUpdated: new Date().toISOString(),
      } as any,
    };
    nodeId = await phDb.createPlanningNode(nodeData);
  }

  // 3. Attach reasoning as a reference if provided
  if (input.reasoning) {
    await phDb.addReference({
      planningNodeId: nodeId,
      refType: "internal",
      title: `${config.defaultLabel} — AI Reasoning`,
      citation: input.reasoning,
      dateAccessed: new Date().toISOString(),
    } as any);
  }

  // 4. Attach any external references
  if (input.references?.length) {
    for (const ref of input.references) {
      await phDb.addReference({
        planningNodeId: nodeId,
        refType: (ref.refType || config.referenceType) as any,
        title: ref.title,
        citation: ref.citation,
        url: ref.url,
        dateAccessed: new Date().toISOString(),
      } as any);
    }
  }

  // 5. Trigger roll-up recalculation
  let rollUpTriggered = false;
  if (parentNodeId) {
    try {
      await phDb.rollUpValue(parentNodeId);
      rollUpTriggered = true;
    } catch {
      // Roll-up is best-effort; don't fail the bridge
    }
  }

  return { planningNodeId: nodeId, parentNodeId, isNew, rollUpTriggered };
}

// ─── BATCH BRIDGE ──────────────────────────────────────────────────────
/**
 * Bridge multiple calculator outputs at once (e.g., after a holistic simulation).
 * Deduplicates roll-up triggers.
 */
export async function batchBridgeCalculators(
  inputs: CalculatorBridgeInput[]
): Promise<CalculatorBridgeResult[]> {
  const results: CalculatorBridgeResult[] = [];
  const parentIdsToRollUp = new Set<number>();

  for (const input of inputs) {
    const result = await bridgeCalculatorToPlanning(input);
    results.push(result);
    if (result.parentNodeId) parentIdsToRollUp.add(result.parentNodeId);
  }

  // Deduplicated roll-up pass
  for (const parentId of parentIdsToRollUp) {
    try {
      await phDb.rollUpValue(parentId);
    } catch {
      // Best-effort
    }
  }

  return results;
}

// ─── HELPERS ───────────────────────────────────────────────────────────
async function findOrCreateDomainNode(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  domain: string,
  config: DomainConfig,
  entityType: string,
  entityId: number,
  ownerId: number
): Promise<number> {
  const existing = await db
    .select()
    .from(planningNodes)
    .where(
      and(
        eq(planningNodes.entityType, entityType),
        eq(planningNodes.entityId, entityId),
        eq(planningNodes.label, config.defaultLabel)
      )
    )
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  return phDb.createPlanningNode({
    ownerId,
    parentId: null,
    level: config.nodeLevel,
    entityType,
    entityId,
    label: config.defaultLabel,
    currentValue: null,
    // @ts-expect-error — excess property in object literal
    targetValue: null,
    timeHorizonMonths: null,
    metadata: { calculatorDomain: domain, autoCreated: true } as any,
  });
}

/**
 * Extract the primary numeric value from calculator output for the planning node.
 * Different calculators store their "headline number" in different fields.
 */
function extractPrimaryValue(
  output: Record<string, unknown>,
  domain: CalculatorDomain
): string | null {
  const valueMap: Record<string, string[]> = {
    retirement: ["totalProjectedValue", "finalBalance", "projectedBalance", "totalWealth"],
    tax: ["totalTaxLiability", "effectiveRate", "taxSavings", "projectedTax"],
    estate: ["estateValue", "netEstate", "taxableEstate", "totalEstate"],
    protection: ["protectionScore", "overallScore", "coverageGap", "totalCoverage"],
    business_valuation: ["valuationAmount", "enterpriseValue", "fairMarketValue", "totalValue"],
    income_projection: ["projectedIncome", "totalIncome", "annualIncome"],
    social_security: ["optimalBenefit", "monthlyBenefit", "lifetimeBenefit"],
    medicare: ["estimatedCost", "totalPremium", "annualCost"],
    insurance_analysis: ["totalPremium", "cashValue", "deathBenefit", "netCost"],
    holistic_comparison: ["bestStrategyScore", "winnerScore", "topScore"],
    monte_carlo: ["medianOutcome", "p50", "successRate"],
    sensitivity: ["baseCase", "bestCase", "worstCase"],
    business_income: ["projectedRevenue", "netIncome", "totalRevenue"],
    premium_finance: ["netROI", "totalBenefit", "arbitrageSpread"],
    quick_bundle: ["bundleValue", "totalBenefit", "combinedScore"],
  };

  const keys = valueMap[domain] || [];
  for (const key of keys) {
    if (output[key] !== undefined && output[key] !== null) {
      return String(output[key]);
    }
  }

  // Fallback: look for any numeric "total" or "value" field
  for (const [k, v] of Object.entries(output)) {
    if (typeof v === "number" && (k.includes("total") || k.includes("value") || k.includes("score"))) {
      return String(v);
    }
  }

  return null;
}

/**
 * Extract time horizon in months from calculator output.
 */
function extractTimeHorizon(output: Record<string, unknown>): number | null {
  if (typeof output.years === "number") return output.years * 12;
  if (typeof output.maxYears === "number") return output.maxYears * 12;
  if (typeof output.timeHorizon === "number") return output.timeHorizon;
  if (typeof output.months === "number") return output.months;
  if (typeof output.projectionYears === "number") return output.projectionYears * 12;
  return null;
}
