/**
 * Unified Client Plan Service
 *
 * Mirrors the Practice Income Hub but for the CLIENT layer.
 * Provides a holistic, comprehensive view across all 15 client calculator
 * panels and 12 advanced strategy panels, with:
 *
 * 1. Forward Planning: From current state → recommended strategy/offering mix
 * 2. Back Planning: From target goals → gap analysis → required actions
 * 3. Cross-Hierarchy Cascade: Client planning ↔ Advanced strategies alignment
 * 4. Practice-to-Client Income Roll-Up: $ or %, threshold-based allocation
 * 5. Unified Recommendations: Complete holistic view (not just insurance)
 *
 * The service aggregates outputs from every calculator domain and advanced
 * strategy panel into a single coherent plan with cascade alignment.
 */

import { getDb } from "../../db";
import { sql } from "drizzle-orm";

// ─── TYPES ────────────────────────────────────────────────────────

export type ClientPlanDomain =
  | "retirement" | "tax" | "estate" | "protection" | "income_projection"
  | "social_security" | "medicare" | "insurance_analysis" | "holistic_comparison"
  | "monte_carlo" | "sensitivity" | "business_income" | "premium_finance"
  | "quick_bundle" | "business_valuation";

export type AdvancedStrategyDomain =
  | "engagement_letter" | "yoy_comparison" | "underwriting" | "meeting_management"
  | "compliance_audit" | "cascade_alignment" | "pfr_export" | "benchmark"
  | "shared_assumptions" | "recommendation_linker" | "calculator_bridge" | "diagnostic";

export interface ClientPlanCategory {
  domain: ClientPlanDomain | AdvancedStrategyDomain;
  label: string;
  group: "client_planning" | "advanced_strategy" | "practice_rollup";
  status: "complete" | "partial" | "not_started";
  score: number; // 0-100
  recommendations: string[];
  currentValue: number;
  targetValue: number;
  gap: number;
  lastUpdated: string | null;
  nodeId: number | null; // planning hierarchy node if linked
}

export interface ForwardPlanResult {
  clientId: number;
  currentState: {
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    annualIncome: number;
    annualExpenses: number;
    savingsRate: number;
    protectionScore: number;
    taxEfficiency: number;
    estateReadiness: number;
    retirementReadiness: number;
  };
  recommendedMix: Array<{
    domain: ClientPlanDomain;
    label: string;
    allocation: number; // percentage of focus
    priority: "critical" | "high" | "medium" | "low";
    defaultValues: Record<string, number>;
    rationale: string;
  }>;
  projectedOutcome: {
    netWorthAt5: number;
    netWorthAt10: number;
    netWorthAt20: number;
    retirementReadiness: number;
    protectionGap: number;
    taxSavings: number;
  };
  cascadeNodes: Array<{ nodeId: number; level: string; label: string; value: number }>;
}

export interface BackPlanResult {
  clientId: number;
  goals: Array<{
    goalId: number;
    label: string;
    targetValue: number;
    currentValue: number;
    gap: number;
    requiredActions: Array<{
      domain: ClientPlanDomain;
      action: string;
      impact: number;
      timeline: string;
      priority: "critical" | "high" | "medium" | "low";
    }>;
    feasibility: number; // 0-100
    timelineMonths: number;
  }>;
  totalGap: number;
  overallFeasibility: number;
  cascadeAlignment: {
    aligned: number;
    misaligned: number;
    gaps: string[];
  };
}

export interface PracticeToClientRollup {
  clientId: number;
  practiceIncome: {
    totalGDC: number;
    totalNetIncome: number;
    byChannel: Array<{ channel: string; gross: number; net: number; margin: number }>;
  };
  clientAllocation: {
    method: "percentage" | "fixed" | "threshold" | "tiered";
    percentage?: number;
    fixedAmount?: number;
    threshold?: number;
    tieredRates?: Array<{ above: number; rate: number }>;
    allocatedAmount: number;
  };
  strategyFunding: Array<{
    domain: ClientPlanDomain;
    fundedAmount: number;
    requiredAmount: number;
    gap: number;
    source: string;
  }>;
}

export interface UnifiedClientPlanSummary {
  clientId: number;
  clientName: string;
  lastUpdated: string;
  overallScore: number; // 0-100
  categories: ClientPlanCategory[];
  forwardPlan: ForwardPlanResult | null;
  backPlan: BackPlanResult | null;
  practiceRollup: PracticeToClientRollup | null;
  cascadeHealth: {
    totalNodes: number;
    alignedNodes: number;
    misalignedNodes: number;
    staleNodes: number;
    healthScore: number;
  };
  recommendations: Array<{
    priority: "critical" | "high" | "medium" | "low";
    domain: string;
    action: string;
    impact: string;
    effort: string;
  }>;
}

// ─── DOMAIN CONFIGURATION ─────────────────────────────────────────

