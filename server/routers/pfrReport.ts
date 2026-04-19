/**
 * PFR Report Router — Generate a formatted Personal Financial Review PDF.
 *
 * Takes the holistic score, domain scores, recommendations, and PFR step
 * completion data and produces a compliance-ready PDF report.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import PDFDocument from "pdfkit";
import crypto from "crypto";

const pfrStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.string(),
  completed: z.boolean(),
  notes: z.string().optional(),
});

const domainScoreSchema = z.object({
  domain: z.string(),
  score: z.number(),
  allocation: z.number(),
  gap: z.number().optional(),
});

const recommendationSchema = z.object({
  product: z.string(),
  coverage: z.string(),
  premium: z.number(),
  carrier: z.string(),
  priority: z.string(),
  category: z.string().optional(),
});

const pfrInputSchema = z.object({
  clientName: z.string().default("Client"),
  advisorName: z.string().default("Financial Advisor"),
  reviewDate: z.string().optional(),
  holisticScore: z.number(),
  clientHubScore: z.number(),
  advancedHubScore: z.number(),
  practiceHubScore: z.number().default(0),
  domainScores: z.array(domainScoreSchema),
  recommendations: z.array(recommendationSchema),
  steps: z.array(pfrStepSchema),
  keyMetrics: z.object({
    totalIncome: z.number().default(0),
    netWorth: z.number().default(0),
    totalSavings: z.number().default(0),
    retirementGap: z.number().default(0),
    protectionCoverage: z.number().default(0),
    taxEfficiency: z.number().default(0),
  }).optional(),
});

function fmtDollar(v: number): string {
  if (!isFinite(v)) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#ca8a04";
  if (score >= 40) return "#ea580c";
  return "#dc2626";
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Very Good";
  if (score >= 70) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Needs Attention";
  return "Critical";
}

async function generatePFRPdf(input: z.infer<typeof pfrInputSchema>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const reviewDate = input.reviewDate || new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    // ─── COVER PAGE ───
    doc.moveDown(6);
    doc.fontSize(28).font("Helvetica-Bold").fillColor("#1e293b")
      .text("Personal Financial Review", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(14).font("Helvetica").fillColor("#64748b")
      .text("Comprehensive Wealth Assessment Report", { align: "center" });
    doc.moveDown(2);

    // Score circle (text representation)
    const sc = input.holisticScore;
    doc.fontSize(48).font("Helvetica-Bold").fillColor(scoreColor(sc))
      .text(`${Math.round(sc)}`, { align: "center" });
    doc.fontSize(12).font("Helvetica").fillColor("#64748b")
      .text(`Holistic Score — ${scoreLabel(sc)}`, { align: "center" });
    doc.moveDown(3);

    // Client/Advisor info
    doc.fontSize(11).font("Helvetica").fillColor("#334155");
    doc.text(`Prepared for: ${input.clientName}`, { align: "center" });
    doc.text(`Prepared by: ${input.advisorName}`, { align: "center" });
    doc.text(`Review Date: ${reviewDate}`, { align: "center" });

    doc.moveDown(4);
    doc.fontSize(7).fillColor("#94a3b8")
      .text("This report is for informational purposes only and does not constitute financial, tax, or legal advice. Consult qualified professionals before making financial decisions.", { align: "center" });

    // ─── PAGE 2: EXECUTIVE SUMMARY ───
    doc.addPage();
    doc.fontSize(18).font("Helvetica-Bold").fillColor("#1e293b")
      .text("Executive Summary");
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke("#e2e8f0");
    doc.moveDown(0.5);

    // Hub scores table
    const hubs = [
      { name: "Client Wealth Hub", score: input.clientHubScore },
      { name: "Advanced Strategies Hub", score: input.advancedHubScore },
    ];
    if (input.practiceHubScore > 0) {
      hubs.push({ name: "Practice Management Hub", score: input.practiceHubScore });
    }

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#475569");
    let y = doc.y;
    doc.text("Hub", 50, y, { width: 250 });
    doc.text("Score", 300, y, { width: 80, align: "right" });
    doc.text("Rating", 400, y, { width: 120, align: "right" });
    y += 18;
    doc.moveTo(50, y).lineTo(520, y).stroke("#e2e8f0");
    y += 5;

    doc.font("Helvetica").fontSize(10);
    for (const hub of hubs) {
      doc.fillColor("#334155").text(hub.name, 50, y, { width: 250 });
      doc.fillColor(scoreColor(hub.score)).text(`${Math.round(hub.score)}`, 300, y, { width: 80, align: "right" });
      doc.fillColor("#64748b").text(scoreLabel(hub.score), 400, y, { width: 120, align: "right" });
      y += 16;
    }

    // Key Metrics
    if (input.keyMetrics) {
      doc.moveDown(2);
      y = doc.y;
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#1e293b")
        .text("Key Financial Metrics", 50, y);
      y += 25;
      doc.moveTo(50, y).lineTo(562, y).stroke("#e2e8f0");
      y += 8;

      const metrics = [
        { label: "Total Annual Income", value: fmtDollar(input.keyMetrics.totalIncome) },
        { label: "Net Worth", value: fmtDollar(input.keyMetrics.netWorth) },
        { label: "Total Savings", value: fmtDollar(input.keyMetrics.totalSavings) },
        { label: "Retirement Gap", value: fmtDollar(input.keyMetrics.retirementGap) },
        { label: "Protection Coverage", value: `${Math.round(input.keyMetrics.protectionCoverage)}%` },
        { label: "Tax Efficiency", value: `${Math.round(input.keyMetrics.taxEfficiency)}%` },
      ];

      doc.fontSize(10).font("Helvetica");
      for (const m of metrics) {
        doc.fillColor("#475569").text(m.label, 60, y, { width: 250 });
        doc.fillColor("#1e293b").font("Helvetica-Bold").text(m.value, 350, y, { width: 150, align: "right" });
        doc.font("Helvetica");
        y += 16;
      }
    }

    // ─── PAGE 3: DOMAIN ANALYSIS ───
    doc.addPage();
    doc.fontSize(18).font("Helvetica-Bold").fillColor("#1e293b")
      .text("Domain Analysis");
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke("#e2e8f0");
    doc.moveDown(0.5);

    if (input.domainScores.length > 0) {
      y = doc.y;
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#475569");
      doc.text("Domain", 50, y, { width: 180 });
      doc.text("Score", 230, y, { width: 60, align: "right" });
      doc.text("Allocation", 310, y, { width: 80, align: "right" });
      doc.text("Gap", 410, y, { width: 80, align: "right" });
      y += 18;
      doc.moveTo(50, y).lineTo(520, y).stroke("#e2e8f0");
      y += 5;

      doc.font("Helvetica").fontSize(10);
      for (const d of input.domainScores) {
        if (y > 700) { doc.addPage(); y = 50; }
        doc.fillColor("#334155").text(d.domain, 50, y, { width: 180 });
        doc.fillColor(scoreColor(d.score)).text(`${Math.round(d.score)}`, 230, y, { width: 60, align: "right" });
        doc.fillColor("#475569").text(`${Math.round(d.allocation)}%`, 310, y, { width: 80, align: "right" });
        if (d.gap !== undefined) {
          const gapColor = d.gap > 0 ? "#16a34a" : d.gap < 0 ? "#dc2626" : "#64748b";
          doc.fillColor(gapColor).text(fmtDollar(d.gap), 410, y, { width: 80, align: "right" });
        }
        y += 16;
      }
    }

    // ─── PAGE 4: RECOMMENDATIONS ───
    if (input.recommendations.length > 0) {
      doc.addPage();
      doc.fontSize(18).font("Helvetica-Bold").fillColor("#1e293b")
        .text("Recommendations");
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke("#e2e8f0");
      doc.moveDown(0.5);

      y = doc.y;
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#475569");
      doc.text("Product", 50, y, { width: 130 });
      doc.text("Coverage", 180, y, { width: 100, align: "right" });
      doc.text("Premium", 290, y, { width: 80, align: "right" });
      doc.text("Carrier", 380, y, { width: 80, align: "right" });
      doc.text("Priority", 470, y, { width: 60, align: "right" });
      y += 18;
      doc.moveTo(50, y).lineTo(540, y).stroke("#e2e8f0");
      y += 5;

      doc.font("Helvetica").fontSize(9);
      for (const rec of input.recommendations) {
        if (y > 700) { doc.addPage(); y = 50; }
        doc.fillColor("#334155").text(rec.product, 50, y, { width: 130 });
        doc.text(rec.coverage, 180, y, { width: 100, align: "right" });
        doc.text(fmtDollar(rec.premium), 290, y, { width: 80, align: "right" });
        doc.text(rec.carrier, 380, y, { width: 80, align: "right" });
        const prioColor = rec.priority === "High" ? "#dc2626" : rec.priority === "Medium" ? "#ca8a04" : "#16a34a";
        doc.fillColor(prioColor).text(rec.priority, 470, y, { width: 60, align: "right" });
        y += 14;
      }
    }

    // ─── PAGE 5: PFR COMPLETION STATUS ───
    doc.addPage();
    doc.fontSize(18).font("Helvetica-Bold").fillColor("#1e293b")
      .text("Review Completion Status");
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke("#e2e8f0");
    doc.moveDown(0.5);

    const completed = input.steps.filter(s => s.completed).length;
    const total = input.steps.length;
    doc.fontSize(11).font("Helvetica").fillColor("#475569")
      .text(`${completed} of ${total} steps completed (${Math.round((completed / Math.max(total, 1)) * 100)}%)`);
    doc.moveDown(1);

    // Group steps by category
    const categories = new Map<string, typeof input.steps>();
    for (const step of input.steps) {
      const cat = step.category || "General";
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat)!.push(step);
    }

    y = doc.y;
    for (const [cat, steps] of categories) {
      if (y > 680) { doc.addPage(); y = 50; }
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#1e293b")
        .text(cat, 50, y);
      y += 20;

      doc.fontSize(10).font("Helvetica");
      for (const step of steps) {
        if (y > 700) { doc.addPage(); y = 50; }
        const icon = step.completed ? "✓" : "○";
        const color = step.completed ? "#16a34a" : "#94a3b8";
        doc.fillColor(color).text(icon, 60, y, { width: 15 });
        doc.fillColor(step.completed ? "#334155" : "#94a3b8")
          .text(step.label, 80, y, { width: 400 });
        y += 14;
        if (step.notes) {
          doc.fontSize(8).fillColor("#64748b")
            .text(`  Notes: ${step.notes}`, 80, y, { width: 400 });
          y += 12;
          doc.fontSize(10);
        }
      }
      y += 10;
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(7).fillColor("#94a3b8")
      .text("Generated by WealthBridge AI — Personal Financial Review Module. This report is for informational purposes only and does not constitute financial, tax, or legal advice.", 50, undefined, { align: "center" });

    doc.end();
  });
}

export const pfrReportRouter = router({
  /** Generate a PFR PDF report */
  generate: protectedProcedure
    .input(pfrInputSchema)
    .mutation(async ({ ctx, input }) => {
      const suffix = crypto.randomBytes(6).toString("hex");
      const fileKey = `reports/${ctx.user.id}/pfr-report-${suffix}.pdf`;
      const buffer = await generatePFRPdf(input);
      const { url } = await storagePut(fileKey, buffer, "application/pdf");
      return { url, filename: `PFR-Report-${input.clientName.replace(/\s+/g, "-")}.pdf` };
    }),
});
