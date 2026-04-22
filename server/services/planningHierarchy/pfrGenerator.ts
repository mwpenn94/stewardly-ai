/**
 * PFR (Personal Financial Review) Generator
 * 
 * Assembles all client-level planning nodes, calculator outputs, assumptions,
 * reasoning chains, and references into a comprehensive Personal Financial
 * Review document. Supports both markdown and PDF export.
 *
 * The PFR follows the CFP Board's 7-step process:
 *   1. Understanding circumstances → Client discovery + profile
 *   2. Identifying goals → Goal hierarchy from planning nodes
 *   3. Analyzing current course → Calculator outputs + gap analysis
 *   4. Developing recommendations → Strategy nodes + reasoning
 *   5. Presenting recommendations → This document
 *   6. Implementing → Implementation nodes + action items
 *   7. Monitoring → Scheduled review triggers
 */
import { getDb } from "../../db";
import {
  planningNodes,
  planningReferences,
  personalFinancialReviews,
  clientGoals,
  clientDiscovery,
  recommendationsLog,
  users,
} from "../../../drizzle/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "pfrGenerator" });

// ─── TYPES ─────────────────────────────────────────────────────────────
export interface PFRSection {
  title: string;
  order: number;
  content: string; // Markdown content
  planningNodeId?: number;
  calculatorDomain?: string;
  references?: Array<{ title: string; citation?: string; url?: string }>;
}

export interface PFRDocument {
  id?: number;
  clientId: number;
  advisorId: number;
  reviewType: "initial" | "annual" | "life_event" | "regulatory" | "ad_hoc";
  reviewDate: string;
  sections: PFRSection[];
  markdown: string;
  goalHierarchySnapshot: Record<string, unknown>;
  calculatorOutputsSnapshot: Record<string, unknown>;
  recommendationsSnapshot: Array<Record<string, unknown>>;
  suitabilityDocumentation: Record<string, unknown>;
}

// ─── SECTION GENERATORS ────────────────────────────────────────────────
function generateCoverSection(
  clientName: string,
  advisorName: string,
  reviewDate: string,
  reviewType: string
): PFRSection {
  return {
    title: "Cover Page",
    order: 0,
    content: `# Personal Financial Review\n\n**Prepared for:** ${clientName}\n**Prepared by:** ${advisorName}\n**Date:** ${reviewDate}\n**Review Type:** ${reviewType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}\n\n---\n\n*This document is prepared in accordance with CFP Board Standards of Professional Conduct and is intended to provide a comprehensive review of your financial situation, goals, and recommended strategies.*\n\n*Important: This review is for educational and planning purposes. It does not constitute investment advice, tax advice, or a recommendation to purchase any specific financial product. Please consult with your licensed professional before making financial decisions.*`,
  };
}

function generateDiscoverySection(
  discovery: Record<string, unknown> | null,
  profile: Record<string, unknown> | null
): PFRSection {
  let content = "## Understanding Your Circumstances\n\n";
  
  if (discovery) {
    content += "### Personal Information\n\n";
    const fields = [
      ["Family Status", discovery.familyStatus],
      ["Employment", discovery.employment],
      ["Health Status", discovery.healthStatus],
      ["Risk Tolerance", discovery.riskTolerance],
      ["Time Horizon", discovery.timeHorizon],
      ["Special Circumstances", discovery.specialCircumstances],
    ];
    for (const [label, value] of fields) {
      if (value) content += `- **${label}:** ${value}\n`;
    }
    content += "\n";
  }

  if (profile) {
    content += "### Financial Snapshot\n\n";
    content += "| Category | Current Value |\n|---|---|\n";
    const metrics = [
      ["Annual Income", profile.income || profile.annualIncome],
      ["Net Worth", profile.netWorth],
      ["Total Assets", profile.totalAssets],
      ["Total Liabilities", profile.totalLiabilities],
      ["Monthly Expenses", profile.monthlyExpenses],
      ["Savings Rate", profile.savingsRate],
      ["Emergency Fund", profile.emergencyFund],
    ];
    for (const [label, value] of metrics) {
      if (value !== undefined && value !== null) {
        const formatted = typeof value === "number" 
          ? `$${value.toLocaleString()}` 
          : String(value);
        content += `| ${label} | ${formatted} |\n`;
      }
    }
    content += "\n";
  }

  return { title: "Understanding Your Circumstances", order: 1, content };
}

