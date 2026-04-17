/**
 * OutreachAutomation — Visual outreach workflow automation builder.
 * Phase 5 Command Center — campaign lifecycle automation.
 * Allows creating multi-step outreach sequences (email, SMS, call, wait, condition, task).
 */
import { useState, useMemo } from "react";
import { Plus, Play, Pause, Trash2, Copy, Search, MoreHorizontal, Zap, Clock, Users, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEOHead } from "@/components/SEOHead";
import AppShell from "@/components/AppShell";
import OutreachWorkflowBuilder, { type OutreachWorkflow, type WorkflowStep } from "@/components/OutreachWorkflowBuilder";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TRIGGER_OPTIONS = [
  { value: "new_lead", label: "New Lead Created" },
  { value: "form_submit", label: "Form Submission" },
  { value: "tag_added", label: "Tag Added" },
  { value: "stage_change", label: "Pipeline Stage Change" },
  { value: "no_activity", label: "No Activity (X days)" },
  { value: "appointment_booked", label: "Appointment Booked" },
  { value: "manual", label: "Manual Enrollment" },
];

const INITIAL_WORKFLOWS: OutreachWorkflow[] = [
  {
    id: "ow-1",
    name: "New Lead Nurture Sequence",
    trigger: "new_lead",
    status: "active",
    steps: [
      { id: "s1", type: "email", config: { template: "Welcome & Introduction" } },
      { id: "s2", type: "wait", config: { delayDays: 2 } },
      { id: "s3", type: "email", config: { template: "Value Proposition & Case Study" } },
      { id: "s4", type: "wait", config: { delayDays: 3 } },
      { id: "s5", type: "condition", config: { condition: "opened_email_2 = true" } },
      { id: "s6", type: "call", config: { duration: 15 } },
      { id: "s7", type: "task", config: { description: "Send personalized follow-up" } },
    ],
    enrolledCount: 142,
    completedCount: 87,
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: "ow-2",
    name: "Client Review Reminder",
    trigger: "no_activity",
    status: "active",
    steps: [
      { id: "s1", type: "email", config: { template: "Annual Review Reminder" } },
      { id: "s2", type: "wait", config: { delayDays: 5 } },
      { id: "s3", type: "sms", config: { message: "Hi {{name}}, just checking in — would you like to schedule your annual review?" } },
      { id: "s4", type: "wait", config: { delayDays: 3 } },
      { id: "s5", type: "call", config: { duration: 30 } },
    ],
    enrolledCount: 56,
    completedCount: 34,
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: "ow-3",
    name: "Referral Partner Outreach",
    trigger: "manual",
    status: "paused",
    steps: [
      { id: "s1", type: "email", config: { template: "Partnership Introduction" } },
      { id: "s2", type: "wait", config: { delayDays: 4 } },
      { id: "s3", type: "email", config: { template: "Partnership Benefits & Case Studies" } },
      { id: "s4", type: "wait", config: { delayDays: 7 } },
      { id: "s5", type: "call", config: { duration: 20 } },
    ],
    enrolledCount: 23,
    completedCount: 8,
    createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
  },
];

const statusConfig: Record<OutreachWorkflow["status"], { label: string; color: string; icon: any }> = {
  active: { label: "Active", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
  paused: { label: "Paused", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Pause },
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: AlertTriangle },
};

