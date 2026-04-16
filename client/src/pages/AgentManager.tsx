/**
 * AgentManager — CRUD OpenClaw agent instances with real-time progress
 * Create, launch, stop, delete compliance-aware AI agents.
 * Shows step-by-step ReAct loop progress during execution.
 */
import { useState, useMemo } from "react";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Bot, Play, Square, Trash2, Plus, Shield, Loader2, DollarSign,
  Clock, ChevronDown, ChevronUp, AlertCircle, AlertTriangle,
  Wrench, Brain, CheckCircle2, Zap, Activity,
} from "lucide-react";

const AGENT_TYPES = [
  { value: "compliance_monitor", label: "Compliance Monitor", desc: "Reads compliance rules + communication archive, flags issues" },
  { value: "lead_processor", label: "Lead Processor", desc: "Enriches, scores, and qualifies leads automatically" },
  { value: "report_generator", label: "Report Generator", desc: "Generates periodic performance reports" },
  { value: "plan_analyzer", label: "Plan Analyzer", desc: "Analyzes business plans vs production actuals" },
  { value: "custom", label: "Custom Agent", desc: "Define your own agent with custom instructions" },
];

export default function AgentManager() {
  const { isAuthenticated } = useAuth();

  const agents = trpc.openClaw.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const createMutation = trpc.openClaw.create.useMutation({ onSuccess: () => { agents.refetch(); toast.success("Agent created"); } });
  const launchMutation = trpc.openClaw.launch.useMutation({ onSuccess: () => { agents.refetch(); toast.success("Agent launched — watch the progress below"); } });
  const stopMutation = trpc.openClaw.stop.useMutation({ onSuccess: () => { agents.refetch(); toast.info("Agent stopped"); } });
  const deleteMutation = trpc.openClaw.delete.useMutation({ onSuccess: () => { agents.refetch(); toast.success("Agent deleted"); } });

  const [showCreate, setShowCreate] = useState(false);
  const [expandedAgentId, setExpandedAgentId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", type: "compliance_monitor", instructions: "", maxBudgetPerRun: 0.5, complianceAware: true });

  return (
    <AppShell title="Agents">
      <SEOHead title="Agents" description="Configure and manage AI agents" />
      <div className="min-h-screen">
        <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                AI Agents
              </h1>
              <p className="text-sm text-muted-foreground">Create, launch, and manage autonomous AI agents with real-time progress</p>
            </div>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-3 w-3 mr-1" /> New Agent</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Create New Agent</DialogTitle><DialogDescription>Configure a new AI agent with custom instructions and capabilities.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Agent name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                  <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AGENT_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="font-medium">{t.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">{t.desc}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea placeholder="Agent instructions — what should this agent do?" value={form.instructions} onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))} rows={4} />
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Budget per run</span>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <Input type="number" min={0.01} max={10} step={0.1} value={form.maxBudgetPerRun} onChange={e => setForm(p => ({ ...p, maxBudgetPerRun: parseFloat(e.target.value) || 0.5 }))} className="w-20 h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm">Compliance Aware</span>
                      <p className="text-xs text-muted-foreground">Agent reads compliance rules and archives outputs</p>
                    </div>
                    <Switch checked={form.complianceAware} onCheckedChange={v => setForm(p => ({ ...p, complianceAware: v }))} />
                  </div>
                  <Button className="w-full" disabled={!form.name || !form.instructions || createMutation.isPending} onClick={() => {
                    createMutation.mutate({ ...form, type: form.type as any, description: "", dataSources: [], outputTargets: [] });
                    setShowCreate(false);
                    setForm({ name: "", type: "compliance_monitor", instructions: "", maxBudgetPerRun: 0.5, complianceAware: true });
                  }}>
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Agent"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="container py-6">
          {agents.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : agents.isError ? (
            <div className="text-center py-16 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-destructive opacity-60" />
              <p className="text-lg font-medium">Failed to load agents</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => agents.refetch()}>Retry</Button>
            </div>
          ) : (agents.data || []).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">No agents yet</p>
              <p className="text-sm mt-1">Create your first AI agent to automate recurring tasks.</p>
              <p className="text-xs mt-3 max-w-md mx-auto">Agents use the ReAct reasoning loop with access to 43+ tools including financial calculators, wealth engine simulations, risk models, and search.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(agents.data || []).map((agent: any) => (
                <Card key={agent.id} className={agent.status === "active" ? "ring-1 ring-primary/30" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                        {agent.status === "active" && <Activity className="h-3 w-3 text-primary animate-pulse" />}
                        {agent.config?.name || "Agent"}
                      </CardTitle>
                      <Badge variant={agent.status === "active" ? "default" : agent.status === "paused" ? "secondary" : "outline"}>
                        {agent.status === "active" ? "Running" : agent.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">{AGENT_TYPES.find(t => t.value === agent.config?.type)?.label || agent.config?.type || "custom"}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <Clock className="h-3 w-3" /> {agent.totalRuns} runs
                      <DollarSign className="h-3 w-3 ml-2" /> ${agent.totalCost?.toFixed(2) || "0.00"}
                      {agent.config?.complianceAware && <Shield className="h-3 w-3 ml-2 text-green-400" />}
                    </div>
                    <div className="flex gap-1">
                      {agent.status !== "active" ? (
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" disabled={launchMutation.isPending} onClick={() => { launchMutation.mutate({ agentId: agent.id }); setExpandedAgentId(agent.id); }}>
                          {launchMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />} Launch
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => stopMutation.mutate({ agentId: agent.id })}>
                          <Square className="h-3 w-3 mr-1" /> Stop
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setExpandedAgentId((cur) => (cur === agent.id ? null : agent.id))}
                        aria-label={expandedAgentId === agent.id ? "Hide recent runs" : "Show recent runs"}
                      >
                        {expandedAgentId === agent.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => { if (confirm("Delete this agent?")) deleteMutation.mutate({ agentId: agent.id }); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {expandedAgentId === agent.id && (
                      <AgentRecentRuns agentId={agent.id} isActive={agent.status === "active"} />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ─── Parse step progress from actionType ────────────────────────────────────
function parseStepProgress(actionType: string): { step: number; total: number; tool?: string } | null {
  const match = actionType.match(/^step:(\d+)\/(\d+)(?::(.+))?$/);
  if (!match) return null;
  return { step: parseInt(match[1]), total: parseInt(match[2]), tool: match[3] };
}

// ─── Recent runs panel with real-time progress ──────────────────────────────
function AgentRecentRuns({ agentId, isActive }: { agentId: number; isActive: boolean }) {
  const { isAuthenticated } = useAuth();
  const q = trpc.openClaw.listActions.useQuery(
    { agentId, limit: 20 },
    { enabled: isAuthenticated, retry: false, refetchInterval: isActive ? 2000 : 10000 },
  );
  const rows = q.data ?? [];

  // Group step entries into runs and separate final results
  const { activeSteps, completedRuns } = useMemo(() => {
    const steps: typeof rows = [];
    const completed: typeof rows = [];
    for (const r of rows) {
      if (parseStepProgress(r.actionType)) {
        steps.push(r);
      } else {
        completed.push(r);
      }
    }
    return { activeSteps: steps, completedRuns: completed };
  }, [rows]);

  // Find the latest step progress for the active run
  const latestStep = activeSteps.length > 0 ? parseStepProgress(activeSteps[0].actionType) : null;

  return (
    <div className="relative mt-3 border-t pt-3 space-y-2">
      {/* Warm gold radial glow */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {isActive ? "Live Progress" : "Recent Runs"}
        </p>
        {q.isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {/* Active progress bar */}
      {isActive && latestStep && (
        <div className="space-y-1.5 rounded-md border border-primary/20 bg-primary/5 p-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium flex items-center gap-1">
              <Brain className="h-3 w-3 text-primary animate-pulse" />
              Step {latestStep.step} of {latestStep.total}
            </span>
            <span className="text-muted-foreground">{Math.round((latestStep.step / latestStep.total) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(latestStep.step / latestStep.total) * 100}%` }}
            />
          </div>
          {/* Step timeline */}
          {activeSteps.length > 0 && (
            <div className="space-y-1 mt-2">
              {activeSteps.slice(0, 8).reverse().map((s: any, i: number) => {
                const sp = parseStepProgress(s.actionType);
                return (
                  <div key={s.id} className="flex items-center gap-1.5 text-[10px]">
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                      {sp?.tool ? <Wrench className="h-2.5 w-2.5 text-primary" /> : <Zap className="h-2.5 w-2.5 text-primary" />}
                    </div>
                    <span className="text-muted-foreground">Step {sp?.step}</span>
                    {sp?.tool && (
                      <Badge variant="outline" className="h-4 text-[9px] px-1 py-0">
                        {sp.tool}
                      </Badge>
                    )}
                    <span className="text-muted-foreground ml-auto tabular-nums">
                      {s.durationMs != null ? `${(s.durationMs / 1000).toFixed(1)}s` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Completed runs */}
      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No runs yet. Click Launch to execute this agent.
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-52 overflow-y-auto">
          {completedRuns.map((r: any) => (
            <li key={r.id} className="text-[11px] rounded border border-border/50 p-2 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] truncate flex items-center gap-1">
                  {r.error ? (
                    <AlertCircle className="h-3 w-3 text-rose-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                  )}
                  {r.actionType}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {new Date(r.createdAt).toLocaleString()}
              </div>
              {r.error ? (
                <div className="flex items-start gap-1 text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{r.error}</span>
                </div>
              ) : r.dataModified ? (
                <div className="text-muted-foreground line-clamp-3">
                  {r.dataModified}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