const CLIENT_PLAN_DOMAINS: Array<{
  domain: ClientPlanDomain;
  label: string;
  group: "client_planning";
  scoreWeight: number;
  defaultTarget: number;
}> = [
  { domain: "retirement", label: "Retirement Planning", group: "client_planning", scoreWeight: 15, defaultTarget: 80 },
  { domain: "tax", label: "Tax Optimization", group: "client_planning", scoreWeight: 10, defaultTarget: 70 },
  { domain: "estate", label: "Estate Planning", group: "client_planning", scoreWeight: 10, defaultTarget: 75 },
  { domain: "protection", label: "Protection & Insurance", group: "client_planning", scoreWeight: 12, defaultTarget: 85 },
  { domain: "income_projection", label: "Income Projection", group: "client_planning", scoreWeight: 8, defaultTarget: 70 },
  { domain: "social_security", label: "Social Security Strategy", group: "client_planning", scoreWeight: 7, defaultTarget: 75 },
  { domain: "medicare", label: "Medicare Planning", group: "client_planning", scoreWeight: 5, defaultTarget: 70 },
  { domain: "insurance_analysis", label: "Insurance Analysis", group: "client_planning", scoreWeight: 8, defaultTarget: 80 },
  { domain: "holistic_comparison", label: "Holistic Strategy Comparison", group: "client_planning", scoreWeight: 5, defaultTarget: 75 },
  { domain: "monte_carlo", label: "Monte Carlo Simulation", group: "client_planning", scoreWeight: 5, defaultTarget: 70 },
  { domain: "sensitivity", label: "Sensitivity Analysis", group: "client_planning", scoreWeight: 3, defaultTarget: 65 },
  { domain: "business_income", label: "Business Income Planning", group: "client_planning", scoreWeight: 4, defaultTarget: 70 },
  { domain: "premium_finance", label: "Premium Finance Strategy", group: "client_planning", scoreWeight: 3, defaultTarget: 60 },
  { domain: "quick_bundle", label: "Quick Bundle Analysis", group: "client_planning", scoreWeight: 2, defaultTarget: 65 },
  { domain: "business_valuation", label: "Business Valuation", group: "client_planning", scoreWeight: 3, defaultTarget: 70 },
];

const ADVANCED_STRATEGY_DOMAINS: Array<{
  domain: AdvancedStrategyDomain;
  label: string;
  group: "advanced_strategy";
  scoreWeight: number;
}> = [
  { domain: "engagement_letter", label: "Engagement & Onboarding", group: "advanced_strategy", scoreWeight: 8 },
  { domain: "yoy_comparison", label: "Year-over-Year Progress", group: "advanced_strategy", scoreWeight: 10 },
  { domain: "underwriting", label: "Underwriting & Applications", group: "advanced_strategy", scoreWeight: 7 },
  { domain: "meeting_management", label: "Meeting & Review Cycle", group: "advanced_strategy", scoreWeight: 8 },
  { domain: "compliance_audit", label: "Compliance & Audit", group: "advanced_strategy", scoreWeight: 5 },
  { domain: "cascade_alignment", label: "Cascade & Alignment", group: "advanced_strategy", scoreWeight: 10 },
  { domain: "pfr_export", label: "Personal Financial Review", group: "advanced_strategy", scoreWeight: 12 },
  { domain: "benchmark", label: "Benchmark Comparison", group: "advanced_strategy", scoreWeight: 8 },
  { domain: "shared_assumptions", label: "Shared Assumptions", group: "advanced_strategy", scoreWeight: 7 },
  { domain: "recommendation_linker", label: "Recommendation Linkage", group: "advanced_strategy", scoreWeight: 10 },
  { domain: "calculator_bridge", label: "Calculator Integration", group: "advanced_strategy", scoreWeight: 8 },
  { domain: "diagnostic", label: "Wealth Engine Diagnostic", group: "advanced_strategy", scoreWeight: 7 },
];

// ─── CORE FUNCTIONS ───────────────────────────────────────────────

/**
 * Build the complete unified client plan summary.
 * Aggregates data from all calculator domains, advanced strategies,
 * and the planning hierarchy into a single coherent view.
 */
export async function getUnifiedClientPlan(clientId: number): Promise<UnifiedClientPlanSummary> {
  const db = (await getDb())!;

  // 1. Get client info
  const [clientRow] = await db.execute(sql`SELECT u.id, u.name, u.email FROM users u WHERE u.id = ${clientId}`) as any;
  const clientName = clientRow?.[0]?.name ?? "Client";

  // 2. Gather category statuses from saved analyses and planning nodes
  const categories = await gatherCategoryStatuses(clientId);

  // 3. Compute overall score
  const overallScore = computeOverallScore(categories);

  // 4. Generate prioritized recommendations
  const recommendations = generateRecommendations(categories);

  // 5. Get cascade health
  const cascadeHealth = await getCascadeHealth(clientId);

  return {
    clientId,
    clientName,
    lastUpdated: new Date().toISOString(),
    overallScore,
    categories,
    forwardPlan: null, // Populated on demand via generateForwardPlan
    backPlan: null,    // Populated on demand via generateBackPlan
    practiceRollup: null, // Populated on demand via getPracticeToClientRollup
    cascadeHealth,
    recommendations,
  };
}

/**
 * Forward Planning: From current state → recommended strategy mix.
 * Like practice forward planning but for client financial domains.
 */
