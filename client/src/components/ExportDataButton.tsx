/**
 * ExportDataButton — generic CSV/JSON export for any page with tabular data.
 *
 * Usage:
 *   <ExportDataButton
 *     data={rows}
 *     filename="compliance-audit"
 *     columns={["date", "rule", "status", "score"]}
 *   />
 *
 * Supports CSV (default) and JSON export formats.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileJson, ClipboardCopy } from "lucide-react";
import { toast } from "sonner";

export interface ExportDataButtonProps {
  /** Array of objects to export */
  data: Record<string, unknown>[];
  /** Base filename (without extension) */
  filename: string;
  /** Column keys to include (order preserved). If omitted, uses all keys from first row. */
  columns?: string[];
  /** Human-readable column headers (same order as columns). Falls back to column keys. */
  headers?: string[];
  /** Disable the button */
  disabled?: boolean;
  /** Compact icon-only mode */
  compact?: boolean;
  /** Optional label override */
  label?: string;
}

function toCSV(
  data: Record<string, unknown>[],
  columns: string[],
  headers: string[],
): string {
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of data) {
    lines.push(columns.map((c) => escape(row[c])).join(","));
  }
  return lines.join("\n");
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportDataButton({
  data,
  filename,
  columns,
  headers,
  disabled,
  compact,
  label = "Export",
}: ExportDataButtonProps) {
  const [exporting, setExporting] = useState(false);

  const cols = columns ?? (data.length > 0 ? Object.keys(data[0]) : []);
  const hdrs = headers ?? cols.map((c) => c.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()));

  const handleCopy = async () => {
    if (!data.length) {
      toast.info("No data to export");
      return;
    }
    try {
      const text = toCSV(data, cols, hdrs);
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${data.length} rows to clipboard`);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleExport = (format: "csv" | "json") => {
    if (!data.length) {
      toast.info("No data to export");
      return;
    }
    setExporting(true);
    try {
      const ts = new Date().toISOString().slice(0, 10);
      if (format === "csv") {
        download(toCSV(data, cols, hdrs), `${filename}-${ts}.csv`, "text/csv");
      } else {
        const filtered = data.map((row) => {
          const obj: Record<string, unknown> = {};
          cols.forEach((c) => { obj[c] = row[c]; });
          return obj;
        });
        download(JSON.stringify(filtered, null, 2), `${filename}-${ts}.json`, "application/json");
      }
      toast.success(`Exported ${data.length} rows as ${format.toUpperCase()}`);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Export data" disabled={disabled || exporting || !data.length}>
            <Download className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleExport("csv")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Export CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("json")}>
            <FileJson className="mr-2 h-4 w-4" /> Export JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopy}>
            <ClipboardCopy className="mr-2 h-4 w-4" /> Copy to clipboard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || exporting || !data.length} className="gap-2">
          <Download className="h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")}>
          <FileJson className="mr-2 h-4 w-4" /> Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy}>
          <ClipboardCopy className="mr-2 h-4 w-4" /> Copy to clipboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
