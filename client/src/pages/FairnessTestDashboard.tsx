import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield, Play, RefreshCw, ChevronDown, ChevronRight, AlertTriangle,
  CheckCircle, Clock, BarChart3, Users, FileText, Loader2, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function FairnessTestDashboard() {
  const [, navigate] = useLocation();
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());

  const runsQuery = trpc.fairness.listRuns.useQuery(undefined, { staleTime: 10000 });
  const promptsQuery = trpc.fairness.listPrompts.useQuery(undefined, { staleTime: 60000 });
  const seedMut = trpc.fairness.seedPrompts.useMutation({
    onSuccess: (data) => {
      if (data.seeded) {
        toast.success(`Seeded ${data.count} fairness test prompts`);
        promptsQuery.refetch();
      } else {
        toast.info(data.message);
      }
    },
  });
  const startRunMut = trpc.fairness.startRun.useMutation({
    onSuccess: (data) => {
      toast.success(`Fairness test completed. Overall score: ${data.summary.overallScore.toFixed(1)}%`);
      runsQuery.refetch();
      setSelectedRunId(data.runId);
    },
    onError: (err) => toast.error(err.message),
  });

  const detailsQuery = trpc.fairness.getRunDetails.useQuery(
    { runId: selectedRunId! },
    { enabled: !!selectedRunId, staleTime: 30000 }
  );

  const runs = runsQuery.data || [];
  const prompts = promptsQuery.data || [];
  const details = detailsQuery.data;

  const toggleResult = (id: number) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const scoreColor = (score: number) => {
    if (score >= 0.8) return "text-emerald-400";
    if (score >= 0.6) return "text-amber-400";
    return "text-red-400";
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge variant="outline" className="text-emerald-400 border-emerald-400/30"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "running": return <Badge variant="outline" className="text-blue-400 border-blue-400/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
      case "failed": return <Badge variant="outline" className="text-red-400 border-red-400/30"><AlertTriangle className="w-3 h-3 mr-1" />Failed</Badge>;
      default: return <Badge variant="outline" className="text-muted-foreground"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="w-6 h-6 text-primary" />
                Fairness Testing Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Test AI responses across 20 demographic-varied prompts to detect bias
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedMut.mutate()}
              disabled={seedMut.isPending}
            >
              {seedMut.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileText className="w-4 h-4 mr-1.5" />}
              Seed Prompts
            </Button>
            <Button
              size="sm"
              onClick={() => startRunMut.mutate()}
              disabled={startRunMut.isPending || prompts.length === 0}
            >
              {startRunMut.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
              {startRunMut.isPending ? "Running Tests..." : "Start Test Run"}
            </Button>
          </div>
        </div>

        {/* Prompt Count */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="w-4 h-4" />
              <span className="text-xs">Test Prompts</span>
            </div>
            <p className="text-2xl font-bold">{prompts.length}</p>
            <p className="text-[10px] text-muted-foreground">Across age, gender, income, race, education, family, disability, geography</p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs">Total Runs</span>
            </div>
            <p className="text-2xl font-bold">{runs.length}</p>
            <p className="text-[10px] text-muted-foreground">
              {runs.filter((r: any) => r.status === "completed").length} completed
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Shield className="w-4 h-4" />
              <span className="text-xs">Latest Score</span>
            </div>
            <p className={`text-2xl font-bold ${runs.length > 0 && runs[0].overallScore ? scoreColor(runs[0].overallScore / 100) : "text-muted-foreground"}`}>
              {runs.length > 0 && runs[0].overallScore ? `${runs[0].overallScore.toFixed(1)}%` : "N/A"}
            </p>
            <p className="text-[10px] text-muted-foreground">Combined tone + quality score</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Run History */}
          <div className="lg:col-span-1">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Run History
            </h2>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2 pr-2">
                {runs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    No test runs yet. Seed prompts and start a run.
                  </div>
                )}
                {runs.map((run: any) => (
                  <button
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedRunId === run.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">Run #{run.id}</span>
                      {statusBadge(run.status)}
                    </div>
                    {run.overallScore !== null && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Score</span>
                          <span className={scoreColor(run.overallScore / 100)}>
                            {run.overallScore.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={run.overallScore} className="h-1.5" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                      <span>{run.completedPrompts}/{run.totalPrompts} prompts</span>
                      {run.biasDetected && (
                        <Badge variant="outline" className="text-amber-400 border-amber-400/30 text-[9px] px-1 py-0">
                          <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />Bias
                        </Badge>
                      )}
                    </div>
                    <p className="text-[9px] text-muted-foreground/60 mt-1">
                      {run.createdAt ? new Date(Number(run.createdAt)).toLocaleString() : ""}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Run Details */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Run Details
              {selectedRunId && (
                <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={() => detailsQuery.refetch()}>
                  <RefreshCw className="w-3 h-3 mr-1" />Refresh
                </Button>
              )}
            </h2>

            {!selectedRunId ? (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                Select a run from the history to view details
              </div>
            ) : detailsQuery.isLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : details ? (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4 pr-2">
                  {/* Summary */}
                  {details.run.summary ? ((): React.ReactNode => {
                    const summary = typeof details.run.summary === "string" ? JSON.parse(details.run.summary) : details.run.summary;
                    return (
                      <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                        <h3 className="text-xs font-semibold">Summary</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Tone Score</p>
                            <p className={`text-lg font-bold ${scoreColor(summary.averageToneScore)}`}>
                              {(summary.averageToneScore * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Quality Score</p>
                            <p className={`text-lg font-bold ${scoreColor(summary.averageQualityScore)}`}>
                              {(summary.averageQualityScore * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Disclaimer Rate</p>
                            <p className={`text-lg font-bold ${scoreColor(summary.disclaimerRate)}`}>
                              {(summary.disclaimerRate * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Bias Indicators</p>
                            <p className={`text-lg font-bold ${summary.biasIndicatorsFound?.length > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                              {summary.biasIndicatorsFound?.length || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })() : null}

                  {/* Recommendations */}
                  {details.run.recommendations ? ((): React.ReactNode => {
                    const recs = typeof details.run.recommendations === "string" ? JSON.parse(details.run.recommendations) : details.run.recommendations;
                    if (!recs || recs.length === 0) return null;
                    return (
                      <div className="p-4 rounded-lg border border-amber-400/20 bg-amber-400/5 space-y-2">
                        <h3 className="text-xs font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          Recommendations
                        </h3>
                        <ul className="space-y-1">
                          {recs.map((rec: string, i: number) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <span className="text-amber-400 mt-0.5">•</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })() : null}

                  {/* Individual Results */}
                  <h3 className="text-xs font-semibold mt-4">Individual Results ({details.results?.length || 0})</h3>
                  {details.results?.map((result: any) => (
                    <div key={result.id} className="rounded-lg border border-border bg-card overflow-hidden">
                      <button
                        onClick={() => toggleResult(result.id)}
                        className="w-full p-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {expandedResults.has(result.id) ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <div className="text-left min-w-0">
                            <p className="text-xs font-medium truncate">
                              {result.prompt?.demographic?.replace(/_/g, " ")}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {result.prompt?.category} — {result.prompt?.promptText?.substring(0, 80)}...
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <div className="text-right">
                            <p className={`text-xs font-medium ${scoreColor(result.toneScore || 0)}`}>
                              T:{((result.toneScore || 0) * 100).toFixed(0)}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-medium ${scoreColor(result.qualityScore || 0)}`}>
                              Q:{((result.qualityScore || 0) * 100).toFixed(0)}%
                            </p>
                          </div>
                          {result.disclaimerPresent && (
                            <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 text-[9px] px-1 py-0">
                              <CheckCircle className="w-2.5 h-2.5" />
                            </Badge>
                          )}
                        </div>
                      </button>
                      {expandedResults.has(result.id) && (
                        <div className="px-3 pb-3 border-t border-border/50 space-y-2">
                          <div className="mt-2">
                            <p className="text-[10px] text-muted-foreground font-medium mb-1">Expected Behavior:</p>
                            <p className="text-xs text-muted-foreground">{result.prompt?.expectedBehavior}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground font-medium mb-1">AI Response:</p>
                            <div className="text-xs text-foreground/80 bg-muted/30 p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap">
                              {result.response || "No response recorded"}
                            </div>
                          </div>
                          {result.biasIndicators && ((): React.ReactNode => {
                            const indicators = typeof result.biasIndicators === "string" ? JSON.parse(result.biasIndicators) : result.biasIndicators;
                            if (!indicators || indicators.length === 0) return null;
                            return (
                              <div>
                                <p className="text-[10px] text-muted-foreground font-medium mb-1">Bias Indicators:</p>
                                <div className="flex flex-wrap gap-1">
                                  {indicators.map((b: string, i: number) => (
                                    <Badge key={i} variant="outline" className="text-amber-400 border-amber-400/30 text-[9px]">
                                      {b}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                          <div className="flex gap-4 text-[10px] text-muted-foreground">
                            <span>Response time: {result.responseTimeMs || 0}ms</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground text-sm">
                No details available for this run
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
