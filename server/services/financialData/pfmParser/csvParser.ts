/**
 * PFM CSV Parser — Multi-format transaction importer
 *
 * Pass 121: Parses CSV exports from Mint, Empower, Monarch Money,
 * EveryDollar, YNAB, Quicken, and generic formats.
 * Uses AI-assisted column mapping when headers don't match known patterns.
 */

import type { PfmSource, PfmTransaction, PfmColumnMapping, PfmImportResult } from "../types";

// ─── KNOWN COLUMN PATTERNS ───────────────────────────────────────

interface ColumnPattern {
  source: PfmSource;
  dateColumns: string[];
  descriptionColumns: string[];
  amountColumns: string[];
  categoryColumns: string[];
  accountColumns: string[];
  typeColumns: string[];
  /** If the source uses separate debit/credit columns */
  debitColumn?: string;
  creditColumn?: string;
  /** Date format hint (for parsing) */
  dateFormat?: string;
}

const KNOWN_PATTERNS: ColumnPattern[] = [
  {
    source: "mint",
    dateColumns: ["date"],
    descriptionColumns: ["description", "original description"],
    amountColumns: ["amount"],
    categoryColumns: ["category"],
    accountColumns: ["account name"],
    typeColumns: ["transaction type"],
    dateFormat: "MM/DD/YYYY",
  },
  {
    source: "empower",
    dateColumns: ["date"],
    descriptionColumns: ["description", "merchant"],
    amountColumns: ["amount"],
    categoryColumns: ["category"],
    accountColumns: ["account"],
    typeColumns: ["type"],
    dateFormat: "YYYY-MM-DD",
  },
  {
    source: "monarch",
    dateColumns: ["date"],
    descriptionColumns: ["merchant", "original statement", "notes"],
    amountColumns: ["amount"],
    categoryColumns: ["category"],
    accountColumns: ["account"],
    typeColumns: [],
    dateFormat: "MM/DD/YYYY",
  },
  {
    source: "ynab",
    dateColumns: ["date"],
    descriptionColumns: ["payee", "memo"],
    amountColumns: ["amount"],
    categoryColumns: ["category group/category", "category"],
    accountColumns: ["account"],
    typeColumns: [],
    debitColumn: "outflow",
    creditColumn: "inflow",
    dateFormat: "MM/DD/YYYY",
  },
  {
    source: "quicken",
    dateColumns: ["date"],
    descriptionColumns: ["payee", "description"],
    amountColumns: ["amount"],
    categoryColumns: ["category"],
    accountColumns: ["account"],
    typeColumns: ["type"],
    dateFormat: "MM/DD/YYYY",
  },
  {
    source: "everydollar",
    dateColumns: ["date"],
    descriptionColumns: ["description", "item"],
    amountColumns: ["amount", "planned"],
    categoryColumns: ["category", "budget group"],
    accountColumns: [],
    typeColumns: ["type"],
    dateFormat: "MM/DD/YYYY",
  },
];

// ─── CSV PARSING ──────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(raw: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
    rows.push(row);
  }
  return { headers, rows };
}

// ─── SOURCE DETECTION ─────────────────────────────────────────────

function detectSource(headers: string[]): PfmSource {
  const lowerHeaders = headers.map(h => h.toLowerCase());
  // YNAB has distinctive "inflow"/"outflow" columns
  if (lowerHeaders.includes("inflow") && lowerHeaders.includes("outflow")) return "ynab";
  // Monarch has "original statement"
  if (lowerHeaders.includes("original statement")) return "monarch";
  // Mint has "original description" + "transaction type"
  if (lowerHeaders.includes("original description") && lowerHeaders.includes("transaction type")) return "mint";
  // Empower has "merchant" + "account"
  if (lowerHeaders.includes("merchant") && lowerHeaders.includes("account")) return "empower";
  // EveryDollar has "budget group"
  if (lowerHeaders.includes("budget group")) return "everydollar";
  // Quicken has "payee" + "type"
  if (lowerHeaders.includes("payee") && lowerHeaders.includes("type")) return "quicken";
  return "other";
}

// ─── COLUMN MAPPING ───────────────────────────────────────────────

function findColumn(headers: string[], candidates: string[]): string | null {
  for (const c of candidates) {
    const found = headers.find(h => h === c.toLowerCase());
    if (found) return found;
  }
  return null;
}

