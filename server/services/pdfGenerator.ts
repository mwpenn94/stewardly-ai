/**
 * PDF Generator Service
 * Generates branded financial plan reports using PDFKit.
 * Supports all 8 analytical model outputs.
 */
import PDFDocument from "pdfkit";

// ─── TYPES ─────────────────────────────────────────────────────────
export interface PDFReportInput {
  clientName: string;
  advisorName?: string;
  firmName?: string;
  generatedAt: Date;
  sections: ReportSection[];
  disclaimer?: string;
}

export interface ReportSection {
  title: string;
  modelSlug?: string;
  data: any;
  summary?: string;
}

// ─── COLORS ────────────────────────────────────────────────────────
const C = {
  primary: [30, 64, 120] as [number, number, number],     // Deep navy
  accent: [59, 130, 246] as [number, number, number],      // Blue
  success: [34, 197, 94] as [number, number, number],      // Green
  warning: [245, 158, 11] as [number, number, number],     // Amber
  danger: [239, 68, 68] as [number, number, number],       // Red
  text: [30, 30, 40] as [number, number, number],
  muted: [120, 120, 140] as [number, number, number],
  bg: [248, 249, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  divider: [220, 225, 235] as [number, number, number],
};

// ─── HELPERS ───────────────────────────────────────────────────────
function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function fmtK(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return fmt(n);
}
function pctStr(n: number): string {
  const val = n > 1 ? n : n * 100;
  return `${val.toFixed(1)}%`;
}

// ─── MAIN GENERATOR ────────────────────────────────────────────────
export function generateFinancialReport(input: PDFReportInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 60, bottom: 60, left: 55, right: 55 },
      bufferPages: true,
      info: {
        Title: `Financial Plan Report — ${input.clientName}`,
        Author: input.advisorName || "Stewardly AI",
        Subject: "Comprehensive Financial Analysis",
        Creator: "WealthBridge AI by Stewardly",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ─── COVER PAGE ──────────────────────────────────────────────
    drawCoverPage(doc, input);

    // ─── TABLE OF CONTENTS ───────────────────────────────────────
    doc.addPage();
    drawTableOfContents(doc, input.sections);

    // ─── SECTIONS ────────────────────────────────────────────────
    for (const section of input.sections) {
      doc.addPage();
      drawSectionHeader(doc, section.title);
      if (section.summary) {
        doc.fontSize(10).fillColor(C.text).text(section.summary, { width: 500, lineGap: 3 });
        doc.moveDown(0.8);
      }
      renderModelSection(doc, section);
    }

    // ─── DISCLAIMER PAGE ─────────────────────────────────────────
    doc.addPage();
    drawDisclaimer(doc, input.disclaimer);

    // ─── PAGE NUMBERS ────────────────────────────────────────────
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      drawPageFooter(doc, i + 1, pageCount, input.firmName || "Stewardly");
    }

    doc.end();
  });
}

