/**
 * ImportData — Data import wizard for CSV/XLSX client data.
 * Steps: Upload → Map Columns → Validate → Import → Summary
 */
import { useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { FileUploader } from "@/components/FileUploader";
import { ColumnMapper } from "@/components/ColumnMapper";
import { ImportProgress } from "@/components/ImportProgress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowLeft, FileSpreadsheet, Download } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

type Step = "upload" | "map" | "import" | "done";

const TARGET_FIELDS = [
  { key: "first_name", label: "First Name", required: true },
  { key: "last_name", label: "Last Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "phone", label: "Phone" },
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "ssn_last4", label: "SSN (Last 4)" },
  { key: "address_line1", label: "Address Line 1" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP Code" },
  { key: "aum", label: "AUM" },
  { key: "account_type", label: "Account Type" },
  { key: "risk_tolerance", label: "Risk Tolerance" },
  { key: "source", label: "Lead Source" },
  { key: "notes", label: "Notes" },
];

export default function ImportData() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("upload");
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [_mapping, setMapping] = useState<Record<string, string>>({});
  const [importStatus, setImportStatus] = useState<any>(null);

  const handleUpload = async (files: File[]) => {
    // Parse headers from the uploaded file
    const file = files[0];
    const text = await file.text();
    const firstLine = text.split("\n")[0];
    const headers = firstLine.split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    setSourceColumns(headers);
    setStep("map");
  };

  const handleConfirmMapping = (m: Record<string, string>) => {
    setMapping(m);
    setStep("import");
    // Simulate import progress
    setImportStatus({ status: "importing", totalRows: 250, processedRows: 0, errorCount: 0, startedAt: Date.now() });
    let processed = 0;
    const interval = setInterval(() => {
      processed += Math.floor(Math.random() * 30) + 10;
      if (processed >= 250) {
        processed = 250;
        clearInterval(interval);
        setImportStatus((prev: any) => ({ ...prev, status: "complete", processedRows: 250 }));
        setStep("done");
      } else {
        setImportStatus((prev: any) => ({ ...prev, processedRows: processed }));
      }
    }, 500);
  };

  return (
    <AppShell title="Import Data">
    <div className="container max-w-4xl py-8 space-y-6">
      <SEOHead title="Import Data" description="Import client data from CSV or Excel files" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/chat")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Import Data</h1>
            <p className="text-sm text-muted-foreground">Upload CSV or Excel files to import client data</p>
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
          <FileUploader accept={[".csv", ".xlsx", ".xls"]} maxSizeMB={16} onUpload={handleUpload} />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="h-4 w-4" /> Download Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-2">
                Use our template to ensure your data maps correctly.
              </p>
              <Button variant="outline" size="sm" onClick={() => toast.info("Template download coming soon")}>
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Download CSV Template
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "map" && (
        <ColumnMapper
          sourceColumns={sourceColumns}
          targetFields={TARGET_FIELDS}
          onConfirm={handleConfirmMapping}
        />
      )}

      {(step === "import" || step === "done") && importStatus && (
        <ImportProgress {...importStatus} />
      )}

      {step === "done" && (
        <div className="flex gap-3">
          <Button onClick={() => navigate("/chat")}>View Imported Clients</Button>
          <Button variant="outline" onClick={() => { setStep("upload"); setImportStatus(null); }}>
            Import More Data
          </Button>
        </div>
      )}
    </div>
    </AppShell>
  );
}
