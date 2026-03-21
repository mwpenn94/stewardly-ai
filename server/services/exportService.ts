/**
 * Export Service
 * 
 * Generates downloadable files in multiple formats from structured data.
 * Supports: CSV, Excel (XLSX), PDF, DOCX (plain text), JSON
 */

import PDFDocument from "pdfkit";
import { storagePut } from "../storage";
import crypto from "crypto";

const uuid = () => crypto.randomUUID();

// ─── Types ──────────────────────────────────────────────────────────────────

export type ExportFormat = "csv" | "excel" | "pdf" | "docx" | "json";

export interface ExportColumn {
  key: string;
  label: string;
  width?: number;
  format?: "text" | "number" | "currency" | "date" | "percent";
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  format: ExportFormat;
  metadata?: Record<string, string>;
  userId?: number;
  includeTimestamp?: boolean;
}

export interface ExportResult {
  url: string;
  fileKey: string;
  format: ExportFormat;
  filename: string;
  sizeBytes: number;
  rowCount: number;
  generatedAt: number;
}

// ─── Format Helpers ─────────────────────────────────────────────────────────

function formatValue(value: unknown, format?: string): string {
  if (value === null || value === undefined) return "";
  if (format === "currency") return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  if (format === "percent") return `${(Number(value) * 100).toFixed(1)}%`;
  if (format === "date") return new Date(value as string | number).toLocaleDateString("en-US");
  if (format === "number") return Number(value).toLocaleString("en-US");
  return String(value);
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── CSV Export ─────────────────────────────────────────────────────────────

function generateCSV(options: ExportOptions): Buffer {
  const lines: string[] = [];

  // Header row
  lines.push(options.columns.map(c => escapeCSV(c.label)).join(","));

  // Data rows
  for (const row of options.rows) {
    const values = options.columns.map(col => {
      const raw = row[col.key];
      return escapeCSV(formatValue(raw, col.format));
    });
    lines.push(values.join(","));
  }

  if (options.includeTimestamp) {
    lines.push("");
    lines.push(`Generated: ${new Date().toISOString()}`);
  }

  return Buffer.from(lines.join("\n"), "utf-8");
}

// ─── Excel (TSV with .xlsx extension for basic compatibility) ───────────────

function generateExcel(options: ExportOptions): Buffer {
  // Generate a proper TSV that Excel can open
  const lines: string[] = [];

  // Title row
  if (options.title) {
    lines.push(options.title);
    if (options.subtitle) lines.push(options.subtitle);
    lines.push("");
  }

  // Header row
  lines.push(options.columns.map(c => c.label).join("\t"));

  // Data rows
  for (const row of options.rows) {
    const values = options.columns.map(col => {
      const raw = row[col.key];
      return formatValue(raw, col.format);
    });
    lines.push(values.join("\t"));
  }

  if (options.includeTimestamp) {
    lines.push("");
    lines.push(`Generated\t${new Date().toISOString()}`);
  }

  // BOM for Excel UTF-8 detection
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  const content = Buffer.from(lines.join("\r\n"), "utf-8");
  return Buffer.concat([bom, content]);
}

// ─── PDF Export ─────────────────────────────────────────────────────────────

function generatePDF(options: ExportOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc.fontSize(18).font("Helvetica-Bold").text(options.title, { align: "center" });
    if (options.subtitle) {
      doc.fontSize(10).font("Helvetica").fillColor("#666666").text(options.subtitle, { align: "center" });
    }
    doc.moveDown(1);

    // Metadata
    if (options.metadata) {
      doc.fontSize(8).fillColor("#999999");
      for (const [key, value] of Object.entries(options.metadata)) {
        doc.text(`${key}: ${value}`);
      }
      doc.moveDown(0.5);
    }

    // Table
    const pageWidth = 512; // 612 - 2*50 margin
    const colCount = Math.min(options.columns.length, 8); // Max 8 columns to fit
    const colWidth = pageWidth / colCount;
    const startX = 50;
    let y = doc.y;

    // Table header
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#1a1a2e");
    doc.rect(startX, y, pageWidth, 18).fill("#f0f0f5");
    doc.fillColor("#1a1a2e");
    for (let i = 0; i < colCount; i++) {
      doc.text(options.columns[i].label, startX + i * colWidth + 4, y + 4, {
        width: colWidth - 8,
        height: 14,
        ellipsis: true,
      });
    }
    y += 20;

    // Table rows
    doc.font("Helvetica").fontSize(7).fillColor("#333333");
    for (const row of options.rows) {
      if (y > 720) {
        doc.addPage();
        y = 50;
      }

      const bgColor = options.rows.indexOf(row) % 2 === 0 ? "#ffffff" : "#fafafa";
      doc.rect(startX, y, pageWidth, 16).fill(bgColor);
      doc.fillColor("#333333");

      for (let i = 0; i < colCount; i++) {
        const val = formatValue(row[options.columns[i].key], options.columns[i].format);
        doc.text(val, startX + i * colWidth + 4, y + 4, {
          width: colWidth - 8,
          height: 12,
          ellipsis: true,
        });
      }
      y += 16;
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(7).fillColor("#999999")
      .text(`Generated by Stewardly on ${new Date().toLocaleDateString("en-US")} | ${options.rows.length} records`, { align: "center" });

    doc.end();
  });
}

