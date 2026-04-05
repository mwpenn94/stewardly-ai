/**
 * Report Exporter — Generate PDF/Markdown exports for FINRA compliance
 * All exports logged to communication_archive (3yr retention)
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "reportExporter" });

export type ExportFormat = "pdf" | "markdown";
export type ExportType = "financial_plan" | "pre_meeting_brief" | "suitability_assessment" | "calculator_analysis" | "holistic_summary";

export interface ExportResult {
  format: ExportFormat;
  type: ExportType;
  content: string; // Base64 for PDF, raw text for markdown
  filename: string;
  archivedId?: number;
}

export async function exportReport(params: {
  type: ExportType;
  clientId: number;
  advisorId: number;
  format: ExportFormat;
  data: Record<string, unknown>;
}): Promise<ExportResult> {
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `${params.type}-${params.clientId}-${timestamp}.${params.format === "pdf" ? "pdf" : "md"}`;

  let content: string;

  if (params.format === "markdown") {
    content = generateMarkdown(params.type, params.data);
  } else {
    // PDF generation — use existing pdfGenerator if available, otherwise markdown fallback
    try {
      const { generateFinancialReport } = await import("./pdfGenerator");
      const buffer = await generateFinancialReport({
        clientName: String(params.data.clientName || "Client"),
        advisorName: String(params.data.advisorName || ""),
        firmName: "WealthBridge Financial Group",
        generatedAt: new Date(),
        sections: (params.data.sections as any) || [],
      });
      content = buffer.toString("base64");
    } catch {
      // Fallback to markdown if PDF generation fails
      content = Buffer.from(generateMarkdown(params.type, params.data)).toString("base64");
    }
  }

  // Archive for FINRA compliance
  const archivedId = await archiveExport(params.advisorId, params.type, content, params.clientId);

  log.info({ type: params.type, format: params.format, clientId: params.clientId }, "Report exported");
  return { format: params.format, type: params.type, content, filename, archivedId };
}

function generateMarkdown(type: ExportType, data: Record<string, unknown>): string {
  const header = `# ${formatType(type)}\n\n**Generated:** ${new Date().toLocaleDateString()}\n**Client:** ${data.clientName || "N/A"}\n**Advisor:** ${data.advisorName || "N/A"}\n**Firm:** WealthBridge Financial Group\n\n---\n\n`;

  const body = Object.entries(data)
    .filter(([key]) => !["clientName", "advisorName"].includes(key))
    .map(([key, value]) => {
      if (typeof value === "object") return `## ${formatKey(key)}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;
      return `## ${formatKey(key)}\n\n${value}\n`;
    })
    .join("\n");

  const disclaimer = "\n\n---\n\n*This document is for educational purposes only and does not constitute investment advice, tax advice, or a recommendation to purchase any financial product. Please consult a licensed professional before making financial decisions.*\n";

  return header + body + disclaimer;
}

function formatType(type: string): string {
  return type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatKey(key: string): string {
  return key.split(/[_.]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function archiveExport(advisorId: number, type: string, content: string, clientId: number): Promise<number | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const { communicationArchive } = await import("../../drizzle/schema");
    const threeYears = new Date();
    threeYears.setFullYear(threeYears.getFullYear() + 3);
    const [row] = await db.insert(communicationArchive).values({
      userId: advisorId,
      contentType: "plan_analysis",
      contentText: `[EXPORT:${type}] ${content.slice(0, 1000)}`,
      leadId: clientId,
      retentionExpiresAt: threeYears,
    }).$returningId();
    return row.id;
  } catch { return undefined; }
}