export async function generateForwardPlan(clientId: number): Promise<ForwardPlanResult> {
  const db = (await getDb())!;

  // Get current financial state
  const currentState = await getCurrentFinancialState(clientId);

  // Determine recommended mix based on gaps
  const categories = await gatherCategoryStatuses(clientId);
  const recommendedMix = categories
    .filter(c => c.group === "client_planning")
    .sort((a, b) => a.score - b.score) // Lowest scores first = highest priority
    .map(c => {
      const config = CLIENT_PLAN_DOMAINS.find(d => d.domain === c.domain);
      const priority = c.score < 30 ? "critical" as const
        : c.score < 50 ? "high" as const
        : c.score < 70 ? "medium" as const
        : "low" as const;

      return {
        domain: c.domain as ClientPlanDomain,
        label: c.label,
        allocation: Math.max(5, Math.round((100 - c.score) / 3)),
        priority,
        defaultValues: getDefaultValues(c.domain as ClientPlanDomain, currentState),
        rationale: generateRationale(c.domain as ClientPlanDomain, c.score, c.gap),
      };
    });

  // Normalize allocations to 100%
  const totalAlloc = recommendedMix.reduce((s, m) => s + m.allocation, 0);
  if (totalAlloc > 0) {
    recommendedMix.forEach(m => { m.allocation = Math.round(m.allocation / totalAlloc * 100); });
  }

  // Get cascade nodes for this client
  const [nodeRows] = await db.execute(sql`SELECT id, level, label, value FROM planning_nodes WHERE owner_id = ${clientId} ORDER BY level, label`) as any;
  const cascadeNodes = (nodeRows ?? []).map((r: any) => ({
    nodeId: r.id, level: r.level, label: r.label, value: r.value ?? 0,
  }));

  // Project outcomes
  const projectedOutcome = projectOutcomes(currentState, recommendedMix);

  return {
    clientId,
    currentState,
    recommendedMix,
    projectedOutcome,
    cascadeNodes,
  };
}

/**
 * Back Planning: From target goals → gap analysis → required actions.
 * Like practice back planning but for client financial goals.
 */
export async function generateBackPlan(clientId: number): Promise<BackPlanResult> {
  const db = (await getDb())!;

  // Get client goals
  const [goalRows] = await db.execute(sql`SELECT id, title, target_value, current_value, category, status, timeline_months
     FROM client_goals WHERE client_id = ${clientId} ORDER BY priority ASC`) as any;

  const goals = (goalRows ?? []).map((g: any) => {
    const gap = (g.target_value ?? 0) - (g.current_value ?? 0);
    const requiredActions = generateRequiredActions(
      g.category, gap, g.timeline_months ?? 120
    );
    const feasibility = computeFeasibility(gap, g.timeline_months ?? 120, requiredActions);

    return {
      goalId: g.id,
      label: g.title ?? "Unnamed Goal",
      targetValue: g.target_value ?? 0,
      currentValue: g.current_value ?? 0,
      gap: Math.max(0, gap),
      requiredActions,
      feasibility,
      timelineMonths: g.timeline_months ?? 120,
    };
  });

  // @ts-expect-error — implicit any parameter
  const totalGap = goals.reduce((s, g) => s + g.gap, 0);
  const overallFeasibility = goals.length > 0
    // @ts-expect-error — implicit any parameter
    ? Math.round(goals.reduce((s, g) => s + g.feasibility, 0) / goals.length)
    : 0;

  // Check cascade alignment
  const cascadeAlignment = await checkCascadeAlignmentForBackPlan(clientId, goals);

  return {
    clientId,
    goals,
    totalGap,
    overallFeasibility,
    cascadeAlignment,
  };
}

/**
 * Practice-to-Client Income Roll-Up.
 * Connects practice income (GDC, net income by channel) to client
 * strategy funding via configurable allocation methods.
 */
