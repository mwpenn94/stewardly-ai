/**
 * PDF Table Parser — Extract tabular data from PDF files
 */
import { logger } from "../../_core/logger";
// @ts-ignore - pdf-parse module resolution
import pdfParse from "pdf-parse";

const log = logger.child({ module: "pdfTableParser" });

export interface PdfTableResult {
  tables: Array<{ headers: string[]; rows: string[][]; page: number }>;
  rawText: string;
  pageCount: number;
  errors: string[];
}

/** Heuristic: detect table-like structures from PDF text */
function extractTables(text: string): Array<{ headers: string[]; rows: string[][] }> {
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let currentTable: string[][] = [];
  let expectedColumns = 0;

  for (const line of lines) {
    // Detect tab or multi-space separated values
    const cells = line.split(/\t|  {2,}/).map((c) => c.trim()).filter(Boolean);

    if (cells.length >= 2) {
      if (currentTable.length === 0) {
        expectedColumns = cells.length;
      }

      if (Math.abs(cells.length - expectedColumns) <= 1) {
        currentTable.push(cells);
      } else if (currentTable.length >= 2) {
        // End of table
        tables.push({ headers: currentTable[0], rows: currentTable.slice(1) });
        currentTable = [cells];
        expectedColumns = cells.length;
      }
    } else if (currentTable.length >= 2) {
      tables.push({ headers: currentTable[0], rows: currentTable.slice(1) });
      currentTable = [];
      expectedColumns = 0;
    }
  }

  if (currentTable.length >= 2) {
    tables.push({ headers: currentTable[0], rows: currentTable.slice(1) });
  }

  return tables;
}

export async function parseBuffer(buffer: Buffer): Promise<PdfTableResult> {
  const errors: string[] = [];

  try {
    const result = await pdfParse(buffer);
    const tables = extractTables(result.text);

    log.info({ pages: result.numpages, tables: tables.length }, "PDF tables extracted");
    return {
      tables: tables.map((t, i) => ({ ...t, page: i + 1 })),
      rawText: result.text.slice(0, 50000),
      pageCount: result.numpages,
      errors,
    };
  } catch (e: any) {
    log.error({ error: e.message }, "PDF table parse failed");
    return { tables: [], rawText: "", pageCount: 0, errors: [e.message] };
  }
}