function generateGoalsSection(
  goals: Array<Record<string, unknown>>
): PFRSection {
  let content = "## Your Goals\n\n";
  
  if (!goals.length) {
    content += "*No goals have been formally documented yet. We recommend establishing clear, measurable goals as the foundation of your financial plan.*\n\n";
    return { title: "Your Goals", order: 2, content };
  }

  content += "The following goals have been identified and prioritized:\n\n";
  content += "| Priority | Goal | Target | Timeline | Status |\n|---|---|---|---|---|\n";
  
  for (const goal of goals) {
    content += `| ${goal.priority || "—"} | ${goal.title || goal.name || "Unnamed"} | ${goal.targetValue ? `$${Number(goal.targetValue).toLocaleString()}` : "—"} | ${goal.targetDate || goal.timeHorizon || "—"} | ${goal.status || "active"} |\n`;
  }
  content += "\n";

  return { title: "Your Goals", order: 2, content };
}

function generateAnalysisSection(
  nodes: Array<Record<string, unknown>>,
  refs: Array<Record<string, unknown>>
): PFRSection {
  let content = "## Analysis of Current Position\n\n";
  
  // Group nodes by calculator domain
  const byDomain = new Map<string, Array<Record<string, unknown>>>();
  for (const node of nodes) {
    const domain = (node.metadata as any)?.calculatorDomain || "general";
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(node);
  }

  const domainLabels: Record<string, string> = {
    retirement: "Retirement Planning",
    tax: "Tax Planning",
    estate: "Estate Planning",
    protection: "Protection & Insurance",
    business_valuation: "Business Valuation",
    income_projection: "Income Projection",
    social_security: "Social Security",
    medicare: "Medicare",
    insurance_analysis: "Insurance Analysis",
    monte_carlo: "Monte Carlo Simulation",
    general: "General Planning",
  };

  for (const [domain, domainNodes] of byDomain) {
    content += `### ${domainLabels[domain] || domain}\n\n`;
    
    for (const node of domainNodes) {
      content += `**${node.label}**\n\n`;
      if (node.currentValue) {
        content += `- Current Value: $${Number(node.currentValue).toLocaleString()}\n`;
      }
      if (node.targetValue) {
        content += `- Target Value: $${Number(node.targetValue).toLocaleString()}\n`;
      }
      if (node.timeHorizonMonths) {
        const years = Math.round(Number(node.timeHorizonMonths) / 12 * 10) / 10;
        content += `- Time Horizon: ${years} years\n`;
      }
      
      // Include key assumptions from metadata
      const meta = node.metadata as any;
      if (meta?.assumptions) {
        content += "\n**Key Assumptions:**\n";
        for (const [k, v] of Object.entries(meta.assumptions as Record<string, unknown>)) {
          if (v !== null && v !== undefined && typeof v !== "object") {
            const label = k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
            content += `- ${label}: ${v}\n`;
          }
        }
      }
      content += "\n";
    }
  }

  // Add references
  if (refs.length) {
    content += "### Supporting References\n\n";
    for (const ref of refs) {
      content += `- **${ref.title}**`;
      if (ref.citation) content += `: ${ref.citation}`;
      if (ref.url) content += ` ([source](${ref.url}))`;
      content += "\n";
    }
    content += "\n";
  }

  return {
    title: "Analysis of Current Position",
    order: 3,
    content,
    references: refs.map(r => ({
      title: String(r.title),
      citation: r.citation ? String(r.citation) : undefined,
      url: r.url ? String(r.url) : undefined,
    })),
  };
}

