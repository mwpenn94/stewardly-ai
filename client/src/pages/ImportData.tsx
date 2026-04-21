/**
 * ImportData — Data import wizard for CSV/XLSX client data.
 * Steps: Upload → Map Columns → Import (real tRPC) → Summary
 *
 * Pass 16: Wired to real `trpc.dataImport.startImport` mutation.
 * Removed simulated interval. CSV template download generates a
 * real file. "View Imported Clients" navigates to /leads.
 */
import { useState, useRef } from "react";
import { SEOHead } from "@/components/SEOHead";
import { FileUploader } from "@/components/FileUploader";
import { ColumnMapper } from "@/components/ColumnMapper";
import { ImportProgress } from "@/components/ImportProgress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2, ArrowLeft, FileSpreadsheet, Download, AlertTriangle, Info } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

type Step = "upload" | "map" | "import" | "done";

const TARGET_FIELDS = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "phone", label: "Phone" },
  { key: "title", label: "Job Title" },
  { key: "company", label: "Company" },
  { key: "linkedinUrl", label: "LinkedIn URL" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP Code" },
  { key: "source", label: "Lead Source" },
  { key: "notes", label: "Notes" },
  { key: "aum", label: "AUM" },
  { key: "accountType", label: "Account Type" },
  { key: "riskTolerance", label: "Risk Tolerance" },
];

const IMPORT_SOURCES = [
  { value: "csv_upload", label: "CSV Upload" },
  { value: "dripify_export", label: "Dripify Export" },
  { value: "linkedin_sales_nav", label: "LinkedIn Sales Navigator" },
  { value: "ghl_export", label: "GoHighLevel Export" },
  { value: "workable_export", label: "Workable ATS Export" },
  { value: "wealthbox_export", label: "Wealthbox Export" },
  { value: "redtail_export", label: "Redtail Export" },
  { value: "salesforce_export", label: "Salesforce Export" },
  { value: "other", label: "Other" },
];

