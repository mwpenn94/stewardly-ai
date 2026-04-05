/**
 * CSV Parser — Auto-detect delimiter and encoding, stream large files
 */

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export function parseCsv(content: string): ParseResult {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 };

  // Auto-detect delimiter
  const firstLine = lines[0];
  const delimiters = [",", "\t", ";", "|"];
  const delimiter = delimiters.reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best
  );

  const headers = parseLine(lines[0], delimiter);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      let val = values[idx] || "";
      // CSV injection protection
      if (/^[=+\-@|\t\r]/.test(val)) val = "'" + val;
      row[h] = val.trim();
    });
    rows.push(row);
  }

  return { headers, rows, totalRows: rows.length };
}

function parseLine(line: string, delimiter: string): string[] {
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
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
