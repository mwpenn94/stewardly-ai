/**
 * File Router — Route uploaded files to the appropriate parser based on extension
 */
import { logger } from "../../_core/logger";
import { parseBuffer as parseXlsx } from "./xlsxParser";
import { parseBuffer as parseJson } from "./jsonParser";
import { parseBuffer as parseXml } from "./xmlParser";
import { parseBuffer as parseVcf } from "./vcfParser";
import { parseBuffer as parsePdfTable } from "./pdfTableParser";
import { parseBuffer as parseDocxTable } from "./docxTableParser";
import { extractZip } from "./archiveExtractor";

const log = logger.child({ module: "fileRouter" });

export type FileType = "xlsx" | "csv" | "json" | "xml" | "vcf" | "pdf" | "docx" | "zip" | "unknown";

export interface RoutedResult {
  fileType: FileType;
  records: Record<string, unknown>[];
  headers: string[];
  totalCount: number;
  errors: string[];
  subFiles?: Array<{ name: string; fileType: FileType; recordCount: number }>;
}

function detectFileType(filename: string, mimeType?: string): FileType {
  const ext = filename.split(".").pop()?.toLowerCase();
  const typeMap: Record<string, FileType> = {
    xlsx: "xlsx", xls: "xlsx", csv: "csv", tsv: "csv",
    json: "json", xml: "xml", vcf: "vcf",
    pdf: "pdf", docx: "docx", zip: "zip",
  };
  return typeMap[ext || ""] || "unknown";
}

function csvToRecords(buffer: Buffer): { records: Record<string, string>[]; headers: string[] } {
  const text = buffer.toString("utf-8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { records: [], headers: [] };

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.replace(/^"|"$/g, "").trim());
  const records = lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((v) => v.replace(/^"|"$/g, "").trim());
    const record: Record<string, string> = {};
    headers.forEach((h, i) => { record[h] = values[i] || ""; });
    return record;
  });

  return { records, headers };
}

export async function routeFile(buffer: Buffer, filename: string, mimeType?: string): Promise<RoutedResult> {
  const fileType = detectFileType(filename, mimeType);
  log.info({ filename, fileType }, "Routing file to parser");

  switch (fileType) {
    case "xlsx": {
      const result = parseXlsx(buffer);
      const allRecords = result.sheets.flatMap((s) => s.rows as Record<string, unknown>[]);
      const headers = result.sheets[0]?.headers || [];
      return { fileType, records: allRecords, headers, totalCount: result.totalRows, errors: result.errors };
    }

    case "csv": {
      const { records, headers } = csvToRecords(buffer);
      return { fileType, records, headers, totalCount: records.length, errors: [] };
    }

    case "json": {
      const result = parseJson(buffer);
      return { fileType, records: result.records, headers: result.headers, totalCount: result.totalCount, errors: result.errors };
    }

    case "xml": {
      const result = parseXml(buffer);
      return { fileType, records: result.records, headers: result.headers, totalCount: result.totalCount, errors: result.errors };
    }

    case "vcf": {
      const result = parseVcf(buffer);
      const records = result.contacts.map((c) => c as unknown as Record<string, unknown>);
      const headers = result.contacts.length > 0 ? Object.keys(result.contacts[0]) : [];
      return { fileType, records, headers, totalCount: result.totalCount, errors: result.errors };
    }

    case "pdf": {
      const result = await parsePdfTable(buffer);
      const records = result.tables.flatMap((t) => t.rows.map((row) => {
        const record: Record<string, unknown> = {};
        t.headers.forEach((h, i) => { record[h] = row[i] || ""; });
        return record;
      }));
      const headers = result.tables[0]?.headers || [];
      return { fileType, records, headers, totalCount: records.length, errors: result.errors };
    }

    case "docx": {
      const result = await parseDocxTable(buffer);
      const records = result.tables.flatMap((t) => t.rows.map((row) => {
        const record: Record<string, unknown> = {};
        t.headers.forEach((h, i) => { record[h] = row[i] || ""; });
        return record;
      }));
      const headers = result.tables[0]?.headers || [];
      return { fileType, records, headers, totalCount: records.length, errors: result.errors };
    }

    case "zip": {
      const archive = extractZip(buffer);
      const allRecords: Record<string, unknown>[] = [];
      const subFiles: Array<{ name: string; fileType: FileType; recordCount: number }> = [];
      const errors = [...archive.errors];

      for (const file of archive.files) {
        const sub = await routeFile(file.buffer, file.name);
        allRecords.push(...sub.records);
        subFiles.push({ name: file.name, fileType: sub.fileType, recordCount: sub.totalCount });
        errors.push(...sub.errors);
      }

      return { fileType, records: allRecords, headers: allRecords[0] ? Object.keys(allRecords[0]) : [], totalCount: allRecords.length, errors, subFiles };
    }

    default:
      return { fileType: "unknown", records: [], headers: [], totalCount: 0, errors: [`Unsupported file type: ${filename}`] };
  }
}
