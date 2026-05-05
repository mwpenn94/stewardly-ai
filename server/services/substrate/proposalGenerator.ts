/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Substrate Primitive: Proposal Generator
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Generates structured financial proposals, recommendations, and action plans.
 * Used by:
 *   - Wealth Engine (investment proposals, rebalancing recommendations)
 *   - People Engine (client engagement proposals, referral outreach)
 *   - Planning Engine (financial plan proposals, scenario comparisons)
 *
 * Features:
 *   - Template-driven generation with LLM enhancement
 *   - Compliance-aware (auto-attaches disclaimers)
 *   - Multi-format output (markdown, structured JSON, PDF-ready)
 *   - Confidence scoring and evidence linking
 *
 * @substrate-primitive: proposal-generator
 */
import { invokeLLM } from "../../_core/llm";
import { classify } from "./classifier";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "substrate:proposalGenerator" });

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProposalType =
  | "investment_recommendation"
  | "rebalancing_plan"
  | "financial_plan"
  | "insurance_review"
  | "estate_plan"
  | "tax_strategy"
  | "client_engagement"
  | "referral_outreach"
  | "general";

export interface ProposalInput {
  type: ProposalType;
  title: string;
  context: string;
  clientProfile?: {
    name?: string;
    riskTolerance?: string;
    goals?: string[];
    timeHorizon?: string;
    netWorth?: string;
  };
  constraints?: string[];
  evidence?: Array<{ source: string; content: string; confidence: number }>;
  userId: number;
}

export interface ProposalSection {
  heading: string;
  content: string;
  confidence: number;
  evidenceRefs?: number[];
}

export interface GeneratedProposal {
  id: string;
  type: ProposalType;
  title: string;
  summary: string;
  sections: ProposalSection[];
  disclaimers: string[];
  overallConfidence: number;
  generatedAt: number;
  metadata: {
    tokenCount: number;
    modelUsed: string;
    complianceFlags: string[];
  };
}

// ─── Templates ───────────────────────────────────────────────────────────────

const PROPOSAL_TEMPLATES: Record<ProposalType, string> = {
  investment_recommendation: `Generate a structured investment recommendation with:
1. Executive Summary (2-3 sentences)
2. Current Situation Analysis
3. Recommended Actions (numbered list)
4. Risk Assessment
5. Expected Outcomes
6. Implementation Timeline`,

  rebalancing_plan: `Generate a portfolio rebalancing plan with:
1. Current Allocation Summary
2. Target Allocation
3. Specific Trades Required
4. Tax Implications
5. Timeline and Priority
6. Monitoring Schedule`,

  financial_plan: `Generate a comprehensive financial plan section with:
1. Goals Summary
2. Current Financial Position
3. Strategy Recommendations
4. Action Items (prioritized)
5. Milestones and Review Dates
6. Contingency Plans`,

  insurance_review: `Generate an insurance review with:
1. Current Coverage Summary
2. Gap Analysis
3. Recommendations
4. Cost-Benefit Analysis
5. Priority Actions`,

  estate_plan: `Generate estate planning recommendations with:
1. Current Estate Structure
2. Identified Issues
3. Recommended Changes
4. Tax Optimization Opportunities
5. Implementation Steps
6. Review Schedule`,

  tax_strategy: `Generate a tax strategy proposal with:
1. Current Tax Situation
2. Optimization Opportunities
3. Recommended Actions
4. Estimated Savings
5. Compliance Considerations
6. Implementation Timeline`,

  client_engagement: `Generate a client engagement proposal with:
1. Client Overview
2. Engagement Objectives
3. Proposed Services
4. Value Proposition
5. Timeline and Milestones
6. Next Steps`,

  referral_outreach: `Generate a referral outreach plan with:
1. Target Profile
2. Value Proposition
3. Outreach Strategy
4. Talking Points
5. Follow-up Schedule`,

  general: `Generate a structured recommendation with:
1. Summary
2. Analysis
3. Recommendations
4. Action Items
5. Next Steps`,
};

const COMPLIANCE_DISCLAIMERS: Record<string, string> = {
  investment: "This is for informational purposes only and does not constitute investment advice. Past performance does not guarantee future results.",
  tax: "Tax information provided is general in nature. Consult a qualified tax professional for advice specific to your situation.",
  insurance: "Insurance recommendations are general guidance. Coverage needs vary by individual. Consult a licensed insurance professional.",
  estate: "Estate planning information is general in nature. Consult a qualified estate planning attorney for advice specific to your situation.",
  general: "This information is provided for educational purposes and should not be considered professional financial advice.",
};

// ─── Generator ───────────────────────────────────────────────────────────────

let proposalCounter = 0;

/**
 * Generate a structured proposal using LLM with template guidance.
 */