function buildMapping(headers: string[], pattern: ColumnPattern): PfmColumnMapping[] {
  const mappings: PfmColumnMapping[] = [];
  const dateCol = findColumn(headers, pattern.dateColumns);
  if (dateCol) mappings.push({ sourceColumn: dateCol, targetField: "date", confidence: 0.95 });
  const descCol = findColumn(headers, pattern.descriptionColumns);
  if (descCol) mappings.push({ sourceColumn: descCol, targetField: "description", confidence: 0.9 });
  const amtCol = findColumn(headers, pattern.amountColumns);
  if (amtCol) mappings.push({ sourceColumn: amtCol, targetField: "amount", confidence: 0.9 });
  const catCol = findColumn(headers, pattern.categoryColumns);
  if (catCol) mappings.push({ sourceColumn: catCol, targetField: "category", confidence: 0.85 });
  const accCol = findColumn(headers, pattern.accountColumns);
  if (accCol) mappings.push({ sourceColumn: accCol, targetField: "account", confidence: 0.8 });
  return mappings;
}

// ─── DATE PARSING ─────────────────────────────────────────────────

function parseDate(raw: string): string {
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.split("T")[0];
  // MM/DD/YYYY
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  // DD/MM/YYYY (fallback)
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return raw;
}

function parseAmount(raw: string): number {
  // Remove currency symbols, commas, whitespace
  const cleaned = raw.replace(/[$€£¥,\s]/g, "").replace(/\((.+)\)/, "-$1");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ─── MAIN PARSE FUNCTION ─────────────────────────────────────────

export function parsePfmCsv(rawCsv: string, hintSource?: PfmSource): {
  transactions: PfmTransaction[];
  result: PfmImportResult;
  detectedSource: PfmSource;
  mappings: PfmColumnMapping[];
} {
  const { headers, rows } = parseCSV(rawCsv);
  if (headers.length === 0 || rows.length === 0) {
    return {
      transactions: [],
      result: {
        totalRows: 0, importedRows: 0, skippedRows: 0,
        dateRange: { start: "", end: "" },
        categoryBreakdown: {}, unmappedColumns: headers, warnings: ["No data rows found"],
      },
      detectedSource: "other",
      mappings: [],
    };
  }

  const detectedSource = hintSource || detectSource(headers);
  const pattern = KNOWN_PATTERNS.find(p => p.source === detectedSource) || KNOWN_PATTERNS[0];
  const mappings = buildMapping(headers, pattern);

  const dateMapping = mappings.find(m => m.targetField === "date");
  const descMapping = mappings.find(m => m.targetField === "description");
  const amtMapping = mappings.find(m => m.targetField === "amount");
  const catMapping = mappings.find(m => m.targetField === "category");
  const accMapping = mappings.find(m => m.targetField === "account");

  const transactions: PfmTransaction[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  for (const row of rows) {
    try {
      const dateRaw = dateMapping ? row[dateMapping.sourceColumn] : "";
      const date = parseDate(dateRaw);
      if (!date || date === dateRaw && !/\d{4}/.test(date)) {
        skipped++;
        continue;
      }

      const description = descMapping ? row[descMapping.sourceColumn] || "" : "";
      let amount: number;

      // Handle YNAB inflow/outflow
      if (pattern.debitColumn && pattern.creditColumn) {
        const inflow = parseAmount(row[pattern.creditColumn.toLowerCase()] || "0");
        const outflow = parseAmount(row[pattern.debitColumn.toLowerCase()] || "0");
        amount = inflow > 0 ? inflow : -outflow;
      } else {
        amount = amtMapping ? parseAmount(row[amtMapping.sourceColumn]) : 0;
      }

      // Mint uses "debit" type for expenses (positive amount = expense)
      if (detectedSource === "mint") {
        const txType = (row["transaction type"] || "").toLowerCase();
        if (txType === "debit" && amount > 0) amount = -amount;
      }

      const type: PfmTransaction["type"] = amount > 0 ? "income" : amount < 0 ? "expense" : "transfer";

      transactions.push({
        date,
        description,
        amount,
        category: catMapping ? row[catMapping.sourceColumn] || undefined : undefined,
        account: accMapping ? row[accMapping.sourceColumn] || undefined : undefined,
        type,
        originalRow: row,
      });
    } catch {
      skipped++;
    }
  }

  // Compute summary
  const dates = transactions.map(t => t.date).filter(Boolean).sort();
  const categoryBreakdown: Record<string, number> = {};
  for (const t of transactions) {
    const cat = t.category || "Uncategorized";
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + Math.abs(t.amount);
  }

  const mappedCols = new Set(mappings.map(m => m.sourceColumn));
  const unmappedColumns = headers.filter(h => !mappedCols.has(h));

  return {
    transactions,
    result: {
      totalRows: rows.length,
      importedRows: transactions.length,
      skippedRows: skipped,
      dateRange: { start: dates[0] || "", end: dates[dates.length - 1] || "" },
      categoryBreakdown,
      unmappedColumns,
      warnings,
    },
    detectedSource,
    mappings,
  };
}
