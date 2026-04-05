/**
 * XLSX Parser — Parse Excel files for data import
 */
import { logger } from "../../_core/logger";
import * as XLSX from "xlsx";

const log = logger.child({ module: "xlsxParser" });

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface ParseResult {
  sheets: ParsedSheet[];
  totalRows: number;
  errors: string[];
}

export function parseBuffer(buffer: Buffer, options?: { maxRows?: number; sheetNames?: string[] }): ParseResult {
  const maxRows = options?.maxRows ?? 50000;
  const errors: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetNames = options?.sheetNames ?? workbook.SheetNames;
    const sheets: ParsedSheet[] = [];
    let totalRows = 0;

    for (const name of sheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet) {
        errors.push(`Sheet "${name}" not found`);
        continue;
      }

      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
      const limited = jsonData.slice(0, maxRows);
      const headers = limited.length > 0 ? Object.keys(limited[0]) : [];

      if (jsonData.length > maxRows) {
        errors.push(`Sheet "${name}" truncated: ${jsonData.length} rows → ${maxRows}`);
      }

      sheets.push({ name, headers, rows: limited, rowCount: limited.length });
      totalRows += limited.length;
    }

    log.info({ sheets: sheets.length, totalRows }, "XLSX parsed");
    return { sheets, totalRows, errors };
  } catch (e: any) {
    log.error({ error: e.message }, "XLSX parse failed");
    return { sheets: [], totalRows: 0, errors: [e.message] };
  }
}

export function detectHeaderRow(buffer: Buffer, sheetName?: string): { row: number; headers: string[] } {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[sheetName ?? workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    // Find first row with mostly string values (likely headers)
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;
      const stringCount = row.filter((cell) => typeof cell === "string" && cell.trim().length > 0).length;
      if (stringCount / row.length > 0.6) {
        return { row: i, headers: row.map(String) };
      }
    }

    return { row: 0, headers: rawData[0]?.map(String) ?? [] };
  } catch {
    return { row: 0, headers: [] };
  }
}
