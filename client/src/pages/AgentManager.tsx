/**
 * AgentManager — Comprehensive OpenClaw agent management with run detail views
 * CRUD, launch, stop, real-time progress, step-by-step trace, task templates.
 * Pass 55: Upgraded from 310-line CRUD to full agent management surface.
 */
import { useState, useMemo, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Bot, Play, Square, Trash2, Plus, Shield, Loader2, DollarSign,
  Clock, ChevronDown, ChevronUp, ChevronRight, AlertCircle, AlertTriangle,
  Wrench, Brain, CheckCircle2, Zap, Activity, Settings2, FileText,
  BarChart3, Eye, ArrowLeft, Sparkles, Target, Users, ClipboardList,
  RefreshCw, Timer, ShieldCheck, ShieldAlert, CircleDot, Layers,
} from "lucide-react";

// ─── Agent type definitions ────────────────────────────────────────────────
const AGENT_TYPES = [
  { value: "compliance_monitor", label: "Compliance Monitor", desc: "Reads compliance rules + communication archive, flags issues", icon: Shield },
  { value: "lead_processor", label: "Lead Processor", desc: "Enriches, scores, and qualifies leads automatically", icon: Target },
  { value: "report_generator", label: "Report Generator", desc: "Generates periodic performance reports", icon: BarChart3 },
  { value: "plan_analyzer", label: "Plan Analyzer", desc: "Analyzes business plans vs production actuals", icon: ClipboardList },
  { value: "custom", label: "Custom Agent", desc: "Define your own agent with custom instructions", icon: Sparkles },
];

// ─── Task templates for quick agent creation ───────────────────────────────
const TASK_TEMPLATES = [
  { name: "Monday Morning Client Review", type: "report_generator" as const, instructions: "Review all active clients, check for upcoming RMD events, birthday milestones, policy renewals, and market-sensitive positions. Generate a prioritized action list for the week.", icon: Users },
  { name: "Quarterly Review Prep", type: "report_generator" as const, instructions: "For each client in the book, pull latest portfolio performance, compare against benchmarks, identify rebalancing opportunities, and draft a 1-page review summary.", icon: FileText },
  { name: "Compliance Audit Sweep", type: "compliance_monitor" as const, instructions: "Scan all recent client communications, trade confirmations, and advisory recommendations for compliance issues. Flag any potential suitability concerns or documentation gaps.", icon: ShieldCheck },
  { name: "Lead Pipeline Analysis", type: "lead_processor" as const, instructions: "Review all leads in the pipeline, enrich with public data, score based on AUM potential and conversion likelihood, and recommend next-best-action for top 10 prospects.", icon: Target },
  { name: "Tax Planning Opportunities", type: "plan_analyzer" as const, instructions: "Analyze each client's tax situation for Roth conversion opportunities, tax-loss harvesting candidates, charitable giving strategies, and year-end planning actions.", icon: DollarSign },
];

// ─── Compliance tier labels ────────────────────────────────────────────────
const COMPLIANCE_TIERS: Record<number, { label: string; color: string; icon: typeof Shield }> = {
  1: { label: "Auto-Approve", color: "text-green-500", icon: CheckCircle2 },
  2: { label: "Log & Proceed", color: "text-blue-500", icon: Eye },
  3: { label: "Review Required", color: "text-amber-500", icon: ShieldAlert },
  4: { label: "Human Approval", color: "text-red-500", icon: Shield },
};

// ─── Parse step progress from actionType ───────────────────────────────────
function parseStepProgress(actionType: string): { step: number; total: number; tool?: string } | null {
  const match = actionType.match(/^step:(\d+)\/(\d+)(?::(.+))?$/);
  if (!match) return null;
  return { step: parseInt(match[1]), total: parseInt(match[2]), tool: match[3] };
}