export async function getPracticeToClientRollup(
  clientId: number,
  allocationConfig?: {
    method: "percentage" | "fixed" | "threshold" | "tiered";
    percentage?: number;
    fixedAmount?: number;
    threshold?: number;
    tieredRates?: Array<{ above: number; rate: number }>;
  }
): Promise<PracticeToClientRollup> {
  const db = (await getDb())!;

  // Get practice income data from business income calculations
  const [incomeRows] = await db.execute(sql`SELECT sa.calculator_type, sa.result_json, sa.created_at
     FROM saved_analyses sa
     WHERE sa.user_id = ${clientId} AND sa.calculator_type IN ('business_income', 'gdc_calculator', 'sales_funnel')
     ORDER BY sa.created_at DESC LIMIT 10`) as any;

  let totalGDC = 0;
  let totalNetIncome = 0;
  const byChannel: Array<{ channel: string; gross: number; net: number; margin: number }> = [];

  for (const row of (incomeRows ?? [])) {
    try {
      const result = typeof row.result_json === "string" ? JSON.parse(row.result_json) : row.result_json;
      const gross = result?.totalGDC ?? result?.grossIncome ?? result?.revenue ?? 0;
      const net = result?.netIncome ?? result?.profit ?? gross * 0.6;
      const channel = result?.channel ?? row.calculator_type ?? "general";

      if (gross > 0) {
        totalGDC += gross;
        totalNetIncome += net;
        byChannel.push({
          channel,
          gross,
          net,
          margin: gross > 0 ? Math.round(net / gross * 100) : 0,
        });
      }
    } catch { /* skip malformed */ }
  }

  // Default allocation: 10% of net income
  const config = allocationConfig ?? { method: "percentage" as const, percentage: 10 };
  // @ts-expect-error — argument type mismatch
  const allocatedAmount = computeAllocation(totalNetIncome, config);

  // Determine how the allocated amount funds client strategies
  const categories = await gatherCategoryStatuses(clientId);
  const strategyFunding = categories
    .filter(c => c.group === "client_planning" && c.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .map((c, i) => {
      // Distribute allocated amount proportionally to gaps
      const totalGap = categories.filter(cc => cc.group === "client_planning" && cc.gap > 0).reduce((s, cc) => s + cc.gap, 0);
      const share = totalGap > 0 ? c.gap / totalGap : 0;
      const funded = Math.round(allocatedAmount * share);

      return {
        domain: c.domain as ClientPlanDomain,
        fundedAmount: funded,
        requiredAmount: c.gap,
        gap: Math.max(0, c.gap - funded),
        source: `Practice income (${config.method})`,
      };
    });

  return {
    clientId,
    practiceIncome: { totalGDC, totalNetIncome, byChannel },
    clientAllocation: { ...config, allocatedAmount },
    strategyFunding,
  };
}

/**
 * Cross-hierarchy cascade: Propagate changes between client planning
 * and advanced strategy domains, ensuring alignment.
 */
export async function cascadeClientPlan(
  clientId: number,
  sourceDomain: ClientPlanDomain | AdvancedStrategyDomain,
  changes: Record<string, number>
): Promise<{
  propagated: Array<{ domain: string; field: string; oldValue: number; newValue: number }>;
  conflicts: Array<{ domain: string; field: string; reason: string }>;
}> {
  const propagated: Array<{ domain: string; field: string; oldValue: number; newValue: number }> = [];
  const conflicts: Array<{ domain: string; field: string; reason: string }> = [];

  // Define cascade rules: which domains affect which
  const cascadeRules: Record<string, string[]> = {
    retirement: ["tax", "social_security", "income_projection", "monte_carlo"],
    tax: ["retirement", "estate", "business_income"],
    estate: ["protection", "tax", "insurance_analysis"],
    protection: ["insurance_analysis", "premium_finance", "underwriting"],
    income_projection: ["retirement", "tax", "business_income"],
    social_security: ["retirement", "medicare", "income_projection"],
    medicare: ["social_security", "protection"],
    insurance_analysis: ["protection", "premium_finance", "underwriting"],
    business_income: ["tax", "business_valuation", "retirement"],
    business_valuation: ["estate", "business_income"],
    premium_finance: ["insurance_analysis", "protection"],
    monte_carlo: ["retirement", "sensitivity"],
    sensitivity: ["monte_carlo", "holistic_comparison"],
    holistic_comparison: ["sensitivity", "strategy_comparison"],
    quick_bundle: ["protection", "insurance_analysis"],
    // Advanced strategy cascades
    engagement_letter: ["compliance_audit", "meeting_management"],
    yoy_comparison: ["benchmark", "diagnostic"],
    cascade_alignment: ["recommendation_linker", "shared_assumptions"],
    pfr_export: ["engagement_letter", "yoy_comparison"],
    shared_assumptions: ["calculator_bridge", "cascade_alignment"],
  };

  const affectedDomains = cascadeRules[sourceDomain] ?? [];

  for (const targetDomain of affectedDomains) {
    for (const [field, newValue] of Object.entries(changes)) {
      // Check if this field is relevant to the target domain
      const mapping = getCascadeMapping(sourceDomain, targetDomain, field);
      if (mapping) {
        const oldValue = mapping.currentValue;
        if (Math.abs(oldValue - newValue) > 0.01) {
          // Check for conflicts
          if (mapping.locked) {
            conflicts.push({
              domain: targetDomain,
              field: mapping.targetField,
              reason: `Field is locked by ${mapping.lockedBy ?? "manual override"}`,
            });
          } else {
            propagated.push({
              domain: targetDomain,
              field: mapping.targetField,
              oldValue,
              newValue: mapping.transform ? mapping.transform(newValue) : newValue,
            });
          }
        }
      }
    }
  }

  return { propagated, conflicts };
}

/**
 * Generate a client-facing planning summary in plain language.
 * Strips advisor-only details and presents goals, progress, and
 * next steps with visual progress indicators.
 */
export async function getClientFacingSummary(clientId: number): Promise<{
  greeting: string;
  overallProgress: number;
  highlights: Array<{ icon: string; title: string; description: string; progress: number }>;
  nextSteps: Array<{ title: string; description: string; timeline: string }>;
  milestones: Array<{ title: string; date: string; status: "completed" | "upcoming" | "overdue" }>;
}> {
  const plan = await getUnifiedClientPlan(clientId);
  const categories = plan.categories.filter(c => c.group === "client_planning");

  const highlights = categories
    .filter(c => c.status !== "not_started")
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(c => ({
      icon: getDomainIcon(c.domain),
      title: c.label,
      description: c.score >= 80 ? "On track — great progress!"
        : c.score >= 60 ? "Making progress — a few areas to address"
        : c.score >= 40 ? "Needs attention — let's review together"
        : "Getting started — we'll build this out",
      progress: c.score,
    }));

  const nextSteps = plan.recommendations
    .filter(r => r.priority === "critical" || r.priority === "high")
    .slice(0, 5)
    .map(r => ({
      title: r.action,
      description: r.impact,
      timeline: r.effort,
    }));

  // Get milestones from goals
  const db = (await getDb())!;
  const [milestoneRows] = await db.execute(sql`SELECT title, target_date, status FROM client_goals WHERE client_id = ${clientId} AND target_date IS NOT NULL ORDER BY target_date ASC LIMIT 10`) as any;

  const now = Date.now();
  const milestones = (milestoneRows ?? []).map((m: any) => {
    const targetDate = m.target_date ? new Date(m.target_date).getTime() : now;
    return {
      title: m.title ?? "Milestone",
      date: m.target_date ?? new Date().toISOString(),
      status: m.status === "completed" ? "completed" as const
        : targetDate < now ? "overdue" as const
        : "upcoming" as const,
    };
  });

  return {
    greeting: `Here's your financial plan overview, ${plan.clientName}`,
    overallProgress: plan.overallScore,
    highlights,
    nextSteps,
    milestones,
  };
}

/**
 * Bulk engagement letter generation for annual renewal periods.
 */
export async function bulkGenerateEngagementLetters(
  advisorId: number,
  clientIds: number[],
  template: {
    engagementType: "renewal" | "initial";
    effectiveDate: string;
    termMonths: number;
    autoRenew: boolean;
  }
): Promise<{
  generated: number;
  failed: number;
  results: Array<{ clientId: number; status: "success" | "error"; letterId?: number; error?: string }>;
}> {
  const db = (await getDb())!;
  const results: Array<{ clientId: number; status: "success" | "error"; letterId?: number; error?: string }> = [];

  for (const clientId of clientIds) {
    try {
      // Get client info
      const [clientRows] = await db.execute(sql`SELECT name, email FROM users WHERE id = ${clientId}`) as any;
      const client = clientRows?.[0];
      if (!client) {
        results.push({ clientId, status: "error", error: "Client not found" });
        continue;
      }

      // Get advisor info
      const [advisorRows] = await db.execute(sql`SELECT name FROM users WHERE id = ${advisorId}`) as any;
      const advisor = advisorRows?.[0];

      // Create engagement letter record
      const [insertResult] = await db.execute(sql`INSERT INTO engagement_letters (client_id, advisor_id, engagement_type, status, effective_date, term_months, auto_renew, created_at, updated_at)
         VALUES (${clientId}, ${advisorId}, ${template.engagementType}, 'draft', ${template.effectiveDate}, ${template.termMonths}, ${template.autoRenew ? 1 : 0}, NOW(), NOW())`) as any;

      const letterId = insertResult?.insertId;
      results.push({ clientId, status: "success", letterId });
    } catch (e: any) {
      results.push({ clientId, status: "error", error: e?.message ?? "Unknown error" });
    }
  }

  return {
    generated: results.filter(r => r.status === "success").length,
    failed: results.filter(r => r.status === "error").length,
    results,
  };
}

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────

async function gatherCategoryStatuses(clientId: number): Promise<ClientPlanCategory[]> {
  const db = (await getDb())!;
  const categories: ClientPlanCategory[] = [];

  // Check saved analyses for each client planning domain
  for (const config of CLIENT_PLAN_DOMAINS) {
    const [rows] = await db.execute(sql`SELECT COUNT(*) as cnt, MAX(created_at) as last_updated
       FROM saved_analyses WHERE user_id = ${clientId} AND calculator_type = ${config.domain}`) as any;

    const count = rows?.[0]?.cnt ?? 0;
    const lastUpdated = rows?.[0]?.last_updated ?? null;

    // Check planning nodes for this domain
    const [nodeRows] = await db.execute(sql`SELECT id, value FROM planning_nodes WHERE owner_id = ${clientId} AND entity_type = ${config.domain} LIMIT 1`) as any;
    const nodeId = nodeRows?.[0]?.id ?? null;
    const nodeValue = nodeRows?.[0]?.value ?? 0;

    const status = count > 0 ? (nodeId ? "complete" : "partial") : "not_started";
    const score = count > 0 ? Math.min(100, 40 + count * 15 + (nodeId ? 20 : 0)) : 0;
    const targetValue = config.defaultTarget;
    const currentValue = score;

    categories.push({
      domain: config.domain,
      label: config.label,
      group: "client_planning",
      status: status as "complete" | "partial" | "not_started",
      score,
      recommendations: generateDomainRecommendations(config.domain, score),
      currentValue,
      targetValue,
      gap: Math.max(0, targetValue - currentValue),
      lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
      nodeId,
    });
  }

  // Check advanced strategy statuses
  for (const config of ADVANCED_STRATEGY_DOMAINS) {
    const advStatus = await getAdvancedStrategyStatus(clientId, config.domain);
    categories.push({
      domain: config.domain,
      label: config.label,
      group: "advanced_strategy",
      ...advStatus,
    });
  }

  return categories;
}

async function getAdvancedStrategyStatus(clientId: number, domain: AdvancedStrategyDomain): Promise<{
  status: "complete" | "partial" | "not_started";
  score: number;
  recommendations: string[];
  currentValue: number;
  targetValue: number;
  gap: number;
  lastUpdated: string | null;
  nodeId: number | null;
}> {
  const db = (await getDb())!;

  // Check for relevant data based on domain
  const tableMap: Record<string, { table: string; clientCol: string }> = {
    engagement_letter: { table: "engagement_letters", clientCol: "client_id" },
    yoy_comparison: { table: "yoy_snapshots", clientCol: "client_id" },
    underwriting: { table: "underwriting_tracking", clientCol: "client_id" },
    compliance_audit: { table: "compliance_audit_samples", clientCol: "supervisor_id" },
    meeting_management: { table: "meeting_action_items", clientCol: "assigned_to" },
  };

  const mapping = tableMap[domain];
  if (mapping) {
    try {
      const [rows] = await db.execute(sql`SELECT COUNT(*) as cnt, MAX(created_at) as last_updated FROM ${mapping.table} WHERE ${mapping.clientCol} = ${clientId}`) as any;
      const count = rows?.[0]?.cnt ?? 0;
      const score = count > 0 ? Math.min(100, 30 + count * 20) : 0;
      return {
        status: count > 0 ? "partial" : "not_started",
        score,
        recommendations: generateDomainRecommendations(domain, score),
        currentValue: score,
        targetValue: 75,
        gap: Math.max(0, 75 - score),
        lastUpdated: rows?.[0]?.last_updated ? new Date(rows[0].last_updated).toISOString() : null,
        nodeId: null,
      };
    } catch { /* table may not exist yet */ }
  }

  // Default for domains without direct table mapping
  return {
    status: "not_started",
    score: 0,
    recommendations: [`Set up ${domain.replace(/_/g, " ")} for this client`],
    currentValue: 0,
    targetValue: 75,
    gap: 75,
    lastUpdated: null,
    nodeId: null,
  };
}

function computeOverallScore(categories: ClientPlanCategory[]): number {
  const clientCategories = categories.filter(c => c.group === "client_planning");
  const advancedCategories = categories.filter(c => c.group === "advanced_strategy");

  // 70% weight on client planning, 30% on advanced strategies
  const clientScore = clientCategories.length > 0
    ? clientCategories.reduce((s, c) => s + c.score, 0) / clientCategories.length
    : 0;
  const advancedScore = advancedCategories.length > 0
    ? advancedCategories.reduce((s, c) => s + c.score, 0) / advancedCategories.length
    : 0;

  return Math.round(clientScore * 0.7 + advancedScore * 0.3);
}

function generateRecommendations(categories: ClientPlanCategory[]): Array<{
  priority: "critical" | "high" | "medium" | "low";
  domain: string;
  action: string;
  impact: string;
  effort: string;
}> {
  const recs: Array<{
    priority: "critical" | "high" | "medium" | "low";
    domain: string;
    action: string;
    impact: string;
    effort: string;
  }> = [];

  for (const cat of categories.sort((a, b) => a.score - b.score)) {
    if (cat.score >= 80) continue;

    const priority = cat.score < 20 ? "critical" as const
      : cat.score < 40 ? "high" as const
      : cat.score < 60 ? "medium" as const
      : "low" as const;

    for (const rec of cat.recommendations.slice(0, 2)) {
      recs.push({
        priority,
        domain: cat.label,
        action: rec,
        impact: cat.gap > 50 ? "High — significant improvement expected" : "Moderate — incremental improvement",
        effort: cat.status === "not_started" ? "30-60 minutes initial setup" : "15-30 minutes review",
      });
    }
  }

  return recs.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  }).slice(0, 15);
}

