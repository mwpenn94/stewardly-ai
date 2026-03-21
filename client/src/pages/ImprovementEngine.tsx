import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Activity, Users, Building2, Briefcase, Shield, User,
  Layers, TrendingUp, Wrench, Eye, CheckCircle, XCircle,
  AlertTriangle, Clock, Loader2, ChevronDown, ChevronRight,
  Zap, BarChart3, Settings, RefreshCw, ThumbsUp, ThumbsDown,
  ArrowRight, Play, Gauge, ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";

const LAYERS = [
  { key: "platform", label: "Platform", icon: Layers, color: "text-violet-400", bg: "bg-violet-500/10" },
  { key: "organization", label: "Organization", icon: Building2, color: "text-blue-400", bg: "bg-blue-500/10" },
  { key: "manager", label: "Manager", icon: Briefcase, color: "text-amber-400", bg: "bg-amber-500/10" },
  { key: "professional", label: "Professional", icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { key: "user", label: "User", icon: User, color: "text-rose-400", bg: "bg-rose-500/10" },
] as const;

const DIRECTIONS = [
  { key: "people_performance", label: "People", icon: Users, color: "text-blue-400", desc: "How well are people at this layer serving users below?" },
  { key: "system_infrastructure", label: "System", icon: Settings, color: "text-amber-400", desc: "How well is the system config supporting users?" },
  { key: "usage_optimization", label: "Usage", icon: TrendingUp, color: "text-emerald-400", desc: "How can users better leverage available tools?" },
] as const;

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/30",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
};

function ScoreGauge({ score, size = "lg" }: { score: number | null; size?: "sm" | "lg" }) {
  if (score === null) return (
    <div className={`flex items-center justify-center ${size === "lg" ? "w-20 h-20" : "w-12 h-12"} rounded-full bg-muted/30 border border-border/50`}>
      <span className="text-xs text-muted-foreground">N/A</span>
    </div>
  );
  const color = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : score >= 40 ? "text-orange-400" : "text-red-400";
  const borderColor = score >= 80 ? "border-emerald-400/40" : score >= 60 ? "border-amber-400/40" : score >= 40 ? "border-orange-400/40" : "border-red-400/40";
  const bgColor = score >= 80 ? "bg-emerald-500/10" : score >= 60 ? "bg-amber-500/10" : score >= 40 ? "bg-orange-500/10" : "bg-red-500/10";
  return (
    <div className={`flex items-center justify-center ${size === "lg" ? "w-20 h-20" : "w-12 h-12"} rounded-full ${bgColor} border-2 ${borderColor}`}>
      <span className={`${size === "lg" ? "text-xl" : "text-sm"} font-bold ${color}`}>{Math.round(score)}</span>
    </div>
  );
}