// ─── Main component ───────────────────────────────────────────────────────
export default function AgentManager({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;

  const { isAuthenticated } = useAuth();
  const agents = trpc.openClaw.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const createMutation = trpc.openClaw.create.useMutation({ onSuccess: () => { agents.refetch(); toast.success("Agent created"); } });
  const launchMutation = trpc.openClaw.launch.useMutation({ onSuccess: () => { agents.refetch(); toast.success("Agent launched — watch the progress below"); } });
  const stopMutation = trpc.openClaw.stop.useMutation({ onSuccess: () => { agents.refetch(); toast.info("Agent stopped"); } });
  const deleteMutation = trpc.openClaw.delete.useMutation({ onSuccess: () => { agents.refetch(); toast.success("Agent deleted"); } });

  const [showCreate, setShowCreate] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("agents");
  const [form, setForm] = useState({ name: "", type: "compliance_monitor", instructions: "", maxBudgetPerRun: 0.5, complianceAware: true });

  const applyTemplate = useCallback((template: typeof TASK_TEMPLATES[0]) => {
    setForm({ name: template.name, type: template.type, instructions: template.instructions, maxBudgetPerRun: 0.5, complianceAware: true });
    setShowCreate(true);
  }, []);

  const handleCreate = useCallback(() => {
    createMutation.mutate({ ...form, type: form.type as any, description: "", dataSources: [], outputTargets: [] });
    setShowCreate(false);
    setForm({ name: "", type: "compliance_monitor", instructions: "", maxBudgetPerRun: 0.5, complianceAware: true });
  }, [form, createMutation]);

  // If viewing a specific run, show the detail view
  if (selectedRunId !== null && selectedAgent !== null) {
    return (
      <Shell title="Agent Run Detail">
        <SEOHead title="Agent Run Detail" description="View step-by-step agent execution trace" />
        <RunDetailView
          agentId={selectedAgent}
          runActionId={selectedRunId}
          onBack={() => setSelectedRunId(null)}
        />
      </Shell>
    );
  }

  // If viewing a specific agent, show the agent detail view
  if (selectedAgent !== null) {
    const agent = (agents.data || []).find((a: any) => a.id === selectedAgent);
    if (agent) {
      return (
        <Shell title={agent.config?.name || "Agent"}>
          <SEOHead title={agent.config?.name || "Agent"} description="Agent configuration and run history" />
          <AgentDetailView
            agent={agent}
            onBack={() => setSelectedAgent(null)}
            onLaunch={() => { launchMutation.mutate({ agentId: agent.id }); }}
            onStop={() => { stopMutation.mutate({ agentId: agent.id }); }}
            onDelete={() => { if (confirm("Delete this agent and all its run history?")) { deleteMutation.mutate({ agentId: agent.id }); setSelectedAgent(null); } }}
            onSelectRun={(runId: number) => setSelectedRunId(runId)}
            isLaunching={launchMutation.isPending}
          />
        </Shell>
      );
    }
  }

  return (
    <Shell title="Agents">
      <SEOHead title="AI Agents" description="Create, launch, and manage autonomous AI agents" />
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                AI Agents
              </h1>
              <p className="text-sm text-muted-foreground">Autonomous agents with ReAct reasoning, 43+ tools, and compliance gating</p>
            </div>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-3 w-3 mr-1" /> New Agent</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Agent</DialogTitle>
                  <DialogDescription>Configure an autonomous AI agent with custom instructions and compliance controls.</DialogDescription>
                </DialogHeader>
                <CreateAgentForm form={form} setForm={setForm} onCreate={handleCreate} isPending={createMutation.isPending} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="container py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="agents" className="gap-1"><Bot className="h-3 w-3" /> My Agents</TabsTrigger>
              <TabsTrigger value="templates" className="gap-1"><Sparkles className="h-3 w-3" /> Templates</TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1"><Activity className="h-3 w-3" /> Task Queue</TabsTrigger>
            </TabsList>

            <TabsContent value="agents">
              {agents.isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : agents.isError ? (
                <div className="text-center py-16 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-destructive opacity-60" />
                  <p className="text-lg font-medium">Failed to load agents</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => agents.refetch()}>Retry</Button>
                </div>
              ) : (agents.data || []).length === 0 ? (
                <EmptyAgentState onCreateClick={() => setShowCreate(true)} onTemplateClick={() => setActiveTab("templates")} />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {(agents.data || []).map((agent: any) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      onSelect={() => setSelectedAgent(agent.id)}
                      onLaunch={() => { launchMutation.mutate({ agentId: agent.id }); }}
                      onStop={() => { stopMutation.mutate({ agentId: agent.id }); }}
                      isLaunching={launchMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="templates">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {TASK_TEMPLATES.map((t, i) => (
                  <Card key={i} className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" role="button" tabIndex={0} onClick={() => applyTemplate(t)} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => applyTemplate(t))(); } }}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <t.icon className="h-4 w-4 text-primary" />
                        {t.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground line-clamp-3">{t.instructions}</p>
                      <Badge variant="outline" className="mt-2 text-[10px]">
                        {AGENT_TYPES.find(at => at.value === t.type)?.label}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="tasks">
              <TaskQueuePanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Shell>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────
function EmptyAgentState({ onCreateClick, onTemplateClick }: { onCreateClick: () => void; onTemplateClick: () => void }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <Bot className="h-16 w-16 mx-auto mb-4 opacity-30" />
      <p className="text-lg font-medium">No agents yet</p>
      <p className="text-sm mt-1 max-w-md mx-auto">Create your first AI agent to automate recurring advisory tasks. Agents use the ReAct reasoning loop with access to 43+ tools.</p>
      <div className="flex items-center justify-center gap-3 mt-6">
        <Button onClick={onCreateClick}><Plus className="h-4 w-4 mr-1" /> Create Agent</Button>
        <Button variant="outline" onClick={onTemplateClick}><Sparkles className="h-4 w-4 mr-1" /> Browse Templates</Button>
      </div>
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
        {[
          { icon: Brain, label: "ReAct Reasoning", desc: "Multi-step planning" },
          { icon: Wrench, label: "43+ Tools", desc: "Calculators, models, search" },
          { icon: Shield, label: "Compliance Gating", desc: "4-tier approval system" },
          { icon: Activity, label: "Live Progress", desc: "Real-time step tracking" },
        ].map((f, i) => (
          <div key={i} className="rounded-lg border border-border/50 p-3 text-center">
            <f.icon className="h-5 w-5 mx-auto mb-1.5 text-primary/70" />
            <p className="text-xs font-medium">{f.label}</p>
            <p className="text-[10px] text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Agent card ────────────────────────────────────────────────────────────
function AgentCard({ agent, onSelect, onLaunch, onStop, isLaunching }: {
  agent: any; onSelect: () => void; onLaunch: () => void; onStop: () => void; isLaunching: boolean;
}) {
  const typeInfo = AGENT_TYPES.find(t => t.value === agent.config?.type);
  const TypeIcon = typeInfo?.icon || Bot;
  return (
    <Card className={`group transition-all hover:ring-1 hover:ring-primary/20 ${agent.status === "active" ? "ring-1 ring-primary/30" : ""}`}>
      <CardHeader className="pb-2 cursor-pointer" role="button" tabIndex={0} onClick={onSelect} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (onSelect)(); } }}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            {agent.status === "active" && <Activity className="h-3 w-3 text-primary animate-pulse" />}
            <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
            {agent.config?.name || "Agent"}
          </CardTitle>
          <Badge variant={agent.status === "active" ? "default" : agent.status === "paused" ? "secondary" : "outline"} className="text-[10px]">
            {agent.status === "active" ? "Running" : agent.status}
          </Badge>
        </div>
        <CardDescription className="text-[11px] line-clamp-2">{typeInfo?.desc || agent.config?.type}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {agent.totalRuns} runs</span>
          <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> ${agent.totalCost?.toFixed(2) || "0.00"}</span>
          {agent.config?.complianceAware && <Shield className="h-3 w-3 text-green-400" title="Compliance aware" />}
        </div>
        <div className="flex gap-1.5">
          {agent.status !== "active" ? (
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" disabled={isLaunching} onClick={(e) => { e.stopPropagation(); onLaunch(); }}>
              {isLaunching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />} Launch
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={(e) => { e.stopPropagation(); onStop(); }}>
              <Square className="h-3 w-3 mr-1" /> Stop
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onSelect}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Create agent form ─────────────────────────────────────────────────────
function CreateAgentForm({ form, setForm, onCreate, isPending }: {
  form: any; setForm: (fn: (p: any) => any) => void; onCreate: () => void; isPending: boolean;
}) {
  return (
    <div className="space-y-3">
      <Input placeholder="Agent name" value={form.name} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} />
      <Select value={form.type} onValueChange={v => setForm((p: any) => ({ ...p, type: v }))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {AGENT_TYPES.map(t => (
            <SelectItem key={t.value} value={t.value}>
              <span className="flex items-center gap-2">
                <t.icon className="h-3 w-3" />
                <span className="font-medium">{t.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea placeholder="Agent instructions — what should this agent do?" value={form.instructions} onChange={e => setForm((p: any) => ({ ...p, instructions: e.target.value }))} rows={4} />
      <div className="flex items-center justify-between">
        <span className="text-sm">Budget per run</span>
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <Input type="number" min={0.01} max={10} step={0.1} value={form.maxBudgetPerRun} onChange={e => setForm((p: any) => ({ ...p, maxBudgetPerRun: parseFloat(e.target.value) || 0.5 }))} className="w-20 h-8 text-sm" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm">Compliance Aware</span>
          <p className="text-xs text-muted-foreground">Agent reads compliance rules and archives outputs</p>
        </div>
        <Switch checked={form.complianceAware} onCheckedChange={v => setForm((p: any) => ({ ...p, complianceAware: v }))} />
      </div>
      <Button className="w-full" disabled={!form.name || !form.instructions || isPending} onClick={onCreate}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Agent"}
      </Button>
    </div>
  );
}

// ─── Agent detail view ─────────────────────────────────────────────────────
function AgentDetailView({ agent, onBack, onLaunch, onStop, onDelete, onSelectRun, isLaunching }: {
  agent: any; onBack: () => void; onLaunch: () => void; onStop: () => void; onDelete: () => void;
  onSelectRun: (id: number) => void; isLaunching: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const isActive = agent.status === "active" || agent.instanceStatus === "active";
  const actions = trpc.openClaw.listActions.useQuery(
    { agentId: agent.id, limit: 50 },
    { enabled: isAuthenticated, retry: false, refetchInterval: isActive ? 2000 : 15000 },
  );
  const rows = actions.data ?? [];
  const typeInfo = AGENT_TYPES.find(t => t.value === agent.config?.type);

  // Separate step progress from completed actions
  const { activeSteps, completedRuns } = useMemo(() => {
    const steps: typeof rows = [];
    const completed: typeof rows = [];
    for (const r of rows) {
      if (parseStepProgress(r.actionType)) steps.push(r);
      else completed.push(r);
    }
    return { activeSteps: steps, completedRuns: completed };
  }, [rows]);

  const latestStep = activeSteps.length > 0 ? parseStepProgress(activeSteps[0].actionType) : null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold flex items-center gap-2">
                {agent.config?.name || "Agent"}
                <Badge variant={isActive ? "default" : "outline"} className="text-[10px]">
                  {isActive ? "Running" : agent.status || agent.instanceStatus}
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground">{typeInfo?.desc || agent.config?.type}</p>
            </div>
            <div className="flex gap-2">
              {!isActive ? (
                <Button size="sm" disabled={isLaunching} onClick={onLaunch}>
                  {isLaunching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />} Launch
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={onStop}>
                  <Square className="h-3 w-3 mr-1" /> Stop
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-500" onClick={onDelete}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 grid gap-6 lg:grid-cols-3">
        {/* Left: Config + Stats */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{typeInfo?.label || agent.config?.type}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Budget / run</span><span>${agent.config?.maxBudgetPerRun || "0.50"}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Compliance</span><span>{agent.config?.complianceAware ? "Enabled" : "Disabled"}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Total runs</span><span>{agent.totalRuns || 0}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Total cost</span><span>${agent.totalCost?.toFixed(2) || "0.00"}</span></div>
              <Separator />
              <div>
                <span className="text-muted-foreground">Instructions</span>
                <p className="mt-1 text-[11px] bg-muted/50 rounded p-2">{agent.config?.instructions || "—"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Capabilities */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Capabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {["ReAct Loop", "43+ Tools", "Financial Calcs", "Risk Models", "Search", "Wealth Engine", "Compliance Gate"].map(c => (
                  <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Live progress + Run history */}
        <div className="lg:col-span-2 space-y-4">
          {/* Active progress */}
          {isActive && latestStep && (
            <Card className="ring-1 ring-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-primary animate-pulse" /> Live Execution
                  {actions.isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Step {latestStep.step} of {latestStep.total}</span>
                    <span className="text-muted-foreground tabular-nums">{Math.round((latestStep.step / latestStep.total) * 100)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${(latestStep.step / latestStep.total) * 100}%` }} />
                  </div>
                  <div className="space-y-1 mt-3">
                    {activeSteps.slice(0, 10).reverse().map((s: any) => {
                      const sp = parseStepProgress(s.actionType);
                      return (
                        <div key={s.id} className="flex items-center gap-2 text-[11px] py-1 px-2 rounded bg-muted/30">
                          <CircleDot className={`h-3 w-3 shrink-0 ${s === activeSteps[0] ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                          <span className="text-muted-foreground tabular-nums w-12">Step {sp?.step}</span>
                          {sp?.tool && <Badge variant="outline" className="h-4 text-[9px] px-1.5 py-0">{sp.tool}</Badge>}
                          <span className="text-muted-foreground ml-auto tabular-nums">{s.durationMs != null ? `${(s.durationMs / 1000).toFixed(1)}s` : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Run history */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Run History
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => actions.refetch()}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {actions.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : completedRuns.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No completed runs yet. Click Launch to execute this agent.</p>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-2">
                    {completedRuns.map((r: any) => (
                      <div
                        key={r.id}
                        className="rounded-lg border border-border/50 p-3 hover:border-primary/30 cursor-pointer transition-colors" role="button" tabIndex={0} onClick={() => onSelectRun(r.id)} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => onSelectRun(r.id))(); } }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium flex items-center gap-1.5">
                            {r.error ? (
                              <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            )}
                            {r.actionType}
                          </span>
                          <div className="flex items-center gap-2">
                            {r.complianceTier && r.complianceTier > 1 && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1">
                                Tier {r.complianceTier}
                              </Badge>
                            )}
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                            </span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {new Date(r.createdAt).toLocaleString()}
                        </div>
                        {r.error && (
                          <div className="flex items-start gap-1 text-[10px] text-rose-500 mt-1">
                            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-1">{r.error}</span>
                          </div>
                        )}
                        {!r.error && r.dataModified && (
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{r.dataModified}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Run detail view (step-by-step trace) ──────────────────────────────────
function RunDetailView({ agentId, runActionId, onBack }: {
  agentId: number; runActionId: number; onBack: () => void;
}) {
  const { isAuthenticated } = useAuth();
  const actions = trpc.openClaw.listActions.useQuery(
    { agentId, limit: 100 },
    { enabled: isAuthenticated, retry: false },
  );
  const rows = actions.data ?? [];
  const targetAction = rows.find((r: any) => r.id === runActionId);

  // Get all step actions that belong to the same run (before this action)
  const runSteps = useMemo(() => {
    if (!targetAction) return [];
    const targetTime = targetAction.createdAt;
    // Get all step actions within 5 minutes before the target action
    return rows
      .filter((r: any) => {
        const sp = parseStepProgress(r.actionType);
        return sp && r.createdAt <= targetTime && r.createdAt >= targetTime - 300000;
      })
      .sort((a: any, b: any) => a.createdAt - b.createdAt);
  }, [rows, targetAction]);

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Run Detail</h1>
              <p className="text-xs text-muted-foreground">
                {targetAction ? `${targetAction.actionType} · ${new Date(targetAction.createdAt).toLocaleString()}` : "Loading..."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 grid gap-6 lg:grid-cols-3">
        {/* Left: Run summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Run Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {targetAction ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Action</span><span className="font-mono">{targetAction.actionType}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
                  <span className={targetAction.error ? "text-rose-500" : "text-green-500"}>
                    {targetAction.error ? "Failed" : "Success"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Duration</span>
                  <span>{targetAction.durationMs != null ? `${(targetAction.durationMs / 1000).toFixed(1)}s` : "—"}</span>
                </div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Compliance Tier</span>
                  <span className={COMPLIANCE_TIERS[targetAction.complianceTier || 1]?.color || ""}>
                    {COMPLIANCE_TIERS[targetAction.complianceTier || 1]?.label || `Tier ${targetAction.complianceTier}`}
                  </span>
                </div>
                {targetAction.gateTriggered && (
                  <>
                    <Separator />
                    <div className="flex justify-between"><span className="text-muted-foreground">Gate Result</span>
                      <Badge variant={targetAction.gateResult === "approved" ? "default" : "destructive"} className="text-[10px]">
                        {targetAction.gateResult}
                      </Badge>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Steps</span><span>{runSteps.length}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Time</span>
                  <span>{new Date(targetAction.createdAt).toLocaleString()}</span>
                </div>
                {targetAction.targetSystem && (
                  <>
                    <Separator />
                    <div className="flex justify-between"><span className="text-muted-foreground">Target</span><span>{targetAction.targetSystem}</span></div>
                  </>
                )}
              </>
            ) : (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            )}
          </CardContent>
        </Card>

        {/* Right: Step-by-step trace */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Execution Trace ({runSteps.length} steps)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {runSteps.length === 0 ? (
                <div className="text-center py-8">
                  <Timer className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                  <p className="text-xs text-muted-foreground">No step-level trace available for this run.</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Step traces are recorded for ReAct loop executions.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <div className="relative pl-6">
                    {/* Timeline line */}
                    <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
                    <div className="space-y-3">
                      {runSteps.map((step: any, i: number) => {
                        const sp = parseStepProgress(step.actionType);
                        const isLast = i === runSteps.length - 1;
                        return (
                          <div key={step.id} className="relative">
                            {/* Timeline dot */}
                            <div className={`absolute -left-6 top-1.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${
                              step.error ? "border-rose-500 bg-rose-500/10" :
                              isLast ? "border-primary bg-primary/10" :
                              "border-border bg-card"
                            }`}>
                              {sp?.tool ? (
                                <Wrench className={`h-2.5 w-2.5 ${step.error ? "text-rose-500" : "text-primary"}`} />
                              ) : (
                                <Zap className={`h-2.5 w-2.5 ${step.error ? "text-rose-500" : isLast ? "text-primary" : "text-muted-foreground"}`} />
                              )}
                            </div>
                            <div className="rounded-lg border border-border/50 p-3 ml-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium tabular-nums">Step {sp?.step || "?"}/{sp?.total || "?"}</span>
                                  {sp?.tool && (
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">{sp.tool}</Badge>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                  {step.durationMs != null ? `${(step.durationMs / 1000).toFixed(1)}s` : ""}
                                </span>
                              </div>
                              {step.dataAccessedSummary && (
                                <p className="text-[10px] text-muted-foreground mt-1.5">
                                  <span className="font-medium">Accessed:</span> {step.dataAccessedSummary}
                                </p>
                              )}
                              {step.dataModified && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  <span className="font-medium">Modified:</span> {step.dataModified}
                                </p>
                              )}
                              {step.error && (
                                <div className="flex items-start gap-1 text-[10px] text-rose-500 mt-1.5">
                                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span>{step.error}</span>
                                </div>
                              )}
                              {step.complianceTier && step.complianceTier > 1 && (
                                <div className="flex items-center gap-1 mt-1.5">
                                  <Badge variant="secondary" className={`text-[9px] h-4 ${COMPLIANCE_TIERS[step.complianceTier]?.color || ""}`}>
                                    {COMPLIANCE_TIERS[step.complianceTier]?.label || `Tier ${step.complianceTier}`}
                                  </Badge>
                                  {step.gateTriggered && (
                                    <Badge variant={step.gateResult === "approved" ? "default" : "destructive"} className="text-[9px] h-4">
                                      {step.gateResult}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </ScrollArea>
              )}

              {/* Result section */}
              {targetAction && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="text-xs font-medium mb-2 flex items-center gap-1.5">
                    {targetAction.error ? <AlertCircle className="h-3.5 w-3.5 text-rose-500" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                    Result
                  </h4>
                  {targetAction.error ? (
                    <div className="rounded-lg bg-rose-500/5 border border-rose-500/20 p-3 text-xs text-rose-500">
                      {targetAction.error}
                    </div>
                  ) : targetAction.dataModified ? (
                    <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                      {targetAction.dataModified}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Completed successfully.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Task Queue Panel ──────────────────────────────────────────────────────
function TaskQueuePanel() {
  const myTasks = trpc.agentic.taskQueue.myTasks.useQuery();
  const stats = trpc.agentic.taskQueue.stats.useQuery();
  const enqueueMut = trpc.agentic.taskQueue.enqueue.useMutation({
    onSuccess: () => { myTasks.refetch(); stats.refetch(); toast.success("Task enqueued"); },
    onError: (e: any) => toast.error(e.message),
  });
  const cancelMut = trpc.agentic.taskQueue.cancel.useMutation({
    onSuccess: () => { myTasks.refetch(); stats.refetch(); toast.success("Task cancelled"); },
  });

  const QUICK_TASKS = [
    { type: "data_analysis", label: "Data Analysis", icon: BarChart3, desc: "Analyze connected data sources" },
    { type: "report_generation", label: "Generate Report", icon: FileText, desc: "Create a comprehensive financial report" },
    { type: "crm_sync", label: "CRM Sync", icon: RefreshCw, desc: "Sync contacts with connected CRM" },
    { type: "portfolio_rebalance", label: "Portfolio Rebalance", icon: Target, desc: "Analyze and suggest rebalancing trades" },
  ];

  const statusColor = (s: string) => {
    switch (s) {
      case "completed": return "text-green-500";
      case "running": return "text-blue-500";
      case "failed": return "text-rose-500";
      case "cancelled": return "text-amber-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      {stats.data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Pending", value: stats.data.pending, color: "text-amber-500" },
            { label: "Running", value: stats.data.running, color: "text-blue-500" },
            { label: "Completed", value: stats.data.completed, color: "text-green-500" },
            { label: "Failed", value: stats.data.failed, color: "text-rose-500" },
            { label: "Concurrency", value: `${stats.data.globalConcurrency}/${stats.data.maxGlobalConcurrency}`, color: "text-muted-foreground" },
          ].map((s) => (
            <Card key={s.label} className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Quick task buttons */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Quick Tasks</CardTitle>
          <CardDescription className="text-xs">Launch common background tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {QUICK_TASKS.map((t) => (
              <Button
                key={t.type}
                variant="outline"
                className="h-auto py-3 flex-col gap-1.5"
                disabled={enqueueMut.isPending}
                onClick={() => enqueueMut.mutate({ type: t.type, payload: {} })}
              >
                <t.icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">{t.label}</span>
                <span className="text-[10px] text-muted-foreground">{t.desc}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Task list */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">My Tasks</CardTitle>
            <CardDescription className="text-xs">Background task history and progress</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => myTasks.refetch()}>
            <RefreshCw className={`h-3.5 w-3.5 ${myTasks.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {myTasks.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (myTasks.data || []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No tasks yet. Launch a quick task above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(myTasks.data || []).map((task: any) => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{task.type.replace(/_/g, " ")}</span>
                      <Badge variant="outline" className={`text-[10px] ${statusColor(task.status)}`}>
                        {task.status}
                      </Badge>
                      {task.priority !== "normal" && (
                        <Badge variant="secondary" className="text-[10px]">{task.priority}</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{task.progressMessage}</p>
                    {task.status === "running" && (
                      <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(task.createdAt).toLocaleTimeString()}
                    </span>
                    {(task.status === "pending" || task.status === "running") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => cancelMut.mutate({ taskId: task.id })}
                      >
                        <Square className="h-3 w-3 text-rose-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