async function getCascadeHealth(clientId: number): Promise<{
  totalNodes: number;
  alignedNodes: number;
  misalignedNodes: number;
  staleNodes: number;
  healthScore: number;
}> {
  const db = (await getDb())!;
  try {
    const [rows] = await db.execute(sql`SELECT COUNT(*) as total,
              SUM(CASE WHEN updated_at > DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) as fresh,
              SUM(CASE WHEN updated_at <= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) as stale
       FROM planning_nodes WHERE owner_id = ${clientId}`) as any;

    const total = rows?.[0]?.total ?? 0;
    const fresh = rows?.[0]?.fresh ?? 0;
    const stale = rows?.[0]?.stale ?? 0;
    const healthScore = total > 0 ? Math.round(fresh / total * 100) : 0;

    return {
      totalNodes: total,
      alignedNodes: fresh,
      misalignedNodes: 0, // Would need cascade check
      staleNodes: stale,
      healthScore,
    };
  } catch {
    return { totalNodes: 0, alignedNodes: 0, misalignedNodes: 0, staleNodes: 0, healthScore: 0 };
  }
}

async function getCurrentFinancialState(clientId: number): Promise<ForwardPlanResult["currentState"]> {
  const db = (await getDb())!;
  try {
    const [rows] = await db.execute(sql`SELECT profile_json FROM financial_profiles WHERE user_id = ${clientId} ORDER BY updated_at DESC LIMIT 1`) as any;
    const profile = rows?.[0]?.profile_json
      ? (typeof rows[0].profile_json === "string" ? JSON.parse(rows[0].profile_json) : rows[0].profile_json)
      : {};

    return {
      totalAssets: profile.netWorth ?? profile.totalAssets ?? 0,
      totalLiabilities: profile.debts ?? profile.mortgage ?? 0,
      netWorth: (profile.netWorth ?? 0) - (profile.debts ?? 0),
      annualIncome: profile.income ?? 0,
      annualExpenses: profile.expenses ?? (profile.income ?? 0) * 0.7,
      savingsRate: profile.income ? Math.round(((profile.income - (profile.expenses ?? profile.income * 0.7)) / profile.income) * 100) : 0,
      protectionScore: profile.protectionScore ?? 50,
      taxEfficiency: profile.taxEfficiency ?? 50,
      estateReadiness: profile.estateReadiness ?? 30,
      retirementReadiness: profile.retirementReadiness ?? 40,
    };
  } catch {
    return {
      totalAssets: 0, totalLiabilities: 0, netWorth: 0,
      annualIncome: 0, annualExpenses: 0, savingsRate: 0,
      protectionScore: 0, taxEfficiency: 0, estateReadiness: 0, retirementReadiness: 0,
    };
  }
}

