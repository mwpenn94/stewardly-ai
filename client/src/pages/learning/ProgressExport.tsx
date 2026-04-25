/**
 * ProgressExport.tsx — Export mastery data as CSV/JSON/Report
 *
 * KE-inherited design: summary stat cards in grid, large export option cards
 * with icon badges, discipline breakdown table, font-display headings,
 * font-mono metadata, motion animations, backdrop-blur header.
 */
import { useState, useCallback } from "react";
import { Link } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download, ArrowLeft, FileJson, FileSpreadsheet,
  FileText, Loader2, BookOpen, Clock,
  CheckCircle, Flame, BarChart3, Table2, LogIn,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
  // @ts-expect-error — overload resolution mismatch
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
    } catch {
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
    } catch {
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
        exportMastery("csv");
        return;
      }
      toast.success("Exported complete learning data");
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  }, [summaryQ.data, masteryQ.data, sessionsQ.data, exportMastery]);

  // Auth guard
  if (authLoading) {
    return (
      <LearningShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </LearningShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <LearningShell>
        <SEOHead title="Progress Export" description="Export your learning data" />
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <Download className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Progress Export
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Sign in to export your learning data for backup or analysis.
            </p>
            <a
              href={getLoginUrl("/learning/export")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </a>
          </div>
        </div>
      </LearningShell>
    );
  }

  const totalMastery = masteryQ.data?.length ?? 0;
  const totalSessions = sessionsQ.data?.length ?? 0;

  return (
    <LearningShell>
      <SEOHead title="Progress Export" description="Export your learning data" />
      <div className="min-h-screen">
        {/* Header — KE pattern with border-b */}
        <div className="px-6 lg:px-10 py-6 border-b border-border">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Progress Export
              </h1>
              <p className="text-xs text-muted-foreground">Download your study progress and mastery data</p>
            </div>
          </div>

          {/* Summary Cards — KE 4-column grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-border bg-card">
              <BookOpen className="w-4 h-4 text-primary mb-1" />
              <p className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{totalMastery}</p>
              <p className="text-[10px] text-muted-foreground font-mono">Mastery Records</p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <CheckCircle className="w-4 h-4 text-emerald-400 mb-1" />
              <p className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{totalSessions}</p>
              <p className="text-[10px] text-muted-foreground font-mono">Study Sessions</p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <Clock className="w-4 h-4 text-amber-400 mb-1" />
              <p className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
                {totalSessions > 0 ? `${Math.round(totalSessions * 15 / 60)}h` : "0h"}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">Est. Study Time</p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <Flame className="w-4 h-4 text-red-400 mb-1" />
              <p className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
                {totalMastery > 0 ? Math.round((totalMastery / Math.max(totalMastery, 1)) * 100) : 0}%
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">Coverage</p>
            </div>
          </div>
        </div>

        {/* Export Options — KE large card buttons */}
        <div className="px-6 lg:px-10 py-6 space-y-6">
          <section>
            <h2 className="text-base font-semibold mb-3" style={{ fontFamily: "var(--font-display)" }}>
              Export Options
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Mastery CSV */}
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => exportMastery("csv")}
                disabled={!!exporting || totalMastery === 0}
                className="flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all text-left disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-500/10">
                  <Table2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Mastery Data (CSV)</h3>
                  <p className="text-xs text-muted-foreground">SRS progress, intervals, ease factors for all items</p>
                </div>
                {exporting === "mastery-csv" ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Download className="w-4 h-4 text-muted-foreground shrink-0" />}
              </motion.button>

              {/* Mastery JSON */}
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => exportMastery("json")}
                disabled={!!exporting || totalMastery === 0}
                className="flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all text-left disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-violet-500/10">
                  <FileJson className="w-6 h-6 text-violet-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Mastery Data (JSON)</h3>
                  <p className="text-xs text-muted-foreground">Structured JSON with complete mastery records</p>
                </div>
                {exporting === "mastery-json" ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Download className="w-4 h-4 text-muted-foreground shrink-0" />}
              </motion.button>

              {/* Sessions CSV */}
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => exportSessions("csv")}
                disabled={!!exporting || totalSessions === 0}
                className="flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all text-left disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-500/10">
                  <FileSpreadsheet className="w-6 h-6 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Study Sessions (CSV)</h3>
                  <p className="text-xs text-muted-foreground">Session logs with duration, items, and accuracy</p>
                </div>
                {exporting === "sessions-csv" ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Download className="w-4 h-4 text-muted-foreground shrink-0" />}
              </motion.button>

              {/* Complete Export */}
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => exportAll("json")}
                disabled={!!exporting || (totalMastery === 0 && totalSessions === 0)}
                className="flex items-center gap-4 p-5 rounded-xl border border-primary/30 bg-card hover:border-primary/50 transition-all text-left disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
                  <Download className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Complete Export</h3>
                  <p className="text-xs text-muted-foreground">Everything — mastery, sessions, and summary in one file</p>
                </div>
                {exporting?.startsWith("all") ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Download className="w-4 h-4 text-primary shrink-0" />}
              </motion.button>
            </div>
          </section>

          {/* Data Preview */}
          <section>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
              <BarChart3 className="w-4 h-4 text-primary" />
              Data Preview
            </h2>
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-accent/30 border-b border-border">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Dataset</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Records</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium text-sm" style={{ fontFamily: "var(--font-display)" }}>Mastery Records</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{totalMastery}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${totalMastery > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {totalMastery > 0 ? "Ready" : "Empty"}
                        </span>
                      </td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium text-sm" style={{ fontFamily: "var(--font-display)" }}>Study Sessions</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{totalSessions}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${totalSessions > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {totalSessions > 0 ? "Ready" : "Empty"}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-sm" style={{ fontFamily: "var(--font-display)" }}>Summary Stats</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">1</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                          Ready
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </LearningShell>
  );
}