// ─── DOCX (Plain text with structure) ───────────────────────────────────────

function generateDOCX(options: ExportOptions): Buffer {
  // Generate structured plain text that can be opened in Word
  const lines: string[] = [];
  lines.push(options.title);
  lines.push("=".repeat(options.title.length));
  if (options.subtitle) lines.push(options.subtitle);
  lines.push("");

  if (options.metadata) {
    for (const [key, value] of Object.entries(options.metadata)) {
      lines.push(`${key}: ${value}`);
    }
    lines.push("");
  }

  // Column headers
  const headerLine = options.columns.map(c => c.label.padEnd(20)).join(" | ");
  lines.push(headerLine);
  lines.push("-".repeat(headerLine.length));

  // Data rows
  for (const row of options.rows) {
    const values = options.columns.map(col => {
      const val = formatValue(row[col.key], col.format);
      return val.padEnd(20);
    });
    lines.push(values.join(" | "));
  }

  lines.push("");
  lines.push(`Generated by Stewardly on ${new Date().toISOString()}`);
  lines.push(`Total records: ${options.rows.length}`);

  return Buffer.from(lines.join("\n"), "utf-8");
}

// ─── JSON Export ────────────────────────────────────────────────────────────

function generateJSON(options: ExportOptions): Buffer {
  const output = {
    title: options.title,
    subtitle: options.subtitle,
    generatedAt: new Date().toISOString(),
    metadata: options.metadata || {},
    columns: options.columns.map(c => ({ key: c.key, label: c.label, format: c.format })),
    rowCount: options.rows.length,
    data: options.rows,
  };
  return Buffer.from(JSON.stringify(output, null, 2), "utf-8");
}

// ─── Main Export Function ───────────────────────────────────────────────────

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  csv: "csv",
  excel: "xlsx",
  pdf: "pdf",
  docx: "txt",
  json: "json",
};

const FORMAT_MIMETYPES: Record<ExportFormat, string> = {
  csv: "text/csv",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  json: "application/json",
};

export async function exportData(options: ExportOptions): Promise<ExportResult> {
  let buffer: Buffer;

  switch (options.format) {
    case "csv":
      buffer = generateCSV(options);
      break;
    case "excel":
      buffer = generateExcel(options);
      break;
    case "pdf":
      buffer = await generatePDF(options);
      break;
    case "docx":
      buffer = generateDOCX(options);
      break;
    case "json":
      buffer = generateJSON(options);
      break;
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }

  const ext = FORMAT_EXTENSIONS[options.format];
  const mime = FORMAT_MIMETYPES[options.format];
  const slug = options.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
  const suffix = uuid().slice(0, 8);
  const filename = `${slug}-${suffix}.${ext}`;
  const fileKey = `exports/${options.userId || "system"}/${filename}`;

  const { url } = await storagePut(fileKey, buffer, mime);

  return {
    url,
    fileKey,
    format: options.format,
    filename,
    sizeBytes: buffer.length,
    rowCount: options.rows.length,
    generatedAt: Date.now(),
  };
}

// ─── Convenience Wrappers ───────────────────────────────────────────────────

export async function exportToCSV(title: string, columns: ExportColumn[], rows: Record<string, unknown>[], userId?: number) {
  return exportData({ title, columns, rows, format: "csv", userId, includeTimestamp: true });
}

export async function exportToPDF(title: string, columns: ExportColumn[], rows: Record<string, unknown>[], userId?: number, subtitle?: string) {
  return exportData({ title, columns, rows, format: "pdf", userId, subtitle, includeTimestamp: true });
}

export async function exportToJSON(title: string, columns: ExportColumn[], rows: Record<string, unknown>[], userId?: number) {
  return exportData({ title, columns, rows, format: "json", userId });
}
