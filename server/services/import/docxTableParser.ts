/**
 * DOCX Table Parser — Extract tables from Word documents
 */
import { logger } from "../../_core/logger";
import mammoth from "mammoth";

const log = logger.child({ module: "docxTableParser" });

export interface DocxTableResult {
  tables: Array<{ headers: string[]; rows: string[][] }>;
  rawText: string;
  errors: string[];
}

export async function parseBuffer(buffer: Buffer): Promise<DocxTableResult> {
  const errors: string[] = [];

  try {
    // Extract HTML to preserve table structure
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const textResult = await mammoth.extractRawText({ buffer });

    if (htmlResult.messages.length > 0) {
      errors.push(...htmlResult.messages.map((m) => m.message));
    }

    // Parse tables from HTML
    const tables = extractTablesFromHtml(htmlResult.value);

    log.info({ tables: tables.length }, "DOCX tables extracted");
    return { tables, rawText: textResult.value.slice(0, 50000), errors };
  } catch (e: any) {
    log.error({ error: e.message }, "DOCX table parse failed");
    return { tables: [], rawText: "", errors: [e.message] };
  }
}

function extractTablesFromHtml(html: string): Array<{ headers: string[]; rows: string[][] }> {
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const rows: string[][] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
      }
      if (cells.length > 0) rows.push(cells);
    }

    if (rows.length >= 2) {
      tables.push({ headers: rows[0], rows: rows.slice(1) });
    }
  }

  return tables;
}
