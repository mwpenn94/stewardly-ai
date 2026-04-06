/**
 * AgentManager — CRUD OpenClaw agent instances
 * Create, launch, stop, delete compliance-aware AI agents
 */
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Bot, Play, Square, Trash2, Plus, Shield, Loader2, DollarSign, Clock } from "lucide-react";

const AGENT_TYPES = [
  { value: "compliance_monitor", label: "Compliance Monitor", desc: "Reads compliance rules + communication archive, flags issues" },
  { value: "lead_processor", label: "Lead Processor", desc: "Enriches, scores, and qualifies leads automatically" },
  { value: "report_generator", label: "Report Generator", desc: "Generates periodic performance reports" },
  { value: "plan_analyzer", label: "Plan Analyzer", desc: "Analyzes business plans vs production actuals" },
  { value: "custom", label: "Custom Agent", desc: "Define your own agent with custom instructions" },
];

export default function AgentManager() {
  const agents = trpc.openClaw.list.useQuery(undefined, { retry: false });
  const createMutation = trpc.openClaw.create.useMutation({ onSuccess: () => { agents.refetch(); toast.success("Agent created"); } });
  const launchMutation = trpc.openClaw.launch.useMutation({ onSuccess: () => { agents.refetch(); toast.success("Agent launched"); } });
  const stopMutation = trpc.openClaw.stop.useMutation({ onSuccess: () => { agents.refetch(); toast.info("Agent stopped"); } });
  const deleteMutation = trpc.openClaw.delete.useMutation({ onSuccess: () => { agents.refetch(); toast.success("Agent deleted"); } });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", type: "compliance_monitor", instructions: "", maxBudgetPerRun: 0.5, complianceAware: true });

  return (
    <AppShell title="Agents">
      <div className="min-h-screen">
        <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">AI Agents</h1>
              <p className="text-sm text-muted-foreground">Create, launch, and manage autonomous AI agents</p>
            </div>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-3 w-3 mr-1" /> New Agent</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Create New Agent</DialogTitle></DialogHeader>
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
          ) : (agents.data || []).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">No agents yet</p>
              <p className="text-sm mt-1">Create your first AI agent to automate recurring tasks.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(agents.data || []).map((agent: any) => (
                <Card key={agent.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{agent.config?.name || "Agent"}</CardTitle>
                      <Badge variant={agent.status === "active" ? "default" : agent.status === "paused" ? "secondary" : "outline"}>
                        {agent.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">{agent.config?.type || "custom"}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <Clock className="h-3 w-3" /> {agent.totalRuns} runs
                      <DollarSign className="h-3 w-3 ml-2" /> ${agent.totalCost?.toFixed(2) || "0.00"}
                      {agent.config?.complianceAware && <Shield className="h-3 w-3 ml-2 text-green-400" />}
                    </div>
                    <div className="flex gap-1">
                      {agent.status !== "active" ? (
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => launchMutation.mutate({ agentId: agent.id })}>
                          <Play className="h-3 w-3 mr-1" /> Launch
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => stopMutation.mutate({ agentId: agent.id })}>
                          <Square className="h-3 w-3 mr-1" /> Stop
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => { if (confirm("Delete this agent?")) deleteMutation.mutate({ agentId: agent.id }); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
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
