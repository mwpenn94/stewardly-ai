import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Circle, Clock, Play, Pause,
  RotateCcw, FileText, ExternalLink, Shield, BookOpen, Briefcase,
  ChevronDown, ChevronUp, AlertTriangle, Loader2,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const WORKFLOW_TEMPLATES = [
  {
    id: "finra_registration",
    name: "FINRA Registration",
    description: "Complete Series 6/7/63/65/66 registration process",
    category: "licensing",
    steps: [
      { id: "prepare", label: "Prepare", desc: "Gather documents: SSN, fingerprints, U4 form, background check consent" },
      { id: "brief", label: "Brief", desc: "Review FINRA registration requirements and study materials" },
      { id: "navigate", label: "Navigate", desc: "Access FINRA Web CRD system and create account" },
      { id: "assist", label: "Assist", desc: "Complete Form U4 with employer sponsorship" },
      { id: "handoff", label: "Hand-off", desc: "Submit to broker-dealer compliance for review" },
      { id: "confirm", label: "Confirm", desc: "Receive confirmation number and track approval status" },
      { id: "return", label: "Return", desc: "Registration complete — update credentials in profile" },
    ],
  },
  {
    id: "state_insurance",
    name: "State Insurance License",
    description: "Apply for state insurance producer license",
    category: "licensing",
    steps: [
      { id: "prepare", label: "Prepare", desc: "Gather pre-licensing course certificate, exam results, background check" },
      { id: "brief", label: "Brief", desc: "Review state-specific requirements and reciprocity agreements" },
      { id: "navigate", label: "Navigate", desc: "Access state DOI portal and NIPR" },
      { id: "assist", label: "Assist", desc: "Complete application form with required documentation" },
      { id: "handoff", label: "Hand-off", desc: "Submit application and pay fees" },
      { id: "confirm", label: "Confirm", desc: "Receive NPN and license number" },
      { id: "return", label: "Return", desc: "License active — set renewal reminders" },
    ],
  },
  {
    id: "eo_insurance",
    name: "E&O Insurance",
    description: "Obtain Errors & Omissions professional liability coverage",
    category: "compliance",
    steps: [
      { id: "prepare", label: "Prepare", desc: "Gather business info, revenue, claims history, coverage needs" },
      { id: "brief", label: "Brief", desc: "Compare E&O providers and coverage limits" },
      { id: "navigate", label: "Navigate", desc: "Request quotes from top 3 providers" },
      { id: "assist", label: "Assist", desc: "Complete application with accurate practice details" },
      { id: "handoff", label: "Hand-off", desc: "Submit to underwriting for review" },
      { id: "confirm", label: "Confirm", desc: "Bind coverage and receive policy documents" },
      { id: "return", label: "Return", desc: "E&O active — file certificate with broker-dealer" },
    ],
  },
  {
    id: "client_onboarding",
    name: "Client Onboarding",
    description: "Complete new client onboarding and KYC process",
    category: "client",
    steps: [
      { id: "prepare", label: "Prepare", desc: "Send welcome packet and data collection forms" },
      { id: "brief", label: "Brief", desc: "Review client profile, goals, and risk tolerance" },
      { id: "navigate", label: "Navigate", desc: "Open accounts on custodian platform" },
      { id: "assist", label: "Assist", desc: "Complete suitability assessment and IPS" },
      { id: "handoff", label: "Hand-off", desc: "Submit to compliance for review" },
      { id: "confirm", label: "Confirm", desc: "Accounts funded and initial allocation set" },
      { id: "return", label: "Return", desc: "Onboarding complete — schedule first review meeting" },
    ],
  },
  {
    id: "annual_compliance",
    name: "Annual Compliance Review",
    description: "Complete annual compliance audit and CE requirements",
    category: "compliance",
    steps: [
      { id: "prepare", label: "Prepare", desc: "Gather CE transcripts, disclosure documents, and compliance checklist" },
      { id: "brief", label: "Brief", desc: "Review regulatory updates, new rules, and firm policy changes" },
      { id: "navigate", label: "Navigate", desc: "Access FINRA BrokerCheck, state DOI portals, and CE tracking systems" },
      { id: "assist", label: "Assist", desc: "Complete required CE hours and update ADV/CRS filings" },
      { id: "handoff", label: "Hand-off", desc: "Submit annual compliance questionnaire to CCO" },
      { id: "confirm", label: "Confirm", desc: "Receive compliance clearance and updated registration" },
      { id: "return", label: "Return", desc: "Compliance review complete — schedule next annual review" },
    ],
  },
];