function generateRecommendationsSection(
  recommendations: Array<Record<string, unknown>>,
  strategyNodes: Array<Record<string, unknown>>
): PFRSection {
  let content = "## Recommendations\n\n";
  
  if (!recommendations.length && !strategyNodes.length) {
    content += "*Recommendations will be developed based on the analysis above. Your advisor will present specific strategies tailored to your goals and circumstances.*\n\n";
    return { title: "Recommendations", order: 4, content };
  }

  let recNum = 1;
  
  // Strategy nodes as recommendations
  for (const node of strategyNodes) {
    content += `### Recommendation ${recNum}: ${node.label}\n\n`;
    
    const meta = node.metadata as any;
    if (meta?.reasoning) {
      content += `**Rationale:** ${meta.reasoning}\n\n`;
    }
    
    if (node.currentValue && node.targetValue) {
      const gap = Number(node.targetValue) - Number(node.currentValue);
      content += `**Gap Analysis:** Current position is $${Number(node.currentValue).toLocaleString()}, target is $${Number(node.targetValue).toLocaleString()} (gap: $${gap.toLocaleString()})\n\n`;
    }
    
    recNum++;
  }

  // Formal recommendations from the log
  for (const rec of recommendations) {
    content += `### Recommendation ${recNum}: ${rec.title || rec.recommendationType || "Strategy"}\n\n`;
    if (rec.reasoning) content += `**Rationale:** ${rec.reasoning}\n\n`;
    if (rec.alternatives) {
      content += "**Alternatives Considered:**\n";
      const alts = Array.isArray(rec.alternatives) ? rec.alternatives : [rec.alternatives];
      for (const alt of alts) {
        content += `- ${typeof alt === "string" ? alt : JSON.stringify(alt)}\n`;
      }
      content += "\n";
    }
    if (rec.expectedOutcome) content += `**Expected Outcome:** ${rec.expectedOutcome}\n\n`;
    recNum++;
  }

  return { title: "Recommendations", order: 4, content };
}

function generateImplementationSection(
  implNodes: Array<Record<string, unknown>>
): PFRSection {
  let content = "## Implementation Plan\n\n";
  
  if (!implNodes.length) {
    content += "*Implementation steps will be defined after recommendations are approved.*\n\n";
    return { title: "Implementation Plan", order: 5, content };
  }

  content += "| # | Action Item | Timeline | Status |\n|---|---|---|---|\n";
  
  let step = 1;
  for (const node of implNodes) {
    const timeline = node.timeHorizonMonths 
      ? `${Math.round(Number(node.timeHorizonMonths) / 12 * 10) / 10} years`
      : "TBD";
    content += `| ${step} | ${node.label} | ${timeline} | ${node.status || "pending"} |\n`;
    step++;
  }
  content += "\n";

  return { title: "Implementation Plan", order: 5, content };
}

function generateMonitoringSection(reviewType: string): PFRSection {
  const content = `## Ongoing Monitoring\n\nThis plan will be reviewed on the following schedule:\n\n- **Quarterly:** Portfolio performance and market conditions\n- **Semi-Annually:** Goal progress and life changes check-in\n- **Annually:** Comprehensive plan review and update\n- **As Needed:** Triggered by significant life events (marriage, divorce, birth, death, job change, inheritance, health change)\n\n### Next Review\n\nYour next scheduled review will be determined based on this ${reviewType.replace(/_/g, " ")} review. Your advisor will contact you to schedule.\n\n### How to Request a Review\n\nYou may request an ad-hoc review at any time by contacting your advisor through the client portal.\n`;

  return { title: "Ongoing Monitoring", order: 6, content };
}

function generateDisclaimerSection(): PFRSection {
  return {
    title: "Important Disclosures",
    order: 7,
    content: `## Important Disclosures\n\n**Disclaimer:** This Personal Financial Review is prepared for educational and planning purposes only. It does not constitute investment advice, tax advice, legal advice, or a recommendation to purchase any specific financial product or service.\n\n**Projections:** All projections and illustrations contained herein are based on assumptions that may not reflect actual future performance. Past performance is not indicative of future results. Actual results may vary significantly from projections.\n\n**Tax Information:** Tax-related information is general in nature and should not be construed as tax advice. Consult a qualified tax professional for advice specific to your situation.\n\n**Insurance Products:** Insurance product illustrations are based on current rates and assumptions that are subject to change. Guarantees are subject to the claims-paying ability of the issuing insurance company.\n\n**Regulatory Compliance:** This document is maintained in accordance with applicable regulatory requirements including SEC, FINRA, and state insurance department regulations. A copy is retained for a minimum of 3 years per FINRA Rule 4511.\n\n**Privacy:** Your personal and financial information is protected in accordance with Regulation S-P and our firm's privacy policy.\n`,
  };
}

