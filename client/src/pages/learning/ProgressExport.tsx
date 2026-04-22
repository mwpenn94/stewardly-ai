/**
 * ProgressExport.tsx — Export mastery data as CSV/JSON
 *
 * Pass 36. Lets users export their SRS progress, mastery levels,
 * and study session history for backup or external analysis.
 */
import { useState, useCallback } from "react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download, ArrowLeft, FileJson, FileSpreadsheet,
  CheckCircle2, Loader2, Database, Calendar,
} from "lucide-react";
import { toast } from "sonner";

type ExportFormat = "csv" | "json";

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCSV(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val == null) return "";
      const str = String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    });
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

export default function ProgressExport() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [exporting, setExporting] = useState<string | null>(null);

  const masteryQ = trpc.learning.mastery.getMine.useQuery(undefined, { enabled: !!isAuthenticated });
  const summaryQ = trpc.learning.mastery.summary.useQuery(undefined, { enabled: !!isAuthenticated });
  const sessionsQ = trpc.learningSocial.studySessions.list.useQuery({ limit: 500 }, { enabled: !!isAuthenticated });

  const exportMastery = useCallback((format: ExportFormat) => {
    setExporting("mastery-" + format);
    try {
      const items = masteryQ.data ?? [];
      const rows = items.map((item: any) => ({
        itemKey: item.itemKey,
        itemType: item.itemType,
        correctCount: item.correctCount ?? 0,
        incorrectCount: item.incorrectCount ?? 0,
        interval: item.interval ?? 0,
        easeFactor: item.easeFactor ?? 2.5,
        lastReviewedAt: item.lastReviewedAt ? new Date(item.lastReviewedAt).toISOString() : "",
        nextReviewAt: item.nextReviewAt ? new Date(item.nextReviewAt).toISOString() : "",
      }));

      const timestamp = new Date().toISOString().slice(0, 10);
      if (format === "csv") {
        downloadFile(toCSV(rows), `mastery-export-${timestamp}.csv`, "text/csv");
      } else {
        downloadFile(JSON.stringify(rows, null, 2), `mastery-export-${timestamp}.json`, "application/json");
      }
      toast.success(`Exported ${rows.length} mastery records as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  }, [masteryQ.data]);

  const exportSessions = useCallback((format: ExportFormat) => {
    setExporting("sessions-" + format);
    try {
      const sessions = sessionsQ.data ?? [];
      const rows = sessions.map((s: any) => ({
        id: s.id,
        type: s.type ?? "review",
        durationMinutes: s.durationMinutes ?? 0,
        itemsReviewed: s.itemsReviewed ?? 0,
        correctCount: s.correctCount ?? 0,
        createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : "",
      }));

      const timestamp = new Date().toISOString().slice(0, 10);
      if (format === "csv") {
        downloadFile(toCSV(rows), `sessions-export-${timestamp}.csv`, "text/csv");
      } else {
        downloadFile(JSON.stringify(rows, null, 2), `sessions-export-${timestamp}.json`, "application/json");
      }
      toast.success(`Exported ${rows.length} study sessions as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  }, [sessionsQ.data]);

  const exportAll = useCallback((format: ExportFormat) => {
    setExporting("all-" + format);
    try {
      const data = {
        exportDate: new Date().toISOString(),
        summary: summaryQ.data ?? {},
        mastery: masteryQ.data ?? [],
        sessions: sessionsQ.data ?? [],
      };

      const timestamp = new Date().toISOString().slice(0, 10);
      if (format === "json") {
        downloadFile(JSON.stringify(data, null, 2), `stewardly-learning-export-${timestamp}.json`, "application/json");
      } else {
        // For CSV, export mastery as the primary dataset
        exportMastery("csv");
        return;
      }
      toast.success("Exported complete learning data");
    } catch (err) {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  }, [summaryQ.data, masteryQ.data, sessionsQ.data, exportMastery]);

  // Auth guard
  if (authLoading) {
    return <AppShell><div className="container py-8"><Skeleton className="h-64 w-full" /></div></AppShell>;
  }
  if (!isAuthenticated) {
    return (
      <AppShell>
        <SEOHead title="Progress Export" description="Export your learning data" />
        <div className="container py-16 text-center space-y-4">
          <Download className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Progress Export</h1>
          <p className="text-muted-foreground">Sign in to export your learning data.</p>
          <Button onClick={() => window.location.href = getLoginUrl("/learning/export")}>Sign In</Button>
        </div>
      </AppShell>
    );
  }

  const totalMastery = masteryQ.data?.length ?? 0;
  const totalSessions = sessionsQ.data?.length ?? 0;

  return (
    <AppShell>
      <SEOHead title="Progress Export" description="Export your learning data" />
      <div className="container max-w-3xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/learning"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Download className="h-6 w-6 text-primary" />
              Progress Export
            </h1>
            <p className="text-sm text-muted-foreground">Download your learning data for backup or analysis</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <Database className="mx-auto h-6 w-6 text-blue-500 mb-1" />
              <div className="text-xl font-bold">{totalMastery}</div>
              <div className="text-xs text-muted-foreground">Mastery Records</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Calendar className="mx-auto h-6 w-6 text-green-500 mb-1" />
              <div className="text-xl font-bold">{totalSessions}</div>
              <div className="text-xs text-muted-foreground">Study Sessions</div>
            </CardContent>
          </Card>
        </div>

        {/* Export Options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mastery Data</CardTitle>
            <CardDescription>SRS progress, intervals, ease factors, and review history for all items.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => exportMastery("csv")} disabled={!!exporting || totalMastery === 0}>
              {exporting === "mastery-csv" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => exportMastery("json")} disabled={!!exporting || totalMastery === 0}>
              {exporting === "mastery-json" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileJson className="mr-2 h-4 w-4" />}
              Export JSON
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Study Sessions</CardTitle>
            <CardDescription>Session logs with duration, items reviewed, and accuracy.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => exportSessions("csv")} disabled={!!exporting || totalSessions === 0}>
              {exporting === "sessions-csv" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => exportSessions("json")} disabled={!!exporting || totalSessions === 0}>
              {exporting === "sessions-json" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileJson className="mr-2 h-4 w-4" />}
              Export JSON
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Complete Export</CardTitle>
            <CardDescription>Everything — mastery, sessions, and summary stats in one file.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => exportAll("json")} disabled={!!exporting || (totalMastery === 0 && totalSessions === 0)}>
              {exporting?.startsWith("all") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export Complete JSON
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