function downloadCsvTemplate() {
  const headers = TARGET_FIELDS.map(f => f.label);
  const sampleRow = TARGET_FIELDS.map(f => {
    const samples: Record<string, string> = {
      firstName: "Jane", lastName: "Smith", email: "jane.smith@example.com",
      phone: "555-123-4567", title: "VP of Finance", company: "Acme Corp",
      linkedinUrl: "https://linkedin.com/in/janesmith", city: "Phoenix",
      state: "AZ", zip: "85001", source: "LinkedIn", notes: "Met at conference",
      aum: "500000", accountType: "IRA", riskTolerance: "moderate",
    };
    return samples[f.key] || "";
  });
  const csv = [headers.join(","), sampleRow.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stewardly-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Template downloaded");
}

export default function ImportData() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("upload");
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importSource, setImportSource] = useState("csv_upload");
  const [importStatus, setImportStatus] = useState<{
    status: "pending" | "parsing" | "validating" | "importing" | "complete" | "failed";
    totalRows: number;
    processedRows: number;
    errorCount: number;
    errors?: string[];
    startedAt: number;
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number; skipped: number; failed: number; updated: number; jobId: number;
  } | null>(null);
  const fileDataRef = useRef<{ fileName: string; records: Record<string, string>[] }>({ fileName: "", records: [] });

  const startImportMutation = trpc.dataImport.startImport.useMutation({
    onSuccess: (result) => {
      setImportResult(result);
      setImportStatus(prev => prev ? { ...prev, status: "complete", processedRows: result.imported + result.skipped + result.failed + result.updated } : null);
      setStep("done");
      toast.success(`Import complete: ${result.imported} new, ${result.updated} updated, ${result.skipped} skipped`);
    },
    onError: (err) => {
      setImportStatus(prev => prev ? { ...prev, status: "failed", errors: [err.message] } : null);
      toast.error("Import failed: " + err.message);
    },
  });

  const handleUpload = async (files: File[]) => {
    const file = files[0];
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      toast.error("File must have at least a header row and one data row");
      return;
    }
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ""));
    const records = lines.slice(1).map(line => {
      const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ""));
      const record: Record<string, string> = {};
      headers.forEach((h, i) => { record[h] = values[i] || ""; });
      return record;
    });
    fileDataRef.current = { fileName: file.name, records };
    setSourceColumns(headers);
    toast.info(`Parsed ${records.length} rows from ${file.name}`);

    // Auto-detect import source from filename
    const fn = file.name.toLowerCase();
    if (fn.includes("dripify")) setImportSource("dripify_export");
    else if (fn.includes("linkedin") || fn.includes("sales_nav") || fn.includes("salesnav")) setImportSource("linkedin_sales_nav");
    else if (fn.includes("ghl") || fn.includes("gohighlevel") || fn.includes("highlevel")) setImportSource("ghl_export");
    else if (fn.includes("workable")) setImportSource("workable_export");
    else if (fn.includes("wealthbox")) setImportSource("wealthbox_export");
    else if (fn.includes("redtail")) setImportSource("redtail_export");
    else if (fn.includes("salesforce")) setImportSource("salesforce_export");

    setStep("map");
  };

  const handleConfirmMapping = async (m: Record<string, string>) => {
    setMapping(m);
    setStep("import");

    const { fileName, records } = fileDataRef.current;
    const totalRows = records.length;
    setImportStatus({ status: "importing", totalRows, processedRows: 0, errorCount: 0, startedAt: Date.now() });

    // Build the field mapping: { sourceColumn → targetFieldKey }
    const fieldMapping: Record<string, string> = {};
    for (const [sourceCol, targetKey] of Object.entries(m)) {
      if (targetKey && targetKey !== "__skip__") {
        fieldMapping[sourceCol] = targetKey;
      }
    }

    startImportMutation.mutate({
      importSource,
      fileName,
      records,
      fieldMapping,
      options: { enrichAfter: true, scoreAfter: true },
    });
  };

  return (
    <AppShell title="Import Data">
    <div className="container max-w-4xl py-8 space-y-6">
      <SEOHead title="Import Data" description="Import client data from CSV or Excel files" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Leads
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Import Data</h1>
            <p className="text-sm text-muted-foreground">Upload CSV or Excel files to import leads into the pipeline</p>
          </div>
        </div>
        <Badge variant="outline" className="capitalize">{step}</Badge>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {(["upload", "map", "import", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
              step === s ? "bg-primary text-primary-foreground" :
              (["upload", "map", "import", "done"].indexOf(step) > i) ? "bg-emerald-500/20 text-emerald-400" :
              "bg-muted text-muted-foreground"
            }`}>
              {(["upload", "map", "import", "done"].indexOf(step) > i) ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className="text-xs capitalize hidden sm:inline">{s === "done" ? "Complete" : s}</span>
            {i < 3 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          {/* Import source selector */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4" /> Import Source
              </CardTitle>
              <CardDescription className="text-xs">
                Select where your data is coming from for optimized column mapping
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={importSource} onValueChange={setImportSource}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORT_SOURCES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <FileUploader accept={[".csv", ".xlsx", ".xls", ".tsv"]} maxSizeMB={16} onUpload={handleUpload} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="h-4 w-4" /> Download Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-2">
                Use our template to ensure your data maps correctly. Includes sample data for all supported fields.
              </p>
              <Button variant="outline" size="sm" onClick={downloadCsvTemplate}>
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Download CSV Template
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "map" && (
        <div className="space-y-4">
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2 text-sm">
                <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-blue-300">
                    {fileDataRef.current.records.length} rows from "{fileDataRef.current.fileName}"
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Source: {IMPORT_SOURCES.find(s => s.value === importSource)?.label || importSource}.
                    Map your columns below — required fields are marked with a star.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <ColumnMapper
            sourceColumns={sourceColumns}
            targetFields={TARGET_FIELDS}
            onConfirm={handleConfirmMapping}
          />
        </div>
      )}

      {(step === "import" || step === "done") && importStatus && (
        <ImportProgress {...importStatus} />
      )}

      {step === "done" && importResult && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span className="font-medium">Import Complete</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-emerald-400">{importResult.imported}</div>
                <div className="text-xs text-muted-foreground">New Leads</div>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-400">{importResult.updated}</div>
                <div className="text-xs text-muted-foreground">Updated</div>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-yellow-400">{importResult.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-red-400">{importResult.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>
            {importResult.failed > 0 && (
              <div className="flex items-center gap-2 text-xs text-yellow-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{importResult.failed} records failed — usually due to missing required fields (email)</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <div className="flex gap-3">
          <Button onClick={() => navigate("/leads")}>View Lead Pipeline</Button>
          <Button variant="outline" onClick={() => { setStep("upload"); setImportStatus(null); setImportResult(null); }}>
            Import More Data
          </Button>
        </div>
      )}
    </div>
    </AppShell>
  );
}
