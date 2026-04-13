/**
 * ImprovementDashboard — admin-only view of the continuous improvement engine.
 *
 * Shows:
 *   1. Quality scores summary (average, distribution, recent scores)
 *   2. Improvement hypotheses (pending/promoted/rejected with details)
 *   3. A "Run Now" button to trigger an immediate improvement cycle
 *
 * Data from: adminIntelligence.getQualityScoresSummary,
 *            adminIntelligence.getImprovementHypotheses,
 *            adminIntelligence.runImprovementEngineNow
 */
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Brain, Loader2, Play, CheckCircle2, XCircle,
  Clock, TrendingUp, BarChart3, AlertTriangle,
  Lightbulb, RefreshCw,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-400",
  promoted: "bg-emerald-500/20 text-emerald-400",
  rejected: "bg-destructive/20 text-destructive",
  testing: "bg-chart-3/20 text-chart-3",
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  promoted: CheckCircle2,
  rejected: XCircle,
  testing: RefreshCw,
};

export default function ImprovementDashboard() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const qualitySummary = trpc.adminIntelligence.getQualityScoresSummary.useQuery(
    undefined,
    { staleTime: 30_000, retry: false },
  );

  const hypotheses = trpc.adminIntelligence.getImprovementHypotheses.useQuery(
    { status: statusFilter as any, limit: 50 },
    { staleTime: 30_000, retry: false },
  );

  const runNow = trpc.adminIntelligence.runImprovementEngineNow.useMutation({
    onSuccess: (data) => {
      toast.success(`Improvement engine ran: ${data.hypothesesGenerated} hypotheses, ${data.ratingsBackfilled} messages rated`);
      qualitySummary.refetch();
      hypotheses.refetch();
    },
    onError: (e) => toast.error(`Engine run failed: ${e.message}`),
  });

  const qs = qualitySummary.data;
  const hyps = hypotheses.data;

  return (
    <AppShell title="Improvement Engine">
      <SEOHead title="Improvement Engine Dashboard" description="Monitor AI quality, hypotheses, and continuous improvement cycles" />
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-accent" />
              Improvement Engine
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor AI quality scores, improvement hypotheses, and learning loop status.
            </p>
          </div>
          <Button
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending}
            variant="default"
            size="sm"
            aria-label="Run improvement engine now"
          >
            {runNow.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run Now
          </Button>
        </div>

        {/* Quality Scores Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent" /> AI Response Quality (Last 24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {qualitySummary.isPending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading quality data…
              </div>
            ) : qs ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground/70 uppercase">Avg Score</p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-accent">
                      {Number(qs.avgScore).toFixed(3)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground/70 uppercase">Messages Rated</p>
                    <p className="text-2xl font-bold font-mono tabular-nums">{qs.totalRated}</p>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <p className="text-[10px] text-muted-foreground/70 uppercase">Score Distribution</p>
                    <div className="flex items-end gap-1 h-12">
                      {Object.entries(qs.distribution).map(([bucket, count]) => {
                        const maxCount = Math.max(...Object.values(qs.distribution).map(Number), 1);
                        const height = (Number(count) / maxCount) * 100;
                        return (
                          <div key={bucket} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                              className="w-full rounded-t bg-accent/60"
                              style={{ height: `${Math.max(height, 4)}%` }}
                            />
                            <p className="text-[8px] text-muted-foreground/50">{bucket.split("-")[0]}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {qs.recentScores.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Recent Scores</p>
                    <div className="flex flex-wrap gap-1">
                      {qs.recentScores.slice(0, 20).map((s: any, i: number) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className={`text-[9px] font-mono ${
                            Number(s.score) >= 0.8 ? "border-emerald-500/30 text-emerald-400" :
                            Number(s.score) >= 0.5 ? "border-amber-500/30 text-amber-400" :
                            "border-destructive/30 text-destructive"
                          }`}
                          title={s.reasoning}
                        >
                          {Number(s.score).toFixed(2)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No quality data available. Run the improvement engine to start scoring.</p>
            )}
          </CardContent>
        </Card>

        {/* Improvement Hypotheses */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-accent" /> Improvement Hypotheses
                {hyps && <Badge variant="outline" className="text-[10px] ml-1">{hyps.total} total</Badge>}
              </CardTitle>
              <div className="flex gap-1">
                {["all", "pending", "promoted", "rejected", "testing"].map(s => (
                  <Button
                    key={s}
                    variant={(s === "all" && !statusFilter) || statusFilter === s ? "default" : "outline"}
                    size="sm"
                    className="text-[10px] h-6 px-2"
                    onClick={() => setStatusFilter(s === "all" ? undefined : s)}
                    aria-label={`Filter by ${s}`}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {hypotheses.isPending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading hypotheses…
              </div>
            ) : hyps && hyps.hypotheses.length > 0 ? (
              <ScrollArea className="h-auto max-h-[500px]">
                <div className="space-y-2">
                  {hyps.hypotheses.map((h: any) => {
                    const Icon = STATUS_ICONS[h.status] || Clock;
                    const scope = h.scope || {};
                    return (
                      <div key={h.id} className="p-3 rounded-lg border border-border/50 bg-secondary/10 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{scope.title || h.hypothesisText?.slice(0, 80)}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{h.hypothesisText}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge className={`text-[9px] ${STATUS_COLORS[h.status] || ""}`}>
                              {h.status}
                            </Badge>
                            <Badge variant="outline" className="text-[9px]">{h.passType}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
                          {scope.priority && <span>Priority: {scope.priority}</span>}
                          {h.expectedDelta != null && <span>Expected Δ: {(h.expectedDelta * 100).toFixed(0)}%</span>}
                          {h.testCount > 0 && <span>Tests: {h.testCount}</span>}
                          {h.createdAt && <span>{new Date(h.createdAt).toLocaleDateString()}</span>}
                          {h.rejectedReason && (
                            <span className="text-destructive">Rejected: {h.rejectedReason}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hypotheses yet. Run the improvement engine to generate them.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last Run Summary */}
        {runNow.data && (
          <Card className="border-accent/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" /> Last Manual Run Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground/70 uppercase">Signals</p>
                  <p className="text-lg font-bold">{(runNow.data.signals ?? []).length}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground/70 uppercase">Convergence</p>
                  <Badge variant={runNow.data?.convergence?.status === "CONVERGED" ? "default" : "outline"}>
                    {runNow.data?.convergence?.status ?? "—"}
                  </Badge>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground/70 uppercase">Hypotheses</p>
                  <p className="text-lg font-bold">{runNow.data.hypothesesGenerated}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground/70 uppercase">Messages Rated</p>
                  <p className="text-lg font-bold">{runNow.data.ratingsBackfilled}</p>
                </div>
              </div>
              {(runNow.data.signals ?? []).length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Detected Signals</p>
                  {(runNow.data.signals ?? []).map((s: any, i: number) => (
                    <div key={i} className={`flex items-center gap-2 text-xs p-1.5 rounded ${
                      s.severity === "critical" ? "bg-destructive/10 text-destructive" :
                      s.severity === "high" ? "bg-amber-500/10 text-amber-400" :
                      "bg-muted/50 text-muted-foreground"
                    }`}>
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span className="font-medium">[{s.signalType}]</span>
                      <span>{s.sourceMetric}: {s.sourceValue}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