function getDefaultValues(domain: ClientPlanDomain, state: ForwardPlanResult["currentState"]): Record<string, number> {
  const defaults: Record<string, Record<string, number>> = {
    retirement: { monthlyContribution: Math.round(state.annualIncome * 0.15 / 12), targetAge: 65, replacementRate: 80 },
    tax: { marginalRate: 24, effectiveRate: 18, estimatedSavings: Math.round(state.annualIncome * 0.05) },
    estate: { estateValue: state.totalAssets, exemption: 12920000, estateTax: 0 },
    protection: { lifeInsurance: Math.round(state.annualIncome * 10), disability: Math.round(state.annualIncome * 0.6), umbrella: 1000000 },
    income_projection: { currentIncome: state.annualIncome, growthRate: 3, inflationRate: 2.5 },
    social_security: { claimAge: 67, estimatedBenefit: Math.round(state.annualIncome * 0.35 / 12) },
    medicare: { enrollmentAge: 65, supplementPlan: 1, estimatedPremium: 175 },
    insurance_analysis: { coverage: Math.round(state.annualIncome * 10), premium: 0, cashValue: 0 },
    holistic_comparison: { projectionYears: 30, strategies: 3 },
    monte_carlo: { simulations: 10000, confidenceLevel: 95 },
    sensitivity: { variables: 5, range: 20 },
    business_income: { revenue: state.annualIncome, margin: 30, growthRate: 5 },
    premium_finance: { faceAmount: 5000000, premium: 50000, loanRate: 5 },
    quick_bundle: { coverage: Math.round(state.annualIncome * 10), term: 20 },
    business_valuation: { revenue: state.annualIncome, ebitda: Math.round(state.annualIncome * 0.2), multiple: 5 },
  };
  return defaults[domain] ?? {};
}