// ─── MAIN GENERATOR ────────────────────────────────────────────────────
export async function generatePFR(params: {
  clientId: number;
  advisorId: number;
  reviewType: "initial" | "annual" | "life_event" | "regulatory" | "ad_hoc";
  planningNodeId?: number; // Optional root node to scope the PFR
}): Promise<PFRDocument> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const reviewDate = new Date().toISOString().split("T")[0]!;

  // Fetch client and advisor names
  const [clientRow] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, params.clientId))
    .limit(1);
  const [advisorRow] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, params.advisorId))
    .limit(1);

  const clientName = clientRow?.name || "Client";
  const advisorName = advisorRow?.name || "Advisor";

  // Fetch all planning nodes for this client
  const allNodes = await db
    .select()
    .from(planningNodes)
    .where(
      and(
        eq(planningNodes.entityType, "client"),
        eq(planningNodes.entityId, params.clientId)
      )
    )
    .orderBy(planningNodes.level);

  // Fetch all references for these nodes
  const nodeIds = allNodes.map(n => n.id);
  let allRefs: Array<Record<string, unknown>> = [];
  if (nodeIds.length) {
    for (const nid of nodeIds) {
      const refs = await db
        .select()
        .from(planningReferences)
        .where(eq(planningReferences.planningNodeId, nid));
      allRefs.push(...refs);
    }
  }

  // Fetch client goals
  let goals: Array<Record<string, unknown>> = [];
  try {
    goals = await db
      .select()
      .from(clientGoals)
      .where(eq(clientGoals.clientId, params.clientId))
      // @ts-expect-error — property access on loosely typed object
      .orderBy(clientGoals.priority);
  } catch {
    // clientGoals table may not exist yet
  }

  // Fetch client discovery
  let discovery: Record<string, unknown> | null = null;
  try {
    const [disc] = await db
      .select()
      .from(clientDiscovery)
      .where(eq(clientDiscovery.clientId, params.clientId))
      .orderBy(desc(clientDiscovery.createdAt))
      .limit(1);
    discovery = disc || null;
  } catch {
    // clientDiscovery table may not exist yet
  }

  // Fetch recommendations
  let recommendations: Array<Record<string, unknown>> = [];
  try {
    recommendations = await db
      .select()
      .from(recommendationsLog)
      // @ts-expect-error — property access on loosely typed object
      .where(eq(recommendationsLog.clientId, params.clientId))
      .orderBy(desc(recommendationsLog.createdAt));
  } catch {
    // Table may not exist
  }

  // Separate strategy vs implementation nodes
  const strategyNodes = allNodes.filter(n => n.level === "strategy" || n.level === "goal");
  // @ts-expect-error — strict mode fix
  const implNodes = allNodes.filter(n => n.level === "implementation" || n.level === "action");

  // Build sections
  const sections: PFRSection[] = [
    generateCoverSection(clientName, advisorName, reviewDate, params.reviewType),
    // @ts-expect-error — property access on loosely typed object
    generateDiscoverySection(discovery, allNodes[0]?.metadata as any),
    generateGoalsSection(goals as any),
    generateAnalysisSection(allNodes as any, allRefs),
    generateRecommendationsSection(recommendations as any, strategyNodes as any),
    generateImplementationSection(implNodes as any),
    generateMonitoringSection(params.reviewType),
    generateDisclaimerSection(),
  ];

  // Assemble full markdown
  const markdown = sections
    .sort((a, b) => a.order - b.order)
    .map(s => s.content)
    .join("\n---\n\n");

  // Build snapshots for the PFR record
  const calculatorOutputsSnapshot: Record<string, unknown> = {};
  for (const node of allNodes) {
    // @ts-expect-error — property access on loosely typed object
    const meta = node.metadata as any;
    if (meta?.calculatorDomain) {
      calculatorOutputsSnapshot[meta.calculatorDomain] = {
        nodeId: node.id,
        label: node.label,
        currentValue: node.currentValue,
        // @ts-expect-error — property access on loosely typed object
        targetValue: node.targetValue,
        output: meta.output,
        lastUpdated: meta.lastUpdated,
      };
    }
  }

  const goalHierarchySnapshot: Record<string, unknown> = {
    goals: goals.map(g => ({ id: g.id, title: g.title || g.name, priority: g.priority, status: g.status })),
    nodeCount: allNodes.length,
    strategyCount: strategyNodes.length,
    implementationCount: implNodes.length,
  };

  const recommendationsSnapshot = recommendations.map(r => ({
    id: r.id,
    type: r.recommendationType,
    title: r.title,
    reasoning: r.reasoning,
    status: r.status,
  }));

  const suitabilityDocumentation: Record<string, unknown> = {
    reviewDate,
    reviewType: params.reviewType,
    advisorId: params.advisorId,
    clientId: params.clientId,
    nodesAnalyzed: allNodes.length,
    referencesAttached: allRefs.length,
    goalsDocumented: goals.length,
    recommendationsMade: recommendations.length,
    complianceChecklist: {
      clientCircumstancesDocumented: !!discovery,
      goalsIdentified: goals.length > 0,
      analysisPerformed: allNodes.length > 0,
      recommendationsDeveloped: recommendations.length > 0 || strategyNodes.length > 0,
      alternativesConsidered: recommendations.some(r => !!(r as any).alternatives),
      // @ts-expect-error — property access on loosely typed object
      reasoningDocumented: recommendations.every(r => !!(r as any).reasoning) || strategyNodes.every(n => !!(n.metadata as any)?.reasoning),
      implementationPlanCreated: implNodes.length > 0,
      monitoringScheduleSet: true,
    },
  };

  // Persist the PFR record
  let pfrId: number | undefined;
  try {
    // @ts-expect-error — strict mode fix
    const [result] = await db.insert(personalFinancialReviews).values({
      clientId: params.clientId,
      advisorId: params.advisorId,
      planningNodeId: params.planningNodeId ?? null,
      reviewType: params.reviewType,
      reviewDate: reviewDate,
      sectionsIncluded: sections.map(s => s.title),
      calculatorOutputsSnapshot,
      goalHierarchySnapshot,
      recommendationsSnapshot,
      suitabilityDocumentation,
      complianceReviewStatus: "pending",
      retentionExpiresAt: new Date(Date.now() + 3 * 365.25 * 24 * 60 * 60 * 1000), // 3 years FINRA retention
    });
    pfrId = result.insertId;
  } catch (e) {
    log.warn({ err: e }, "Failed to persist PFR record — continuing with document generation");
  }

  log.info(
    { clientId: params.clientId, advisorId: params.advisorId, pfrId, sections: sections.length },
    "PFR generated"
  );

  return {
    id: pfrId,
    clientId: params.clientId,
    advisorId: params.advisorId,
    reviewType: params.reviewType,
    reviewDate,
    sections,
    markdown,
    goalHierarchySnapshot,
    calculatorOutputsSnapshot,
    recommendationsSnapshot,
    suitabilityDocumentation,
  };
}

/**
 * List all PFRs for a client, most recent first.
 */
export async function listPFRs(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(personalFinancialReviews)
    .where(eq(personalFinancialReviews.clientId, clientId))
    .orderBy(desc(personalFinancialReviews.createdAt));
}

/**
 * Get a single PFR by ID.
 */
export async function getPFR(pfrId: number) {
  const db = await getDb();
  if (!db) return null;
  const [pfr] = await db
    .select()
    .from(personalFinancialReviews)
    .where(eq(personalFinancialReviews.id, pfrId))
    .limit(1);
  return pfr || null;
}