export default function ImprovementEngine() {
  const [selectedLayer, setSelectedLayer] = useState<string>("platform");
  const [selectedDirection, setSelectedDirection] = useState<string>("system_infrastructure");
  const [expandedAudit, setExpandedAudit] = useState<number | null>(null);

  // Queries
  const overviewQuery = trpc.improvementEngine.layerOverview.useQuery(undefined, { staleTime: 30000 });
  const auditsQuery = trpc.improvementEngine.listAudits.useQuery({
    layer: selectedLayer as any,
    direction: selectedDirection as any,
    limit: 10,
  }, { staleTime: 15000 });
  const pendingQuery = trpc.improvementEngine.listPendingActions.useQuery({
    layer: selectedLayer as any,
    direction: selectedDirection as any,
  }, { staleTime: 15000 });

  // Mutations
  const runAuditMut = trpc.improvementEngine.runAudit.useMutation({
    onSuccess: (data) => {
      toast.success(`Audit complete — Health Score: ${data.healthScore}/100`);
      overviewQuery.refetch();
      auditsQuery.refetch();
      pendingQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const runFullAuditMut = trpc.improvementEngine.runFullAudit.useMutation({
    onSuccess: (data) => {
      toast.success(`Full audit complete for ${data.layer} — ${data.results.length} directions analyzed`);
      overviewQuery.refetch();
      auditsQuery.refetch();
      pendingQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateActionMut = trpc.improvementEngine.updateAction.useMutation({
    onSuccess: () => {
      pendingQuery.refetch();
      toast.success("Action updated");
    },
  });

  const currentLayerData = (overviewQuery.data || []).find((l: any) => l.layer === selectedLayer);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-2"><Link href="/chat"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1"><ArrowLeft className="h-4 w-4" /> Back to Chat</Button></Link></div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-3 mb-2">
            <Activity className="w-7 h-7 text-accent" />
            AI Improvement Engine
          </h1>
          <p className="text-muted-foreground">
            Continuous 3-direction auditing across all 5 layers — People Performance, System Infrastructure, and Usage Optimization.
          </p>
        </div>

        {/* Layer Overview Cards */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Layer Health Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {LAYERS.map(layer => {
              const data = (overviewQuery.data || []).find((l: any) => l.layer === layer.key);
              const isSelected = selectedLayer === layer.key;
              return (
                <button
                  key={layer.key}
                  onClick={() => setSelectedLayer(layer.key)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? `${layer.bg} border-current ${layer.color}`
                      : "bg-card border-border/50 hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <layer.icon className={`w-4 h-4 ${layer.color}`} />
                    <span className="text-sm font-semibold">{layer.label}</span>
                  </div>
                  <ScoreGauge score={data?.compositeHealthScore || null} size="sm" />
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{data?.totalPendingActions || 0} pending</span>
                    <span>·</span>
                    <span>{data?.totalImplementedActions || 0} done</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Direction Tabs + Audit Controls */}
        <section className="mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex gap-2">
              {DIRECTIONS.map(dir => (
                <button
                  key={dir.key}
                  onClick={() => setSelectedDirection(dir.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedDirection === dir.key
                      ? `bg-accent/20 ${dir.color} font-semibold`
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <dir.icon className="w-4 h-4" />
                  {dir.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => runAuditMut.mutate({
                  layer: selectedLayer as any,
                  direction: selectedDirection as any,
                })}
                disabled={runAuditMut.isPending || runFullAuditMut.isPending}
              >
                {runAuditMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                Audit {DIRECTIONS.find(d => d.key === selectedDirection)?.label}
              </Button>
              <Button
                size="sm"
                onClick={() => runFullAuditMut.mutate({ layer: selectedLayer as any })}
                disabled={runAuditMut.isPending || runFullAuditMut.isPending}
              >
                {runFullAuditMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                Full Audit (All 3)
              </Button>
            </div>
          </div>

          {/* Direction Description */}
          <div className="p-3 rounded-lg bg-muted/20 border border-border/30 mb-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">
                {DIRECTIONS.find(d => d.key === selectedDirection)?.label}:
              </strong>{" "}
              {DIRECTIONS.find(d => d.key === selectedDirection)?.desc}
            </p>
          </div>

          {/* Direction Health Scores */}
          {currentLayerData && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              {DIRECTIONS.map(dir => {
                const dirData = currentLayerData.directions?.[dir.key];
                return (
                  <div key={dir.key} className={`p-4 rounded-xl border ${
                    selectedDirection === dir.key ? "border-accent/40 bg-accent/5" : "border-border/30 bg-card"
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <dir.icon className={`w-4 h-4 ${dir.color}`} />
                      <span className="text-xs font-semibold">{dir.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <ScoreGauge score={dirData?.healthScore || null} size="sm" />
                      <div className="text-[10px] text-muted-foreground">
                        <p>{dirData?.pendingActions || 0} pending actions</p>
                        {dirData?.lastAuditAt && (
                          <p>Last: {new Date(dirData.lastAuditAt).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Two-Column: Pending Actions + Audit History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Actions */}
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Pending Actions
            </h3>
            {pendingQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (pendingQuery.data || []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No pending actions. Run an audit to discover improvements.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(pendingQuery.data || []).map((action: any) => (
                  <div key={action.id} className="p-3 rounded-lg bg-card border border-border/50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{action.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{action.description}</p>
                      </div>
                      <Badge variant="outline" className={`text-[9px] shrink-0 ${SEVERITY_COLORS[action.priority] || ""}`}>
                        {action.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                      <Badge variant="secondary" className="text-[9px]">{action.category}</Badge>
                      <Badge variant="secondary" className="text-[9px]">{action.actionType?.replace("_", " ")}</Badge>
                      {action.estimatedImpact && (
                        <span className="text-accent">{action.estimatedImpact}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {action.actionType === "auto_implement" ? (
                        <Button size="sm" variant="default" className="text-xs h-7"
                          onClick={() => updateActionMut.mutate({ actionId: action.id, status: "approved" })}>
                          <Zap className="w-3 h-3 mr-1" /> Auto-Implement
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="text-xs h-7"
                          onClick={() => updateActionMut.mutate({ actionId: action.id, status: "approved" })}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Approve
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive"
                        onClick={() => updateActionMut.mutate({ actionId: action.id, status: "rejected", reason: "Manual review" })}>
                        <XCircle className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Audit History */}
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Audit History
            </h3>
            {auditsQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (auditsQuery.data || []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No audits yet. Run one to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(auditsQuery.data || []).map((audit: any) => (
                  <AuditHistoryItem
                    key={audit.id}
                    audit={audit}
                    expanded={expandedAudit === audit.id}
                    onToggle={() => setExpandedAudit(expandedAudit === audit.id ? null : audit.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function AuditHistoryItem({ audit, expanded, onToggle }: { audit: any; expanded: boolean; onToggle: () => void }) {
  let findings: any[] = [];
  let recommendations: any[] = [];
  try { findings = typeof audit.findings === "string" ? JSON.parse(audit.findings) : (audit.findings || []); } catch {}
  try { recommendations = typeof audit.recommendations === "string" ? JSON.parse(audit.recommendations) : (audit.recommendations || []); } catch {}

  const dirLabel = DIRECTIONS.find(d => d.key === audit.auditDirection)?.label || audit.auditDirection;

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <button onClick={onToggle} className="w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-muted/20 transition-colors">
        {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
        <ScoreGauge score={audit.overallHealthScore} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium capitalize">{audit.layer} — {dirLabel}</p>
          <p className="text-[10px] text-muted-foreground">
            {audit.completedAt ? new Date(audit.completedAt).toLocaleString() : "Running..."}
            {" · "}{findings.length} findings · {recommendations.length} recommendations
          </p>
        </div>
        <Badge variant={audit.status === "completed" ? "secondary" : "outline"} className="text-[9px]">
          {audit.status}
        </Badge>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border/30">
          {/* Findings */}
          {findings.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Findings</p>
              <div className="space-y-1.5">
                {findings.map((f: any, i: number) => (
                  <div key={i} className={`px-2 py-1.5 rounded text-[11px] border ${SEVERITY_COLORS[f.severity] || "bg-muted/20"}`}>
                    <span className="font-medium">[{f.severity?.toUpperCase()}]</span> {f.description}
                    {f.evidence && <p className="text-[10px] opacity-70 mt-0.5">Evidence: {f.evidence}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recommendations</p>
              <div className="space-y-1.5">
                {recommendations.map((r: any, i: number) => (
                  <div key={i} className="px-2 py-1.5 rounded bg-muted/20 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      {r.autoImplementable ? (
                        <Zap className="w-3 h-3 text-accent shrink-0" />
                      ) : (
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-medium">{r.title}</span>
                      <Badge variant="outline" className={`text-[8px] ml-auto ${SEVERITY_COLORS[r.priority] || ""}`}>{r.priority}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{r.description}</p>
                    {r.estimatedImpact && (
                      <p className="text-[10px] text-accent mt-0.5">Impact: {r.estimatedImpact}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