function generateRationale(domain: ClientPlanDomain, score: number, gap: number): string {
  if (score >= 80) return `${domain.replace(/_/g, " ")} is well-optimized. Maintain current strategy.`;
  if (score >= 60) return `Good foundation in ${domain.replace(/_/g, " ")}. Fine-tuning can close the remaining ${gap}-point gap.`;
  if (score >= 40) return `${domain.replace(/_/g, " ")} needs attention. A ${gap}-point gap suggests missing key components.`;
  if (score >= 20) return `Significant gap in ${domain.replace(/_/g, " ")}. Prioritize setup to address ${gap}-point deficit.`;
  return `${domain.replace(/_/g, " ")} has not been started. This is a critical area requiring immediate attention.`;
}

function projectOutcomes(
  state: ForwardPlanResult["currentState"],
  mix: ForwardPlanResult["recommendedMix"]
): ForwardPlanResult["projectedOutcome"] {
  const growthRate = 0.07;
  const savingsPerYear = state.annualIncome * (state.savingsRate / 100);

  const fv = (years: number) => {
    let nw = state.netWorth;
    for (let y = 0; y < years; y++) {
      nw = nw * (1 + growthRate) + savingsPerYear;
    }
    return Math.round(nw);
  };

  const criticalCount = mix.filter(m => m.priority === "critical").length;
  const protectionGap = criticalCount > 3 ? state.annualIncome * 5 : criticalCount > 1 ? state.annualIncome * 2 : 0;

  return {
    netWorthAt5: fv(5),
    netWorthAt10: fv(10),
    netWorthAt20: fv(20),
    retirementReadiness: Math.min(100, state.retirementReadiness + 15),
    protectionGap,
    taxSavings: Math.round(state.annualIncome * 0.03),
  };
}

function generateRequiredActions(
  category: string,
  gap: number,
  timelineMonths: number
): BackPlanResult["goals"][0]["requiredActions"] {
  const actions: BackPlanResult["goals"][0]["requiredActions"] = [];
  const monthlyRequired = gap / Math.max(1, timelineMonths);

  // Generate domain-specific actions based on goal category
  const domainActions: Record<string, Array<{ domain: ClientPlanDomain; action: string }>> = {
    retirement: [
      { domain: "retirement", action: "Maximize 401(k)/IRA contributions" },
      { domain: "tax", action: "Implement tax-loss harvesting" },
      { domain: "income_projection", action: "Optimize income growth trajectory" },
      { domain: "monte_carlo", action: "Run Monte Carlo to validate plan feasibility" },
    ],
    protection: [
      { domain: "protection", action: "Review and update insurance coverage" },
      { domain: "insurance_analysis", action: "Compare policy options across carriers" },
      { domain: "premium_finance", action: "Evaluate premium financing for HNW strategies" },
    ],
    estate: [
      { domain: "estate", action: "Update estate documents and beneficiaries" },
      { domain: "tax", action: "Review estate tax implications" },
      { domain: "protection", action: "Ensure adequate life insurance for estate liquidity" },
    ],
    growth: [
      { domain: "business_income", action: "Optimize business income streams" },
      { domain: "business_valuation", action: "Assess current business value" },
      { domain: "holistic_comparison", action: "Compare growth strategies across firm types" },
    ],
    education: [
      { domain: "tax", action: "Maximize 529 plan contributions" },
      { domain: "income_projection", action: "Project education funding needs" },
    ],
    debt: [
      { domain: "income_projection", action: "Create debt payoff timeline" },
      { domain: "tax", action: "Evaluate debt consolidation tax implications" },
    ],
  };

  const categoryActions = domainActions[category] ?? domainActions.retirement ?? [];
  for (const da of categoryActions) {
    actions.push({
      domain: da.domain,
      action: da.action,
      impact: Math.round(gap / categoryActions.length),
      timeline: timelineMonths <= 12 ? "Immediate" : timelineMonths <= 36 ? "1-3 years" : "3-5 years",
      priority: monthlyRequired > 5000 ? "critical" : monthlyRequired > 2000 ? "high" : monthlyRequired > 500 ? "medium" : "low",
    });
  }

  return actions;
}