export async function generateProposal(input: ProposalInput): Promise<GeneratedProposal> {
  const proposalId = `prop_${Date.now()}_${++proposalCounter}`;
  const template = PROPOSAL_TEMPLATES[input.type] || PROPOSAL_TEMPLATES.general;

  // Classify input for compliance
  const classification = classify(input.context);
  const complianceFlags = classification.flags;

  // Build context
  const contextParts: string[] = [
    `Proposal Type: ${input.type}`,
    `Title: ${input.title}`,
    `Context: ${input.context}`,
  ];

  if (input.clientProfile) {
    contextParts.push(`Client Profile:`);
    if (input.clientProfile.name) contextParts.push(`  Name: ${input.clientProfile.name}`);
    if (input.clientProfile.riskTolerance) contextParts.push(`  Risk Tolerance: ${input.clientProfile.riskTolerance}`);
    if (input.clientProfile.goals) contextParts.push(`  Goals: ${input.clientProfile.goals.join(", ")}`);
    if (input.clientProfile.timeHorizon) contextParts.push(`  Time Horizon: ${input.clientProfile.timeHorizon}`);
  }

  if (input.constraints?.length) {
    contextParts.push(`Constraints: ${input.constraints.join("; ")}`);
  }

  if (input.evidence?.length) {
    contextParts.push(`Supporting Evidence:`);
    input.evidence.forEach((e, i) => {
      contextParts.push(`  [${i + 1}] ${e.source}: ${e.content} (confidence: ${e.confidence})`);
    });
  }

  const systemPrompt = `You are a financial advisory AI generating a structured proposal. Follow the template structure exactly. Be specific, actionable, and evidence-based. Include confidence levels (0-1) for each section.

Template Structure:
${template}

Return a JSON object with:
{
  "summary": "2-3 sentence executive summary",
  "sections": [
    { "heading": "Section Title", "content": "Section content...", "confidence": 0.85, "evidenceRefs": [1, 2] }
  ]
}

Return ONLY valid JSON.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextParts.join("\n") },
      ],
      response_format: { type: "json_object" as any },
    });

    const content = response?.choices?.[0]?.message?.content ?? "{}";
    const tokenCount = response?.usage?.total_tokens ?? 0;

    let parsed: { summary?: string; sections?: ProposalSection[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { summary: "Unable to generate proposal", sections: [] };
    }

    // Determine disclaimers
    const disclaimers: string[] = [];
    if (["investment_recommendation", "rebalancing_plan"].includes(input.type)) {
      disclaimers.push(COMPLIANCE_DISCLAIMERS.investment);
    }
    if (input.type === "tax_strategy") {
      disclaimers.push(COMPLIANCE_DISCLAIMERS.tax);
    }
    if (input.type === "insurance_review") {
      disclaimers.push(COMPLIANCE_DISCLAIMERS.insurance);
    }
    if (input.type === "estate_plan") {
      disclaimers.push(COMPLIANCE_DISCLAIMERS.estate);
    }
    if (disclaimers.length === 0) {
      disclaimers.push(COMPLIANCE_DISCLAIMERS.general);
    }

    const sections = (parsed.sections ?? []).map((s) => ({
      heading: s.heading ?? "Section",
      content: s.content ?? "",
      confidence: typeof s.confidence === "number" ? s.confidence : 0.7,
      evidenceRefs: s.evidenceRefs,
    }));

    const overallConfidence = sections.length > 0
      ? sections.reduce((sum, s) => sum + s.confidence, 0) / sections.length
      : 0.5;

    log.info({ proposalId, type: input.type, sections: sections.length, overallConfidence }, "Proposal generated");

    return {
      id: proposalId,
      type: input.type,
      title: input.title,
      summary: parsed.summary ?? "Proposal generated",
      sections,
      disclaimers,
      overallConfidence,
      generatedAt: Date.now(),
      metadata: {
        tokenCount,
        modelUsed: "forge-default",
        complianceFlags,
      },
    };
  } catch (err) {
    log.error({ err, proposalId }, "Proposal generation failed");
    return {
      id: proposalId,
      type: input.type,
      title: input.title,
      summary: "Proposal generation encountered an error. Please try again.",
      sections: [],
      disclaimers: [COMPLIANCE_DISCLAIMERS.general],
      overallConfidence: 0,
      generatedAt: Date.now(),
      metadata: {
        tokenCount: 0,
        modelUsed: "none",
        complianceFlags: ["generation_error"],
      },
    };
  }
}

/**
 * Get available proposal types with descriptions.
 */
export function getProposalTypes(): Array<{ type: ProposalType; label: string; description: string }> {
  return [
    { type: "investment_recommendation", label: "Investment Recommendation", description: "Structured investment advice with risk assessment" },
    { type: "rebalancing_plan", label: "Rebalancing Plan", description: "Portfolio rebalancing with specific trades" },
    { type: "financial_plan", label: "Financial Plan", description: "Comprehensive financial planning section" },
    { type: "insurance_review", label: "Insurance Review", description: "Coverage gap analysis and recommendations" },
    { type: "estate_plan", label: "Estate Plan", description: "Estate planning recommendations" },
    { type: "tax_strategy", label: "Tax Strategy", description: "Tax optimization opportunities" },
    { type: "client_engagement", label: "Client Engagement", description: "Client engagement proposal" },
    { type: "referral_outreach", label: "Referral Outreach", description: "Referral outreach plan" },
    { type: "general", label: "General", description: "General structured recommendation" },
  ];
}