const STEP_ICONS: Record<string, React.ReactNode> = {
  prepare: <FileText className="w-4 h-4" />,
  brief: <BookOpen className="w-4 h-4" />,
  navigate: <ExternalLink className="w-4 h-4" />,
  assist: <Briefcase className="w-4 h-4" />,
  handoff: <ArrowRight className="w-4 h-4" />,
  confirm: <Shield className="w-4 h-4" />,
  return: <CheckCircle2 className="w-4 h-4" />,
};

type WorkflowInstance = {
  /** Server-side row id once the instance has been persisted. Null when
   *  still unsynced (DB offline or first render before the first save). */
  id?: number | null;
  templateId: string;
  name: string;
  currentStep: number;
  stepStatuses: ("pending" | "in_progress" | "completed" | "skipped")[];
  confirmationNumbers: Record<string, string>;
  notes: Record<string, string>;
  startedAt: string;
};

export default function Workflows() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowInstance | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Persistence model (pass 61):
  //   1. Hydrate from localStorage for immediate render (works offline)
  //   2. Fetch `workflow.listInstances` from the DB — if the server has
  //      newer rows, they replace the local cache (DB is source of truth)
  //   3. Every edit fires `workflow.saveInstance` AND mirrors to
  //      localStorage, so a browser refresh sees the same state even
  //      if the server is momentarily unreachable
  //   4. If the DB is unavailable, saves become no-ops on the server
  //      side and the localStorage cache continues to work — the UI
  //      never loses data
  const [savedWorkflows, setSavedWorkflows] = useState<WorkflowInstance[]>(() => {
    const saved = localStorage.getItem("wb_workflows");
    return saved ? JSON.parse(saved) : [];
  });

  const instancesQ = trpc.workflow.listInstances.useQuery(undefined, {
    // Don't hammer the server — rely on mutations to refresh.
    refetchOnWindowFocus: true,
    retry: false,
  });
  const saveInstanceMut = trpc.workflow.saveInstance.useMutation();
  const deleteInstanceMut = trpc.workflow.deleteInstance.useMutation();

  // Reconcile the server snapshot into local state on first load.
  useEffect(() => {
    if (!instancesQ.data) return;
    if (instancesQ.data.length === 0) return;
    const reconciled: WorkflowInstance[] = instancesQ.data.map((row) => {
      const state = (row.state ?? {}) as Partial<WorkflowInstance>;
      return {
        id: row.id,
        templateId: row.templateId,
        name: row.templateName ?? state.name ?? row.templateId,
        currentStep: row.currentStep ?? state.currentStep ?? 0,
        stepStatuses: state.stepStatuses ?? [],
        confirmationNumbers: state.confirmationNumbers ?? {},
        notes: state.notes ?? {},
        startedAt: state.startedAt ?? new Date(row.startedAt).toISOString(),
      };
    });
    setSavedWorkflows(reconciled);
    localStorage.setItem("wb_workflows", JSON.stringify(reconciled));
  }, [instancesQ.data]);

  const saveWorkflows = (workflows: WorkflowInstance[]) => {
    setSavedWorkflows(workflows);
    localStorage.setItem("wb_workflows", JSON.stringify(workflows));
  };

  // Persist a single workflow to the server (fire-and-forget; the UI
  // already updated optimistically via saveWorkflows). On success we
  // patch the returned server id back into local state so subsequent
  // saves go through the update branch.
  const persistInstance = (instance: WorkflowInstance) => {
    const template = WORKFLOW_TEMPLATES.find(t => t.id === instance.templateId);
    const status: "in_progress" | "completed" | "abandoned" =
      instance.stepStatuses.every(s => s === "completed" || s === "skipped")
        ? "completed"
        : "in_progress";
    saveInstanceMut
      .mutateAsync({
        id: instance.id ?? undefined,
        templateId: instance.templateId,
        templateName: template?.name ?? instance.name,
        state: {
          name: instance.name,
          currentStep: instance.currentStep,
          stepStatuses: instance.stepStatuses,
          confirmationNumbers: instance.confirmationNumbers,
          notes: instance.notes,
          startedAt: instance.startedAt,
        },
        currentStep: instance.currentStep,
        status,
      })
      .then((res) => {
        if (res.id != null && instance.id == null) {
          // Patch the id back so the next update routes through the
          // existing row instead of creating a duplicate.
          setSavedWorkflows((cur) => {
            const updated = cur.map((w) =>
              w === instance || (w.templateId === instance.templateId && w.id == null)
                ? { ...w, id: res.id }
                : w,
            );
            localStorage.setItem("wb_workflows", JSON.stringify(updated));
            return updated;
          });
        }
      })
      .catch(() => {
        // DB offline — we already wrote to localStorage so the user's
        // data is safe for this session. Silent failure is correct
        // here; a toast on every keystroke would be noise.
      });
  };

  const startWorkflow = (template: typeof WORKFLOW_TEMPLATES[0]) => {
    const instance: WorkflowInstance = {
      id: null,
      templateId: template.id,
      name: template.name,
      currentStep: 0,
      stepStatuses: template.steps.map(() => "pending"),
      confirmationNumbers: {},
      notes: {},
      startedAt: new Date().toISOString(),
    };
    instance.stepStatuses[0] = "in_progress";
    const updated = [...savedWorkflows, instance];
    saveWorkflows(updated);
    setActiveWorkflow(instance);
    setExpandedStep(0);
    persistInstance(instance);
    toast.success(`Started: ${template.name}`);
  };

  const completeStep = (stepIndex: number) => {
    if (!activeWorkflow) return;
    const template = WORKFLOW_TEMPLATES.find(t => t.id === activeWorkflow.templateId);
    if (!template) return;

    const updated = { ...activeWorkflow };
    updated.stepStatuses = [...updated.stepStatuses];
    updated.stepStatuses[stepIndex] = "completed";

    if (confirmInput) {
      updated.confirmationNumbers = { ...updated.confirmationNumbers, [stepIndex]: confirmInput };
      setConfirmInput("");
    }
    if (noteInput) {
      updated.notes = { ...updated.notes, [stepIndex]: noteInput };
      setNoteInput("");
    }

    // Advance to next step
    if (stepIndex < template.steps.length - 1) {
      updated.currentStep = stepIndex + 1;
      updated.stepStatuses[stepIndex + 1] = "in_progress";
      setExpandedStep(stepIndex + 1);
    }

    setActiveWorkflow(updated);
    const allWorkflows = savedWorkflows.map(w =>
      w.templateId === updated.templateId && w.startedAt === updated.startedAt ? updated : w
    );
    saveWorkflows(allWorkflows);
    persistInstance(updated);

    if (stepIndex === template.steps.length - 1) {
      toast.success(`Workflow complete: ${template.name}`);
    } else {
      toast.success(`Step completed: ${template.steps[stepIndex].label}`);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(WORKFLOW_TEMPLATES.map(t => t.category));
    return ["all", ...Array.from(cats)];
  }, []);

  const filteredTemplates = categoryFilter === "all"
    ? WORKFLOW_TEMPLATES
    : WORKFLOW_TEMPLATES.filter(t => t.category === categoryFilter);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  const activeTemplate = activeWorkflow
    ? WORKFLOW_TEMPLATES.find(t => t.id === activeWorkflow.templateId)
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => activeWorkflow ? setActiveWorkflow(null) : navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">{activeWorkflow ? "All Workflows" : "Chat"}</span>
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-accent" />
            <h1 className="text-sm font-semibold">
              {activeWorkflow ? activeTemplate?.name : "Workflow Orchestration"}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {activeWorkflow && activeTemplate ? (
          /* ─── ACTIVE WORKFLOW VIEW ─── */
          <div className="space-y-6">
            {/* Step Tracker */}
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {activeTemplate.steps.map((step, i) => {
                const status = activeWorkflow.stepStatuses[i];
                return (
                  <div key={step.id} className="flex items-center">
                    <button
                      onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        status === "completed"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : status === "in_progress"
                          ? "bg-accent/15 text-accent border border-accent/30"
                          : "bg-secondary/50 text-muted-foreground border border-border/30"
                      }`}
                    >
                      {status === "completed" ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : status === "in_progress" ? (
                        <Play className="w-3.5 h-3.5" />
                      ) : (
                        <Circle className="w-3.5 h-3.5" />
                      )}
                      {step.label}
                    </button>
                    {i < activeTemplate.steps.length - 1 && (
                      <ArrowRight className={`w-3 h-3 mx-1 shrink-0 ${
                        status === "completed" ? "text-emerald-400" : "text-muted-foreground/30"
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="bg-card/50">
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold font-mono tabular-nums text-accent">
                    {activeWorkflow.stepStatuses.filter(s => s === "completed").length}/{activeTemplate.steps.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Steps Done</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50">
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold font-mono tabular-nums text-foreground">
                    {activeTemplate.steps[activeWorkflow.currentStep]?.label || "Done"}
                  </p>
                  <p className="text-xs text-muted-foreground">Current Step</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50">
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold font-mono tabular-nums text-muted-foreground">
                    {Object.keys(activeWorkflow.confirmationNumbers).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Confirmations</p>
                </CardContent>
              </Card>
            </div>

            {/* Step Details */}
            <div className="space-y-3">
              {activeTemplate.steps.map((step, i) => {
                const status = activeWorkflow.stepStatuses[i];
                const isExpanded = expandedStep === i;
                return (
                  <Card
                    key={step.id}
                    className={`transition-all ${
                      status === "in_progress" ? "border-accent/40 bg-accent/5" :
                      status === "completed" ? "border-emerald-500/30 bg-emerald-500/5" :
                      "border-border/30 bg-card/30"
                    }`}
                  >
                    <button
                      className="w-full flex items-center gap-3 p-4"
                      onClick={() => setExpandedStep(isExpanded ? null : i)}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                        status === "in_progress" ? "bg-accent/20 text-accent" :
                        "bg-secondary text-muted-foreground"
                      }`}>
                        {STEP_ICONS[step.id] || <Circle className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{step.label}</span>
                          <Badge variant={status === "completed" ? "default" : status === "in_progress" ? "secondary" : "outline"} className="text-[9px]">
                            {status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{step.desc}</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {isExpanded && (
                      <CardContent className="pt-0 pb-4 px-4 space-y-3">
                        <Separator />
                        <p className="text-sm text-muted-foreground">{step.desc}</p>

                        {activeWorkflow.confirmationNumbers[i] && (
                          <div className="flex items-center gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                            <Shield className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs text-emerald-300">Confirmation: {activeWorkflow.confirmationNumbers[i]}</span>
                          </div>
                        )}
                        {activeWorkflow.notes[i] && (
                          <div className="p-2 rounded bg-secondary/50 border border-border/30">
                            <p className="text-xs text-muted-foreground">{activeWorkflow.notes[i]}</p>
                          </div>
                        )}

                        {status === "in_progress" && (
                          <div className="space-y-3 pt-2">
                            <div>
                              <Label className="text-xs mb-1 block">Confirmation Number (optional)</Label>
                              <Input
                                value={confirmInput}
                                onChange={e => setConfirmInput(e.target.value)}
                                placeholder="e.g., CRD-2026-12345"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">Notes (optional)</Label>
                              <Textarea
                                value={noteInput}
                                onChange={e => setNoteInput(e.target.value)}
                                placeholder="Any notes for this step..."
                                className="text-sm min-h-[60px]"
                              />
                            </div>
                            <Button size="sm" onClick={() => completeStep(i)} className="gap-1.5">
                              <CheckCircle2 className="w-4 h-4" /> Complete Step
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          /* ─── WORKFLOW TEMPLATES LIST ─── */
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-heading font-bold mb-1">Workflow Orchestration</h2>
              <p className="text-sm text-muted-foreground">
                Guided 7-step workflows for licensing, compliance, and client processes.
              </p>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                    categoryFilter === cat
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* In-Progress Workflows */}
            {savedWorkflows.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" /> In Progress
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {savedWorkflows.map((wf, idx) => {
                    const template = WORKFLOW_TEMPLATES.find(t => t.id === wf.templateId);
                    if (!template) return null;
                    const completed = wf.stepStatuses.filter(s => s === "completed").length;
                    const pct = Math.round((completed / template.steps.length) * 100);
                    return (
                      <Card key={idx} className="bg-card/50 hover:border-accent/30 transition-colors cursor-pointer" onClick={() => { setActiveWorkflow(wf); setExpandedStep(wf.currentStep); }}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold">{template.name}</h4>
                            <Badge variant="secondary" className="text-[10px]">{pct}%</Badge>
                          </div>
                          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Step {wf.currentStep + 1}: {template.steps[wf.currentStep]?.label}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available Templates */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Available Workflows</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTemplates.map(template => (
                  <Card key={template.id} className="bg-card/50 border-border/50 hover:border-accent/30 transition-colors">
                    <CardContent className="pt-5">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="text-sm font-semibold">{template.name}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] capitalize shrink-0">{template.category}</Badge>
                      </div>
                      <div className="flex items-center gap-1 mt-3 mb-3">
                        {template.steps.map((s, i) => (
                          <div key={s.id} className="flex items-center">
                            <div className="w-5 h-5 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground">
                              <span className="text-[8px] font-mono">{i + 1}</span>
                            </div>
                            {i < template.steps.length - 1 && <div className="w-3 h-px bg-border/50" />}
                          </div>
                        ))}
                      </div>
                      <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => startWorkflow(template)}>
                        <Play className="w-3.5 h-3.5" /> Start Workflow
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