function computeFeasibility(gap: number, timelineMonths: number, actions: any[]): number {
  if (gap <= 0) return 100;
  if (timelineMonths <= 0) return 0;

  const monthlyRequired = gap / timelineMonths;
  // Feasibility decreases as monthly requirement increases
  if (monthlyRequired < 500) return 95;
  if (monthlyRequired < 2000) return 80;
  if (monthlyRequired < 5000) return 60;
  if (monthlyRequired < 10000) return 40;
  return 20;
}

async function checkCascadeAlignmentForBackPlan(
  clientId: number,
  goals: BackPlanResult["goals"]
): Promise<BackPlanResult["cascadeAlignment"]> {
  const db = (await getDb())!;
  try {
    const [nodeRows] = await db.execute(sql`SELECT COUNT(*) as total FROM planning_nodes WHERE owner_id = ${clientId}`) as any;
    const totalNodes = nodeRows?.[0]?.total ?? 0;

    // Check if goals have linked planning nodes
    const linkedGoals = goals.filter(g => g.requiredActions.length > 0).length;
    const gaps: string[] = [];

    if (totalNodes === 0) gaps.push("No planning hierarchy nodes — create a planning tree first");
    if (linkedGoals < goals.length) gaps.push(`${goals.length - linkedGoals} goals lack linked planning actions`);

    return {
      aligned: linkedGoals,
      misaligned: goals.length - linkedGoals,
      gaps,
    };
  } catch {
    return { aligned: 0, misaligned: goals.length, gaps: ["Unable to check cascade alignment"] };
  }
}

function computeAllocation(
  netIncome: number,
  config: PracticeToClientRollup["clientAllocation"]
): number {
  switch (config.method) {
    case "percentage":
      return Math.round(netIncome * (config.percentage ?? 10) / 100);
    case "fixed":
      return config.fixedAmount ?? 0;
    case "threshold":
      return Math.max(0, netIncome - (config.threshold ?? 0));
    case "tiered": {
      let allocated = 0;
      const rates = config.tieredRates ?? [];
      for (const tier of rates.sort((a, b) => b.above - a.above)) {
        if (netIncome > tier.above) {
          allocated += (netIncome - tier.above) * tier.rate / 100;
          break;
        }
      }
      return Math.round(allocated);
    }
    default:
      return Math.round(netIncome * 0.1);
  }
}

function generateDomainRecommendations(domain: string, score: number): string[] {
  if (score >= 80) return [`${domain.replace(/_/g, " ")} is well-configured. Review annually.`];
  if (score >= 50) return [
    `Complete remaining ${domain.replace(/_/g, " ")} setup items`,
    `Link ${domain.replace(/_/g, " ")} outputs to planning hierarchy`,
  ];
  return [
    `Start ${domain.replace(/_/g, " ")} analysis for this client`,
    `Run initial ${domain.replace(/_/g, " ")} calculations`,
    `Connect ${domain.replace(/_/g, " ")} to client goals`,
  ];
}

function getDomainIcon(domain: string): string {
  const icons: Record<string, string> = {
    retirement: "🏖️", tax: "📊", estate: "🏛️", protection: "🛡️",
    income_projection: "📈", social_security: "🏛️", medicare: "🏥",
    insurance_analysis: "📋", holistic_comparison: "⚖️", monte_carlo: "🎲",
    sensitivity: "📉", business_income: "💼", premium_finance: "💰",
    quick_bundle: "⚡", business_valuation: "🏢",
    engagement_letter: "📝", yoy_comparison: "📅", underwriting: "📄",
    meeting_management: "🤝", compliance_audit: "✅", cascade_alignment: "🔗",
    pfr_export: "📑", benchmark: "📊", shared_assumptions: "🔧",
    recommendation_linker: "🎯", calculator_bridge: "🌉", diagnostic: "🔍",
  };
  return icons[domain] ?? "📋";
}

function getCascadeMapping(
  _source: string, _target: string, _field: string
): { targetField: string; currentValue: number; locked: boolean; lockedBy?: string; transform?: (v: number) => number } | null {
  // Simplified cascade mapping — in production this would be a comprehensive
  // mapping table driven by shared assumptions
  return {
    targetField: _field,
    currentValue: 0,
    locked: false,
    transform: undefined,
  };
}