// ─── COVER PAGE ────────────────────────────────────────────────────
function drawCoverPage(doc: PDFKit.PDFDocument, input: PDFReportInput) {
  // Background
  doc.rect(0, 0, 612, 792).fill(C.primary);

  // Accent bar
  doc.rect(0, 300, 612, 6).fill(C.accent);

  // Title
  doc.fontSize(36).fillColor(C.white)
    .text("Financial Plan", 55, 180, { width: 500 })
    .fontSize(18).fillColor([180, 200, 240])
    .text("Comprehensive Analysis Report", 55, 230, { width: 500 });

  // Client info
  doc.fontSize(16).fillColor(C.white)
    .text(`Prepared for: ${input.clientName}`, 55, 340, { width: 500 });
  if (input.advisorName) {
    doc.fontSize(12).fillColor([180, 200, 240])
      .text(`Advisor: ${input.advisorName}`, 55, 370);
  }
  doc.fontSize(11).fillColor([180, 200, 240])
    .text(`Generated: ${input.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 55, 395);

  // Footer
  doc.fontSize(10).fillColor([120, 140, 180])
    .text(input.firmName || "Stewardly — Digital Financial Twin", 55, 700, { width: 500, align: "center" });
  doc.fontSize(8).fillColor([100, 120, 160])
    .text("Powered by WealthBridge AI", 55, 720, { width: 500, align: "center" });
}

// ─── TABLE OF CONTENTS ─────────────────────────────────────────────
function drawTableOfContents(doc: PDFKit.PDFDocument, sections: ReportSection[]) {
  doc.fontSize(20).fillColor(C.primary).text("Table of Contents", { underline: false });
  doc.moveDown(0.5);
  doc.rect(55, doc.y, 200, 2).fill(C.accent);
  doc.moveDown(1);

  sections.forEach((s, i) => {
    doc.fontSize(12).fillColor(C.text)
      .text(`${i + 1}.  ${s.title}`, 70, doc.y, { continued: false });
    doc.moveDown(0.3);
  });
}

// ─── SECTION HEADER ────────────────────────────────────────────────
function drawSectionHeader(doc: PDFKit.PDFDocument, title: string) {
  doc.fontSize(18).fillColor(C.primary).text(title);
  doc.moveDown(0.3);
  doc.rect(55, doc.y, 500, 2).fill(C.accent);
  doc.moveDown(0.8);
}

// ─── STAT TABLE ────────────────────────────────────────────────────
function drawStatTable(doc: PDFKit.PDFDocument, stats: Array<{ label: string; value: string }>) {
  const colWidth = 240;
  const startX = 55;
  let x = startX;
  let y = doc.y;
  const rowHeight = 22;

  stats.forEach((stat, i) => {
    if (i > 0 && i % 2 === 0) {
      x = startX;
      y += rowHeight;
    }
    // Background
    if (Math.floor(i / 2) % 2 === 0) {
      doc.rect(x, y, colWidth, rowHeight).fill(C.bg);
    }
    doc.fontSize(8).fillColor(C.muted).text(stat.label, x + 8, y + 4, { width: 120 });
    doc.fontSize(10).fillColor(C.text).text(stat.value, x + 130, y + 4, { width: 100, align: "right" });
    x = startX + colWidth + 20;
  });

  doc.y = y + rowHeight + 10;
}

// ─── MODEL SECTION RENDERER ───────────────────────────────────────
function renderModelSection(doc: PDFKit.PDFDocument, section: ReportSection) {
  const data = section.data;
  if (!data) {
    doc.fontSize(10).fillColor(C.muted).text("No data available for this model.");
    return;
  }

  switch (section.modelSlug) {
    case "monte-carlo-retirement":
      renderRetirement(doc, data);
      break;
    case "debt-optimization":
      renderDebt(doc, data);
      break;
    case "tax-optimization":
      renderTax(doc, data);
      break;
    case "cash-flow-projection":
      renderCashFlow(doc, data);
      break;
    case "insurance-gap-analysis":
      renderInsurance(doc, data);
      break;
    case "estate-planning":
      renderEstate(doc, data);
      break;
    case "education-funding":
      renderEducation(doc, data);
      break;
    case "risk-tolerance-assessment":
      renderRisk(doc, data);
      break;
    default:
      renderGeneric(doc, data);
  }
}

// ─── RETIREMENT ────────────────────────────────────────────────────
function renderRetirement(doc: PDFKit.PDFDocument, data: any) {
  const successColor = data.successRate >= 80 ? C.success : data.successRate >= 50 ? C.warning : C.danger;
  doc.fontSize(28).fillColor(successColor).text(`${data.successRate?.toFixed(1)}%`, { continued: true });
  doc.fontSize(12).fillColor(C.muted).text("  Success Rate (Monte Carlo)", { lineGap: 2 });
  doc.moveDown(0.5);

  drawStatTable(doc, [
    { label: "Median Ending Balance", value: fmtK(data.medianEndingBalance) },
    { label: "Balance at Retirement", value: fmtK(data.medianBalanceAtRetirement) },
    { label: "10th Percentile", value: fmtK(data.percentile10) },
    { label: "90th Percentile", value: fmtK(data.percentile90) },
    { label: "25th Percentile", value: fmtK(data.percentile25) },
    { label: "75th Percentile", value: fmtK(data.percentile75) },
    { label: "Total Contributions", value: fmtK(data.totalContributions) },
    { label: "Additional Savings Needed", value: fmtK(data.recommendedAdditionalSavings) },
  ]);

  // Year-by-year table (sampled)
  const years = data.yearByYearMedian || [];
  if (years.length > 0) {
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(C.primary).text("Projected Balance by Age (Sampled)");
    doc.moveDown(0.3);
    const sampled = years.length > 12
      ? Array.from({ length: 12 }, (_, i) => years[Math.floor(i * (years.length - 1) / 11)])
      : years;
    drawDataTable(doc, ["Age", "Balance"], sampled.map((y: any) => [String(y.age), fmtK(y.balance)]));
  }
}

// ─── DEBT ──────────────────────────────────────────────────────────
function renderDebt(doc: PDFKit.PDFDocument, data: any) {
  drawStatTable(doc, [
    { label: "Total Debt", value: fmtK(data.totalDebt) },
    { label: "Weighted Avg Rate", value: pctStr(data.weightedAverageRate) },
    { label: "Recommendation", value: data.recommendation?.split(".")[0] || "—" },
    { label: "Min-Only Interest", value: fmtK(data.minimumOnly?.totalInterestPaid || 0) },
  ]);

  doc.moveDown(0.5);
  doc.fontSize(11).fillColor(C.primary).text("Strategy Comparison");
  doc.moveDown(0.3);

  const strategies = ["avalanche", "snowball", "hybrid"].filter(s => data[s]);
  drawDataTable(doc,
    ["Strategy", "Months", "Total Interest", "Total Paid", "Interest Saved"],
    strategies.map(s => [
      data[s].strategy || s,
      String(data[s].monthsToPayoff),
      fmtK(data[s].totalInterestPaid),
      fmtK(data[s].totalPaid),
      fmtK(data[s].interestSaved),
    ])
  );
}

// ─── TAX ───────────────────────────────────────────────────────────
function renderTax(doc: PDFKit.PDFDocument, data: any) {
  drawStatTable(doc, [
    { label: "Tax Liability", value: fmtK(data.currentTaxLiability) },
    { label: "Effective Rate", value: pctStr(data.effectiveRate) },
    { label: "Marginal Rate", value: pctStr(data.marginalRate) },
    { label: "Total Optimized Savings", value: fmtK(data.totalOptimizedSavings) },
  ]);

  // Roth conversion
  if (data.rothConversion) {
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(C.primary).text("Roth Conversion Analysis");
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(C.text)
      .text(`Recommended: ${data.rothConversion.recommended ? "Yes" : "No"}`)
      .text(`Optimal Amount: ${fmtK(data.rothConversion.optimalAmount)}`)
      .text(`Tax Cost Now: ${fmtK(data.rothConversion.taxCostNow)}`)
      .text(`20-Year Projected Savings: ${fmtK(data.rothConversion.projectedSavings20yr)}`)
      .text(`Break-Even: ${data.rothConversion.breakEvenYears} years`);
  }

  // Bracket analysis
  if (data.bracketAnalysis?.length) {
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(C.primary).text("Bracket Analysis");
    doc.moveDown(0.3);
    drawDataTable(doc,
      ["Bracket", "Rate", "Income", "Tax"],
      data.bracketAnalysis.map((b: any) => [b.bracket, pctStr(b.rate), fmtK(b.incomeInBracket), fmtK(b.taxInBracket)])
    );
  }
}

// ─── CASH FLOW ─────────────────────────────────────────────────────
function renderCashFlow(doc: PDFKit.PDFDocument, data: any) {
  const s = data.summary || {};
  drawStatTable(doc, [
    { label: "Avg Monthly Income", value: fmtK(s.averageMonthlyIncome || 0) },
    { label: "Avg Monthly Expenses", value: fmtK(s.averageMonthlyExpenses || 0) },
    { label: "Savings Rate", value: pctStr(s.savingsRate || 0) },
    { label: "Projected End Balance", value: fmtK(s.projectedEndBalance || 0) },
    { label: "Lowest Balance", value: fmtK(s.lowestBalance || 0) },
    { label: "Months Negative", value: String(s.monthsNegative || 0) },
  ]);

  if (data.alerts?.length) {
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(C.warning).text("Alerts");
    doc.moveDown(0.3);
    data.alerts.forEach((a: any) => {
      doc.fontSize(9).fillColor(a.type === "danger" ? C.danger : C.warning)
        .text(`Month ${a.month}: ${a.message}`);
    });
  }

  if (data.recommendations?.length) {
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(C.primary).text("Recommendations");
    doc.moveDown(0.3);
    data.recommendations.forEach((r: string) => {
      doc.fontSize(9).fillColor(C.text).text(`• ${r}`, { indent: 10 });
    });
  }
}

// ─── INSURANCE ─────────────────────────────────────────────────────
function renderInsurance(doc: PDFKit.PDFDocument, data: any) {
  const scoreColor = data.overallScore >= 70 ? C.success : data.overallScore >= 40 ? C.warning : C.danger;
  doc.fontSize(28).fillColor(scoreColor).text(`${data.overallScore}/100`, { continued: true });
  doc.fontSize(12).fillColor(C.muted).text("  Coverage Score");
  doc.moveDown(0.5);

  drawStatTable(doc, [
    { label: "Total Annual Premiums", value: fmtK(data.totalAnnualPremiums) },
    { label: "Premium/Income Ratio", value: pctStr(data.premiumToIncomeRatio) },
  ]);

  if (data.gaps?.length) {
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(C.primary).text("Coverage Gaps");
    doc.moveDown(0.3);
    drawDataTable(doc,
      ["Type", "Priority", "Current", "Recommended", "Gap", "Est. Cost/yr"],
      data.gaps.map((g: any) => [
        g.type.replace(/_/g, " "),
        g.priority.toUpperCase(),
        fmtK(g.currentCoverage),
        fmtK(g.recommendedCoverage),
        fmtK(g.gap),
        fmtK(g.estimatedAnnualCost),
      ])
    );
  }
}

// ─── ESTATE ────────────────────────────────────────────────────────
function renderEstate(doc: PDFKit.PDFDocument, data: any) {
  drawStatTable(doc, [
    { label: "Gross Estate", value: fmtK(data.grossEstate) },
    { label: "Taxable Estate", value: fmtK(data.taxableEstate) },
    { label: "Federal Estate Tax", value: fmtK(data.federalEstateTax) },
    { label: "Effective Estate Tax Rate", value: pctStr(data.effectiveEstateTaxRate) },
    { label: "Exemption Remaining", value: fmtK(data.exemptionRemaining) },
    { label: "Total Potential Savings", value: fmtK(data.totalPotentialSavings) },
  ]);

  if (data.strategies?.length) {
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(C.primary).text("Recommended Strategies");
    doc.moveDown(0.3);
    data.strategies.forEach((s: any) => {
      doc.fontSize(10).fillColor(C.text).text(`${s.strategy}`, { continued: true });
      doc.fontSize(8).fillColor(C.muted).text(` (${s.complexity} complexity)`);
      doc.fontSize(9).fillColor(C.muted).text(s.description, { indent: 10 });
      doc.fontSize(9).fillColor(C.success).text(`Potential savings: ${fmtK(s.potentialSavings)}`, { indent: 10 });
      doc.moveDown(0.3);
    });
  }
}

// ─── EDUCATION ─────────────────────────────────────────────────────
function renderEducation(doc: PDFKit.PDFDocument, data: any) {
  const fundingPct = Math.min(100, data.fundingPercentage || 0);
  const fundColor = fundingPct >= 90 ? C.success : fundingPct >= 60 ? C.warning : C.danger;
  doc.fontSize(28).fillColor(fundColor).text(`${fundingPct.toFixed(0)}%`, { continued: true });
  doc.fontSize(12).fillColor(C.muted).text("  Funded");
  doc.moveDown(0.5);

  drawStatTable(doc, [
    { label: "Total Projected Cost", value: fmtK(data.totalProjectedCost) },
    { label: "After Aid/Scholarships", value: fmtK(data.totalAfterAid) },
    { label: "Projected 529 Balance", value: fmtK(data.projected529Balance) },
    { label: "Funding Gap", value: fmtK(data.fundingGap) },
    { label: "Monthly Needed", value: fmtK(data.monthlyNeeded || 0) },
    { label: "Tax Benefits", value: fmtK(data.taxBenefits?.totalTaxBenefit || 0) },
  ]);
}

// ─── RISK ──────────────────────────────────────────────────────────
function renderRisk(doc: PDFKit.PDFDocument, data: any) {
  const category = (data.category || "").replace(/_/g, " ");
  doc.fontSize(28).fillColor(C.accent).text(`${data.compositeScore}/100`, { continued: true });
  doc.fontSize(12).fillColor(C.muted).text(`  ${category} (Confidence: ${data.confidenceLevel}%)`);
  doc.moveDown(0.5);

  // Dimensions
  const dims = data.dimensions || {};
  drawStatTable(doc, Object.entries(dims).map(([key, val]: [string, any]) => ({
    label: key.charAt(0).toUpperCase() + key.slice(1),
    value: `${val.score}/100 (weight: ${(val.weight * 100).toFixed(0)}%)`,
  })));

  // Allocation
  const alloc = data.recommendedAllocation || {};
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor(C.primary).text("Recommended Allocation");
  doc.moveDown(0.3);
  drawDataTable(doc,
    ["Asset Class", "Allocation"],
    Object.entries(alloc).filter(([_, v]) => (v as number) > 0).map(([k, v]) => [
      k.charAt(0).toUpperCase() + k.slice(1),
      `${v}%`,
    ])
  );

  // Warnings
  if (data.warnings?.length) {
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(C.warning).text("Warnings:");
    data.warnings.forEach((w: string) => doc.fontSize(9).fillColor(C.text).text(`• ${w}`, { indent: 10 }));
  }
}

// ─── GENERIC ───────────────────────────────────────────────────────
function renderGeneric(doc: PDFKit.PDFDocument, data: any) {
  doc.fontSize(10).fillColor(C.text).text(JSON.stringify(data, null, 2), { width: 500 });
}

// ─── DATA TABLE ────────────────────────────────────────────────────
function drawDataTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][]) {
  const startX = 55;
  const colWidth = Math.min(100, 500 / headers.length);
  const rowHeight = 18;
  let y = doc.y;

  // Check if we need a new page
  if (y + rowHeight * (rows.length + 1) > 720) {
    doc.addPage();
    y = doc.y;
  }

  // Header
  doc.rect(startX, y, 500, rowHeight).fill(C.primary);
  headers.forEach((h, i) => {
    doc.fontSize(8).fillColor(C.white).text(h, startX + i * colWidth + 4, y + 4, { width: colWidth - 8 });
  });
  y += rowHeight;

  // Rows
  rows.forEach((row, ri) => {
    if (y > 720) {
      doc.addPage();
      y = doc.y;
    }
    if (ri % 2 === 0) doc.rect(startX, y, 500, rowHeight).fill(C.bg);
    row.forEach((cell, ci) => {
      doc.fontSize(8).fillColor(C.text).text(cell, startX + ci * colWidth + 4, y + 4, { width: colWidth - 8 });
    });
    y += rowHeight;
  });

  doc.y = y + 5;
}

// ─── DISCLAIMER ────────────────────────────────────────────────────
function drawDisclaimer(doc: PDFKit.PDFDocument, custom?: string) {
  doc.fontSize(14).fillColor(C.primary).text("Important Disclosures");
  doc.moveDown(0.5);
  doc.rect(55, doc.y, 500, 1).fill(C.divider);
  doc.moveDown(0.5);

  const disclaimer = custom || `This report is generated by WealthBridge AI, a digital financial planning tool powered by Stewardly. The analysis and recommendations contained herein are based on the data provided and standard financial models. They do not constitute personalized financial advice, tax advice, or legal advice.

Monte Carlo simulations use historical return distributions and are not guarantees of future performance. Past performance does not guarantee future results. All projections are estimates and actual results may vary significantly.

Tax calculations are based on current federal tax law and may not reflect state-specific rules or recent legislative changes. Consult a qualified tax professional for personalized tax advice.

Insurance recommendations are general guidelines. Actual coverage needs depend on individual circumstances. Consult a licensed insurance professional for specific recommendations.

Estate planning strategies are general in nature. Consult an estate planning attorney for advice specific to your situation and jurisdiction.

This report is confidential and intended solely for the named recipient. Do not distribute without authorization.`;

  doc.fontSize(8.5).fillColor(C.muted).text(disclaimer, { width: 500, lineGap: 2.5 });
}

// ─── PAGE FOOTER ───────────────────────────────────────────────────
function drawPageFooter(doc: PDFKit.PDFDocument, page: number, total: number, firm: string) {
  doc.fontSize(7).fillColor(C.muted)
    .text(`${firm} — Confidential`, 55, 760, { width: 250 })
    .text(`Page ${page} of ${total}`, 305, 760, { width: 250, align: "right" });
}
