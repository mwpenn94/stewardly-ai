/**
 * PDF Report Generator — Calculator Results Summary
 *
 * Generates a holistic financial summary PDF from engine results.
 * Uses the built-in LLM to create narrative summaries, then formats
 * as a structured report suitable for client delivery.
 */
import { logger } from "../_core/logger";
import { contextualLLM } from "../shared/stewardlyWiring";
import { storagePut } from "../storage";

const log = logger.child({ module: "pdf-report" });

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ReportInput {
  clientName: string;
  clientAge: number;
  clientIncome: number;

  // Strategy results
  strategies: Array<{
    name: string;
    companyKey: string;
    totalValue: number;
    netValue: number;
    roi: number;
    liquidWealth: number;
    protection: number;
    taxSavings: number;
    grossIncome: number;
    totalCost: number;
  }>;

  // Winner info
  winnerName: string;
  winnerTotalValue: number;

  // Monte Carlo summary
  monteCarlo?: {
    medianFinal: number;
    p10Final: number;
    p90Final: number;
  };

  // Stress test summary
  stressTests?: Array<{
    scenario: string;
    maxDrawdown: number;
    recoveryYears: number;
    finalBalance: number;
  }>;

  // Back-plan summary
  backPlan?: {
    targetIncome: number;
    neededGDC: number;
    dailyApproaches: number;
    monthlyApps: number;
  };

  horizon: number;
  generatedAt: string;
}

export interface ReportOutput {
  url: string;
  key: string;
  markdownContent: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * Generate a comprehensive financial report in Markdown format.
 * Uses LLM for narrative sections, structured data for tables.
 */
export async function generateReport(input: ReportInput): Promise<ReportOutput> {
  // Build the strategy comparison table
  const strategyTable = input.strategies.map((s) =>
    `| ${s.name} | ${fmt(s.totalValue)} | ${fmt(s.netValue)} | ${pct(s.roi)} | ${fmt(s.liquidWealth)} | ${fmt(s.protection)} | ${fmt(s.taxSavings)} |`
  ).join("\n");

  // Generate narrative summary via LLM (routed through contextualLLM so it
  // honors the 5-layer config, guardrails, routing, and usage tracking).
  let narrative = "";
  try {
    const llmResponse = await contextualLLM({
      contextType: "analysis",
      taskType: "chat",
      enableWebSearch: false,
      messages: [
        {
          role: "system",
          content: `You are a financial planning report writer. Write a professional, concise executive summary (3-4 paragraphs) for a client financial plan. Use specific numbers from the data. Be factual, not promotional. Include methodology disclaimers. Do NOT use markdown headers — just flowing paragraphs.`,
        },
        {
          role: "user",
          content: `Client: ${input.clientName}, Age ${input.clientAge}, Income ${fmt(input.clientIncome)}.
${input.strategies.length} strategies compared over ${input.horizon} years.
Winner: ${input.winnerName} with ${fmt(input.winnerTotalValue)} total value.
${input.monteCarlo ? `Monte Carlo median: ${fmt(input.monteCarlo.medianFinal)}, 10th percentile: ${fmt(input.monteCarlo.p10Final)}, 90th: ${fmt(input.monteCarlo.p90Final)}.` : ""}
${input.stressTests?.length ? `Stress tests: ${input.stressTests.map((s) => `${s.scenario} max drawdown ${pct(s.maxDrawdown)}`).join(", ")}.` : ""}
Write the executive summary.`,
        },
      ],
    });
    const rawContent = llmResponse?.choices?.[0]?.message?.content;
    narrative = typeof rawContent === "string" ? rawContent : "Executive summary generation unavailable.";
  } catch (err: any) {
    log.error({ err: err.message }, "LLM narrative generation failed");
    narrative = `This report presents a ${input.horizon}-year financial projection for ${input.clientName}. ${input.strategies.length} strategies were compared, with ${input.winnerName} emerging as the optimal approach with a projected total value of ${fmt(input.winnerTotalValue)}.`;
  }

  // Build full markdown report
  const markdown = `# WealthBridge Financial Plan
## ${input.clientName} — ${input.horizon}-Year Projection

**Generated:** ${input.generatedAt}
**Client Age:** ${input.clientAge} | **Income:** ${fmt(input.clientIncome)}

---

## Executive Summary

${narrative}

---

## Strategy Comparison

| Strategy | Total Value | Net Value | ROI | Liquid Wealth | Protection | Tax Savings |
|----------|-------------|-----------|-----|---------------|------------|-------------|
${strategyTable}

**Recommended Strategy:** ${input.winnerName} — ${fmt(input.winnerTotalValue)} projected total value

---

${input.monteCarlo ? `## Monte Carlo Analysis (1,000 Trials)

| Percentile | Projected Value |
|------------|-----------------|
| 90th (Optimistic) | ${fmt(input.monteCarlo.p90Final)} |
| 50th (Median) | ${fmt(input.monteCarlo.medianFinal)} |
| 10th (Conservative) | ${fmt(input.monteCarlo.p10Final)} |

---

` : ""}${input.stressTests?.length ? `## Stress Test Results

| Scenario | Max Drawdown | Recovery | Final Balance |
|----------|--------------|----------|---------------|
${input.stressTests.map((s) => `| ${s.scenario} | ${pct(s.maxDrawdown)} | ${s.recoveryYears} yrs | ${fmt(s.finalBalance)} |`).join("\n")}

---

` : ""}${input.backPlan ? `## Activity Back-Plan

| Metric | Value |
|--------|-------|
| Target Income | ${fmt(input.backPlan.targetIncome)} |
| Required GDC | ${fmt(input.backPlan.neededGDC)} |
| Daily Approaches | ${input.backPlan.dailyApproaches} |
| Monthly Applications | ${input.backPlan.monthlyApps} |

---

` : ""}## Methodology & Disclaimers

This report was generated by the WealthBridge v7 Holistic Engine. All projections are hypothetical and based on the assumptions entered. Past performance does not guarantee future results. The Monte Carlo simulation uses randomized market returns with historical volatility parameters. Stress tests apply actual historical market crash sequences to the portfolio.

**Important:** This report is for educational and illustrative purposes only. It does not constitute financial advice. Consult with a licensed financial professional before making investment decisions.

All product references cite industry-standard sources including LIMRA, SOA, Morningstar, and the Federal Reserve. Rate assumptions are based on current market conditions and may change.

---

*WealthBridge Financial Group — Stewardly Platform*
*Report ID: ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}*
`;

  // Upload to S3
  const key = `reports/${Date.now()}-${input.clientName.replace(/\s+/g, "-").toLowerCase()}.md`;
  try {
    const { url } = await storagePut(key, Buffer.from(markdown, "utf-8"), "text/markdown");
    log.info({ key, clientName: input.clientName }, "Report uploaded to S3");
    return { url, key, markdownContent: markdown };
  } catch (err: any) {
    log.error({ err: err.message }, "Report upload failed");
    // Return markdown content even if upload fails
    return { url: "", key, markdownContent: markdown };
  }
}