export default function OutreachAutomation({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;

  const [workflows, setWorkflows] = useState<OutreachWorkflow[]>(INITIAL_WORKFLOWS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OutreachWorkflow | null>(null);
  const [formName, setFormName] = useState("");
  const [formTrigger, setFormTrigger] = useState("new_lead");
  const [formSteps, setFormSteps] = useState<WorkflowStep[]>([]);

  const filtered = useMemo(() => {
    return workflows.filter((w) => {
      const matchesSearch = search === "" || w.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || w.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [workflows, search, statusFilter]);

  const stats = useMemo(() => ({
    total: workflows.length,
    active: workflows.filter((w) => w.status === "active").length,
    enrolled: workflows.reduce((sum, w) => sum + w.enrolledCount, 0),
    completed: workflows.reduce((sum, w) => sum + w.completedCount, 0),
  }), [workflows]);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormTrigger("new_lead");
    setFormSteps([]);
    setFormOpen(true);
  };

  const openEdit = (wf: OutreachWorkflow) => {
    setEditing(wf);
    setFormName(wf.name);
    setFormTrigger(wf.trigger);
    setFormSteps([...wf.steps]);
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) { toast.error("Please enter a workflow name"); return; }
    if (formSteps.length === 0) { toast.error("Please add at least one step"); return; }

    if (editing) {
      setWorkflows((prev) => prev.map((w) => w.id === editing.id ? { ...w, name: formName, trigger: formTrigger, steps: formSteps } : w));
      toast.success(`Workflow "${formName}" updated`);
    } else {
      const newWf: OutreachWorkflow = {
        id: `ow-${Date.now()}`,
        name: formName,
        trigger: formTrigger,
        status: "draft",
        steps: formSteps,
        enrolledCount: 0,
        completedCount: 0,
        createdAt: new Date().toISOString(),
      };
      setWorkflows((prev) => [...prev, newWf]);
      toast.success(`Workflow "${formName}" created`);
    }
    setFormOpen(false);
  };

  const toggleStatus = (id: string) => {
    setWorkflows((prev) => prev.map((w) => {
      if (w.id !== id) return w;
      const newStatus = w.status === "active" ? "paused" : "active";
      return { ...w, status: newStatus };
    }));
  };

  const duplicateWorkflow = (wf: OutreachWorkflow) => {
    const dup: OutreachWorkflow = {
      ...wf,
      id: `ow-${Date.now()}`,
      name: `${wf.name} (Copy)`,
      status: "draft",
      enrolledCount: 0,
      completedCount: 0,
      createdAt: new Date().toISOString(),
      steps: wf.steps.map((s) => ({ ...s, id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
    };
    setWorkflows((prev) => [...prev, dup]);
    toast.success("Workflow duplicated");
  };

  const deleteWorkflow = (id: string) => {
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    toast.success("Workflow deleted");
  };

  return (
    <Shell>
      <SEOHead title="Outreach Automation" description="Visual workflow automation for marketing sequences" />
      <div className="container max-w-6xl py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Outreach Automation</h1>
            <p className="text-sm text-muted-foreground mt-1">Build multi-step outreach sequences with email, SMS, calls, and conditions</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> New Workflow
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="text-center">
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Workflows</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-green-400">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-foreground">{stats.enrolled}</p>
              <p className="text-xs text-muted-foreground">Total Enrolled</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-primary">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search workflows..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2">
            {["all", "active", "paused", "draft"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="capitalize"
              >
                {status === "all" ? "All" : status}
              </Button>
            ))}
          </div>
        </div>

        {/* Workflow Cards */}
        <div className="space-y-3">
          {filtered.map((wf) => {
            const statusCfg = statusConfig[wf.status];
            const StatusIcon = statusCfg.icon;
            const triggerLabel = TRIGGER_OPTIONS.find((t) => t.value === wf.trigger)?.label ?? wf.trigger;

            return (
              <Card key={wf.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => openEdit(wf)}>
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                        <Zap className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-foreground">{wf.name}</h3>
                          <Badge variant="outline" className={cn("text-[10px]", statusCfg.color)}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusCfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {triggerLabel}</span>
                          <span>{wf.steps.length} steps</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-foreground">{wf.enrolledCount} enrolled</p>
                        <p className="text-xs text-muted-foreground">{wf.completedCount} completed</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); toggleStatus(wf.id); }}
                          aria-label={wf.status === "active" ? "Pause workflow" : "Activate workflow"}
                        >
                          {wf.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); duplicateWorkflow(wf); }}
                          aria-label="Duplicate workflow"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteWorkflow(wf.id); }}
                          aria-label="Delete workflow"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{search || statusFilter !== "all" ? "No workflows match your filters" : "No outreach workflows yet"}</p>
              <Button className="mt-4" onClick={openCreate}>Create Your First Workflow</Button>
            </CardContent>
          </Card>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={formOpen} onOpenChange={(open) => { if (!open) setFormOpen(false); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Workflow" : "New Outreach Workflow"}</DialogTitle>
              <DialogDescription>Build a multi-step outreach sequence with email, SMS, calls, and conditions.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="oa-name">Workflow Name</Label>
                  <Input id="oa-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. New Lead Nurture Sequence" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="oa-trigger">Trigger</Label>
                  <Select value={formTrigger} onValueChange={setFormTrigger}>
                    <SelectTrigger id="oa-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Workflow Steps</Label>
                <OutreachWorkflowBuilder steps={formSteps} onChange={setFormSteps} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editing ? "Update" : "Create"} Workflow</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Shell>
  );
}
