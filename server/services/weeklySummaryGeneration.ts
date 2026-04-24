/**
 * Weekly Summary Generation Service — PROMPT 8
 * =============================================
 * Generates advisor-facing weekly digest covering:
 *   - Headline metric of the week
 *   - Pipeline coverage status
 *   - Funnel-by-funnel update (recruit, HNW, COI, B2B, dormant)
 *   - Compliance health
 *   - Variances and corrections summary
 *   - Action items queue snapshot
 *   - Next week's planned focus
 */
import { invokeLLM } from "../_core/llm";

// ─── Types ───────────────────────────────────────────────────────────────

export interface FunnelSnapshot {
  funnelName: string; // e.g., "Recruit", "HNW", "COI", "B2B", "Dormant"
  leadsEntered: number;
  leadsQualified: number;
  leadsConverted: number;
  conversionRate: number;
  avgDaysInPipeline: number;
  totalPipelineValue: number;
  touchesSent: number;
  repliesReceived: number;
  replyRate: number;
  meetingsBooked: number;
}

export interface ComplianceHealthSnapshot {
  totalTouchesSent: number;
  touchesAudited: number;
  auditPassRate: number;
  failCount: number;
  conditionalPassCount: number;
  topFindings: string[];
  esiExpiringThisMonth: number;
  optOutsProcessed: number;
}

export interface PipelineCoverageSnapshot {
  discoveryValue: number;
  solutionDesignValue: number;
  validationValue: number;
  commitValue: number;
  targetQuotaValue: number;
  coverageHealth: "healthy" | "at_risk" | "critical";
}

export interface VarianceItem {
  metric: string;
  expected: number;
  actual: number;
  variancePct: number;
  direction: "above" | "below";
  severity: "minor" | "moderate" | "critical";
}

export interface ActionItem {
  id: string;
  description: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  assignedTo: string;
  status: "pending" | "in_progress" | "completed" | "overdue";
}

export interface WeeklySummaryInput {
  advisorName: string;
  weekStartDate: string; // ISO date
  weekEndDate: string;   // ISO date
  headlineMetric: {
    name: string;
    value: number;
    unit: string;
    weekOverWeekChange: number;
    isPositive: boolean;
  };
  pipelineCoverage: PipelineCoverageSnapshot;
  funnelSnapshots: FunnelSnapshot[];
  complianceHealth: ComplianceHealthSnapshot;
  variances: VarianceItem[];
  actionItems: ActionItem[];
  nextWeekFocus: string[];
  currentPattern: string;
}

export interface WeeklySummaryOutput {
  summaryMarkdown: string;
  executiveSummary: string;
  criticalAlerts: string[];
  generatedAt: number;
}

// ─── LLM-Powered Summary Generation ─────────────────────────────────────

