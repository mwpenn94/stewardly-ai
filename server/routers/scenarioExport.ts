/**
 * Scenario Export Router — Generate PDF and Excel exports for scenario comparisons.
 *
 * Uses pdfkit for PDF generation and xlsx for Excel generation.
 * Exports include side-by-side comparison with delta highlighting.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import crypto from "crypto";

const scenarioSchema = z.object({
  name: z.string(),
  // @ts-expect-error — argument count mismatch with drizzle overload
  data: z.record(z.any()),
});

const exportInputSchema = z.object({
  scenarios: z.array(scenarioSchema).min(1).max(5),
  title: z.string().default("Scenario Comparison Report"),
  format: z.enum(["pdf", "excel"]),
});

/** Extract flat key-value pairs from nested scenario data for comparison */
function flattenScenario(data: Record<string, any>, prefix = ""): Record<string, number | string> {
  const result: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(data)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenScenario(value, fullKey));
    } else if (typeof value === "number" || typeof value === "string") {
      result[fullKey] = value;
    }
  }
  return result;
}

/** Format a key into a human-readable label */
function humanize(key: string): string {
  return key
    .split(".")
    .pop()!
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

/** Format a number for display */
function fmtVal(v: number | string): string {
  if (typeof v === "string") return v;
  if (!isFinite(v)) return "$0";
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  if (v % 1 !== 0) return v.toFixed(2);
  return v.toLocaleString();
}

async function generatePDF(
  title: string,
  scenarios: { name: string; data: Record<string, any> }[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title
    doc.fontSize(20).font("Helvetica-Bold").text(title, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#666666")
      .text(`Generated ${new Date().toLocaleDateString()} | ${scenarios.length} scenarios compared`, { align: "center" });
    doc.moveDown(1);

    // Flatten all scenarios
    const flattened = scenarios.map(s => flattenScenario(s.data));
    const allKeys = [...new Set(flattened.flatMap(f => Object.keys(f)))].sort();

    // Filter to numeric keys for meaningful comparison
    const numericKeys = allKeys.filter(k => flattened.some(f => typeof f[k] === "number"));
    const displayKeys = numericKeys.slice(0, 60); // Limit to prevent overflow

    // Table header
    const colWidth = scenarios.length > 2 ? 120 : 160;
    const labelWidth = 200;
    const startX = 50;
    let y = doc.y;

    // Header row
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#333333");
    doc.text("Metric", startX, y, { width: labelWidth });
    scenarios.forEach((s, i) => {
      doc.text(s.name, startX + labelWidth + i * colWidth, y, { width: colWidth, align: "right" });
    });
    if (scenarios.length >= 2) {
      doc.text("Delta", startX + labelWidth + scenarios.length * colWidth, y, { width: 80, align: "right" });
    }
    y += 18;
    doc.moveTo(startX, y).lineTo(startX + labelWidth + scenarios.length * colWidth + 80, y).stroke("#cccccc");
    y += 5;

    // Data rows
    doc.font("Helvetica").fontSize(8);
    for (const key of displayKeys) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      const label = humanize(key);
      const values = flattened.map(f => f[key]);

      doc.fillColor("#444444").text(label, startX, y, { width: labelWidth });
      values.forEach((v, i) => {
        doc.text(fmtVal(v ?? 0), startX + labelWidth + i * colWidth, y, { width: colWidth, align: "right" });
      });

      // Delta column (first vs last scenario)
      if (scenarios.length >= 2) {
        const first = typeof values[0] === "number" ? values[0] : 0;
        const last = typeof values[values.length - 1] === "number" ? values[values.length - 1] : 0;
        const delta = (last as number) - (first as number);
        const color = delta > 0 ? "#16a34a" : delta < 0 ? "#dc2626" : "#666666";
        const prefix = delta > 0 ? "+" : "";
        doc.fillColor(color).text(
          `${prefix}${fmtVal(delta)}`,
          startX + labelWidth + scenarios.length * colWidth, y,
          { width: 80, align: "right" },
        );
      }

      y += 14;
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(7).fillColor("#999999")
      .text("This report is for informational purposes only and does not constitute financial advice.", 50, undefined, { align: "center" });

    doc.end();
  });
}

function generateExcel(
  title: string,
  scenarios: { name: string; data: Record<string, any> }[],
): Buffer {
  const wb = XLSX.utils.book_new();

  // Flatten all scenarios
  const flattened = scenarios.map(s => flattenScenario(s.data));
  const allKeys = [...new Set(flattened.flatMap(f => Object.keys(f)))].sort();
  const numericKeys = allKeys.filter(k => flattened.some(f => typeof f[k] === "number"));

  // Build comparison sheet
  const headers = ["Metric", ...scenarios.map(s => s.name)];
  if (scenarios.length >= 2) headers.push("Delta", "Delta %");

  const rows: (string | number)[][] = [headers];
  for (const key of numericKeys) {
    const label = humanize(key);
    const values = flattened.map(f => {
      const v = f[key];
      return typeof v === "number" ? v : 0;
    });
    const row: (string | number)[] = [label, ...values];

    if (scenarios.length >= 2) {
      const first = values[0] as number;
      const last = values[values.length - 1] as number;
      const delta = last - first;
      const deltaPct = first !== 0 ? ((delta / Math.abs(first)) * 100) : 0;
      row.push(Math.round(delta * 100) / 100);
      row.push(Math.round(deltaPct * 10) / 10);
    }

    rows.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws["!cols"] = [
    { wch: 35 },
    ...scenarios.map(() => ({ wch: 18 })),
    ...(scenarios.length >= 2 ? [{ wch: 15 }, { wch: 12 }] : []),
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Comparison");

  // Individual scenario sheets
  scenarios.forEach((scenario, idx) => {
    const flat = flattened[idx];
    const sRows: (string | number | string)[][] = [["Metric", "Value"]];
    for (const [k, v] of Object.entries(flat)) {
      sRows.push([humanize(k), typeof v === "number" ? v : String(v)]);
    }
    const sWs = XLSX.utils.aoa_to_sheet(sRows);
    sWs["!cols"] = [{ wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, sWs, scenario.name.slice(0, 31));
  });

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export const scenarioExportRouter = router({
  /** Bulk export all saved calculator sessions as a multi-sheet Excel workbook (v8 Pass 5) */
  bulkExport: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { listCalculatorSessions, getCalculatorSession } = await import("../db");
      const sessions = await listCalculatorSessions(ctx.user.id);
      if (!sessions || sessions.length === 0) {
        throw new Error("No saved sessions found");
      }

      const wb = XLSX.utils.book_new();

      // Fetch full session data for each
      const fullSessions: { name: string; type: string; inputs: Record<string, any>; results: Record<string, any>; createdAt: any; updatedAt: any }[] = [];
      for (const s of sessions) {
        const full = await getCalculatorSession(s.id, ctx.user.id);
        if (full) {
          fullSessions.push({
            name: full.name,
            type: full.calculatorType || 'general',
            inputs: (typeof full.inputsJson === 'object' && full.inputsJson ? full.inputsJson : {}) as Record<string, any>,
            results: (typeof full.resultsJson === 'object' && full.resultsJson ? full.resultsJson : {}) as Record<string, any>,
            createdAt: full.createdAt,
            updatedAt: full.updatedAt,
          });
        }
      }

      // ─── Summary Sheet ───
      const summaryHeaders = ["#", "Session Name", "Calculator Type", "Created", "Last Updated", "Input Fields", "Result Fields"];
      const summaryRows: (string | number)[][] = [summaryHeaders];
      fullSessions.forEach((s, i) => {
        const inputFlat = flattenScenario(s.inputs);
        const resultFlat = flattenScenario(s.results);
        summaryRows.push([
          i + 1,
          s.name,
          s.type,
          s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A',
          s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : 'N/A',
          Object.keys(inputFlat).length,
          Object.keys(resultFlat).length,
        ]);
      });
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
      summaryWs["!cols"] = [{ wch: 4 }, { wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      // ─── Comparison Sheet (all sessions side-by-side) ───
      const allFlattened = fullSessions.map(s => {
        const combined = { ...flattenScenario(s.inputs), ...flattenScenario(s.results) };
        return combined;
      });
      const allKeys = [...new Set(allFlattened.flatMap(f => Object.keys(f)))].sort();
      const numericKeys = allKeys.filter(k => allFlattened.some(f => typeof f[k] === 'number'));

      const compHeaders = ["Metric", ...fullSessions.map(s => s.name)];
      const compRows: (string | number)[][] = [compHeaders];
      for (const key of numericKeys) {
        const label = humanize(key);
        const values = allFlattened.map(f => {
          const v = f[key];
          return typeof v === 'number' ? Math.round(v * 100) / 100 : 0;
        });
        compRows.push([label, ...values]);
      }
      const compWs = XLSX.utils.aoa_to_sheet(compRows);
      compWs["!cols"] = [{ wch: 35 }, ...fullSessions.map(() => ({ wch: 18 }))];
      XLSX.utils.book_append_sheet(wb, compWs, "Comparison");

      // ─── Individual Session Sheets ───
      fullSessions.forEach((session, idx) => {
        const flat = { ...flattenScenario(session.inputs), ...flattenScenario(session.results) };
        const sRows: (string | number | string)[][] = [
          ["Section", "Metric", "Value"],
        ];

        // Inputs section
        const inputFlat = flattenScenario(session.inputs);
        for (const [k, v] of Object.entries(inputFlat)) {
          sRows.push(["Input", humanize(k), typeof v === 'number' ? Math.round(v * 100) / 100 : String(v)]);
        }

        // Results section
        const resultFlat = flattenScenario(session.results);
        for (const [k, v] of Object.entries(resultFlat)) {
          sRows.push(["Result", humanize(k), typeof v === 'number' ? Math.round(v * 100) / 100 : String(v)]);
        }

        const sWs = XLSX.utils.aoa_to_sheet(sRows);
        sWs["!cols"] = [{ wch: 10 }, { wch: 35 }, { wch: 20 }];
        // Sheet names must be <= 31 chars and unique
        const sheetName = `${idx + 1}. ${session.name}`.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, sWs, sheetName);
      });

      const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
      const suffix = crypto.randomBytes(6).toString("hex");
      const fileKey = `exports/${ctx.user.id}/all-scenarios-${suffix}.xlsx`;
      const { url } = await storagePut(fileKey, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return { url, filename: `WealthBridge-All-Scenarios-${new Date().toISOString().slice(0, 10)}.xlsx`, sessionCount: fullSessions.length };
    }),

  /** Export scenarios as PDF or Excel */
  export: protectedProcedure
    .input(exportInputSchema)
    .mutation(async ({ ctx, input }) => {
      const suffix = crypto.randomBytes(6).toString("hex");
      const ext = input.format === "pdf" ? "pdf" : "xlsx";
      const mime = input.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const fileKey = `exports/${ctx.user.id}/scenario-comparison-${suffix}.${ext}`;

      let buffer: Buffer;
      if (input.format === "pdf") {
        buffer = await generatePDF(input.title, input.scenarios);
      } else {
        buffer = generateExcel(input.title, input.scenarios);
      }

      const { url } = await storagePut(fileKey, buffer, mime);
      return { url, filename: `scenario-comparison.${ext}` };
    }),
});