export async function generateWeeklySummary(
  input: WeeklySummaryInput
): Promise<WeeklySummaryOutput> {
  const systemPrompt = `You are the WealthBridge AI weekly summary generator for financial advisors.
Generate a comprehensive, actionable weekly digest in Markdown format.

Structure:
1. **Headline Metric of the Week** — The single most important number with context
2. **Pipeline Coverage Status** — Discovery/Solution Design/Validation/Commit multiples vs quota
3. **Funnel-by-Funnel Update** — Each funnel (Recruit, HNW, COI, B2B, Dormant) with key metrics
4. **Compliance Health** — Audit pass rate, findings, ESI status, opt-outs
5. **Variances and Corrections Summary** — Metrics that deviated from targets
6. **Action Items Queue Snapshot** — Prioritized list of pending actions
7. **Next Week's Planned Focus** — Strategic priorities for the coming week

Guidelines:
- Use specific numbers, not vague language
- Flag critical items with ⚠️
- Keep tone professional but direct
- Include week-over-week comparisons where available
- Highlight wins as well as concerns
- End with 3 specific, actionable recommendations`;

  const userPrompt = `Generate the weekly summary for ${input.advisorName} (${input.currentPattern}).

Week: ${input.weekStartDate} to ${input.weekEndDate}

HEADLINE METRIC:
${input.headlineMetric.name}: ${input.headlineMetric.value} ${input.headlineMetric.unit} (${input.headlineMetric.isPositive ? "+" : ""}${input.headlineMetric.weekOverWeekChange}% WoW)

PIPELINE COVERAGE:
Discovery: $${(input.pipelineCoverage.discoveryValue / 1_000_000).toFixed(1)}M
Solution Design: $${(input.pipelineCoverage.solutionDesignValue / 1_000_000).toFixed(1)}M
Validation: $${(input.pipelineCoverage.validationValue / 1_000_000).toFixed(1)}M
Commit: $${(input.pipelineCoverage.commitValue / 1_000_000).toFixed(1)}M
Target Quota: $${(input.pipelineCoverage.targetQuotaValue / 1_000_000).toFixed(1)}M
Health: ${input.pipelineCoverage.coverageHealth}

FUNNEL SNAPSHOTS:
${input.funnelSnapshots.map(f => `${f.funnelName}: ${f.leadsEntered} entered → ${f.leadsQualified} qualified → ${f.leadsConverted} converted (${(f.conversionRate * 100).toFixed(1)}%), ${f.touchesSent} touches, ${f.repliesReceived} replies (${(f.replyRate * 100).toFixed(1)}%), ${f.meetingsBooked} meetings, $${(f.totalPipelineValue / 1_000_000).toFixed(2)}M pipeline, avg ${f.avgDaysInPipeline} days`).join("\n")}

COMPLIANCE HEALTH:
${input.complianceHealth.totalTouchesSent} touches sent, ${input.complianceHealth.touchesAudited} audited
Pass rate: ${(input.complianceHealth.auditPassRate * 100).toFixed(1)}%
Fails: ${input.complianceHealth.failCount}, Conditional: ${input.complianceHealth.conditionalPassCount}
Top findings: ${input.complianceHealth.topFindings.join("; ")}
ESI expiring this month: ${input.complianceHealth.esiExpiringThisMonth}
Opt-outs processed: ${input.complianceHealth.optOutsProcessed}

VARIANCES:
${input.variances.map(v => `${v.metric}: expected ${v.expected}, actual ${v.actual} (${v.direction} by ${v.variancePct.toFixed(1)}%, ${v.severity})`).join("\n")}

ACTION ITEMS:
${input.actionItems.map(a => `[${a.priority.toUpperCase()}] ${a.description} — ${a.status} (due: ${a.dueDate})`).join("\n")}

NEXT WEEK FOCUS:
${input.nextWeekFocus.map((f, i) => `${i + 1}. ${f}`).join("\n")}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const summaryMarkdown = response.choices[0]?.message?.content || "";

    // Extract critical alerts from variances
    const criticalAlerts = input.variances
      .filter(v => v.severity === "critical")
      .map(v => `${v.metric} is ${v.direction} target by ${v.variancePct.toFixed(1)}%`);

    // Add compliance alerts
    if (input.complianceHealth.auditPassRate < 0.9) {
      criticalAlerts.push(`Compliance audit pass rate (${(input.complianceHealth.auditPassRate * 100).toFixed(1)}%) below 90% threshold`);
    }
    if (input.complianceHealth.esiExpiringThisMonth > 0) {
      criticalAlerts.push(`${input.complianceHealth.esiExpiringThisMonth} ESI pre-approvals expiring this month`);
    }

    // Generate executive summary (first 2 sentences)
    const lines = summaryMarkdown.split("\n").filter(l => l.trim() && !l.startsWith("#"));
    const executiveSummary = lines.slice(0, 3).join(" ").slice(0, 500);

    return {
      summaryMarkdown,
      executiveSummary,
      criticalAlerts,
      generatedAt: Date.now(),
    };
  } catch (error) {
    return {
      summaryMarkdown: `# Weekly Summary — ${input.weekStartDate} to ${input.weekEndDate}\n\n*Summary generation encountered an error. Please review metrics manually.*\n\n## Key Numbers\n- Headline: ${input.headlineMetric.name} = ${input.headlineMetric.value} ${input.headlineMetric.unit}\n- Pipeline Health: ${input.pipelineCoverage.coverageHealth}\n- Compliance Pass Rate: ${(input.complianceHealth.auditPassRate * 100).toFixed(1)}%\n- Active Funnels: ${input.funnelSnapshots.length}`,
      executiveSummary: `Weekly summary for ${input.advisorName} — ${input.headlineMetric.name}: ${input.headlineMetric.value} ${input.headlineMetric.unit}`,
      criticalAlerts: input.variances.filter(v => v.severity === "critical").map(v => v.metric),
      generatedAt: Date.now(),
    };
  }
}

// ─── Static Summary Builder (no LLM, for fallback) ──────────────────────

export function buildStaticSummary(input: WeeklySummaryInput): string {
  const sections: string[] = [];

  sections.push(`# Weekly Summary — ${input.weekStartDate} to ${input.weekEndDate}`);
  sections.push(`**Advisor:** ${input.advisorName} | **Pattern:** ${input.currentPattern}\n`);

  // Headline
  sections.push(`## Headline Metric of the Week`);
  sections.push(`**${input.headlineMetric.name}:** ${input.headlineMetric.value} ${input.headlineMetric.unit} (${input.headlineMetric.isPositive ? "+" : ""}${input.headlineMetric.weekOverWeekChange}% WoW)\n`);

  // Pipeline
  sections.push(`## Pipeline Coverage Status`);
  sections.push(`| Stage | Value | Multiple |`);
  sections.push(`|-------|-------|----------|`);
  const target = input.pipelineCoverage.targetQuotaValue || 1;
  sections.push(`| Discovery | $${(input.pipelineCoverage.discoveryValue / 1_000_000).toFixed(1)}M | ${(input.pipelineCoverage.discoveryValue / target).toFixed(1)}x |`);
  sections.push(`| Solution Design | $${(input.pipelineCoverage.solutionDesignValue / 1_000_000).toFixed(1)}M | ${(input.pipelineCoverage.solutionDesignValue / target).toFixed(1)}x |`);
  sections.push(`| Validation | $${(input.pipelineCoverage.validationValue / 1_000_000).toFixed(1)}M | ${(input.pipelineCoverage.validationValue / target).toFixed(1)}x |`);
  sections.push(`| Commit | $${(input.pipelineCoverage.commitValue / 1_000_000).toFixed(1)}M | ${(input.pipelineCoverage.commitValue / target).toFixed(1)}x |`);
  sections.push(`\n**Health:** ${input.pipelineCoverage.coverageHealth}\n`);

  // Funnels
  sections.push(`## Funnel-by-Funnel Update`);
  for (const f of input.funnelSnapshots) {
    sections.push(`### ${f.funnelName} Funnel`);
    sections.push(`- Entered: ${f.leadsEntered} → Qualified: ${f.leadsQualified} → Converted: ${f.leadsConverted} (${(f.conversionRate * 100).toFixed(1)}%)`);
    sections.push(`- Touches: ${f.touchesSent} | Replies: ${f.repliesReceived} (${(f.replyRate * 100).toFixed(1)}%) | Meetings: ${f.meetingsBooked}`);
    sections.push(`- Pipeline Value: $${(f.totalPipelineValue / 1_000_000).toFixed(2)}M | Avg Days: ${f.avgDaysInPipeline}\n`);
  }

  // Compliance
  sections.push(`## Compliance Health`);
  sections.push(`- Touches Sent: ${input.complianceHealth.totalTouchesSent} | Audited: ${input.complianceHealth.touchesAudited}`);
  sections.push(`- Pass Rate: ${(input.complianceHealth.auditPassRate * 100).toFixed(1)}% | Fails: ${input.complianceHealth.failCount}`);
  sections.push(`- ESI Expiring: ${input.complianceHealth.esiExpiringThisMonth} | Opt-Outs: ${input.complianceHealth.optOutsProcessed}\n`);

  // Variances
  if (input.variances.length > 0) {
    sections.push(`## Variances and Corrections`);
    sections.push(`| Metric | Expected | Actual | Variance | Severity |`);
    sections.push(`|--------|----------|--------|----------|----------|`);
    for (const v of input.variances) {
      sections.push(`| ${v.metric} | ${v.expected} | ${v.actual} | ${v.direction} ${v.variancePct.toFixed(1)}% | ${v.severity} |`);
    }
    sections.push("");
  }

  // Action Items
  if (input.actionItems.length > 0) {
    sections.push(`## Action Items`);
    for (const a of input.actionItems) {
      const icon = a.priority === "high" ? "🔴" : a.priority === "medium" ? "🟡" : "🟢";
      sections.push(`- ${icon} **${a.description}** — ${a.status} (due: ${a.dueDate})`);
    }
    sections.push("");
  }

  // Next Week
  sections.push(`## Next Week's Focus`);
  for (const [i, f] of input.nextWeekFocus.entries()) {
    sections.push(`${i + 1}. ${f}`);
  }

  return sections.join("\n");
}
