import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  Shield, Clock, CheckCircle, XCircle, AlertTriangle, FileText,
  Bot, Play, Pause, DollarSign, Users, Building2, Briefcase,
  Scale, Heart, Home, FileCheck, TrendingUp, Search,
  RefreshCw, ChevronRight, Eye, Download, Send, Plus, ArrowLeft
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════
   G8. Licensed Review Gate — /licensed-review
   ═══════════════════════════════════════════════════════════════════════ */
export function LicensedReview() {
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  // Backend: gateRouter.list({ status?, limit })
  const reviews = trpc.agentic.gate.list.useQuery(
    { status: filter === "all" ? undefined : filter, limit: 50 },
    { refetchInterval: 15000 }
  );
  // Backend: gateRouter.review({ gateReviewId, decision, complianceNotes?, ... })
  const decide = trpc.agentic.gate.review.useMutation({
    onSuccess: () => { reviews.refetch(); toast.success("Decision recorded"); },
    onError: (e: any) => toast.error(e.message),
  });

  const tierColors: Record<string, string> = {
    "1": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    "2": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "3": "bg-amber-500/10 text-amber-400 border-amber-500/20",
    "4": "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock className="h-4 w-4 text-amber-400" />,
    approved: <CheckCircle className="h-4 w-4 text-emerald-400" />,
    rejected: <XCircle className="h-4 w-4 text-red-400" />,
    escalated: <AlertTriangle className="h-4 w-4 text-orange-400" />,
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-2"><Link href="/chat"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1"><ArrowLeft className="h-4 w-4" /> Back to Chat</Button></Link></div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-7 w-7 text-amber-400" /> Licensed Review Gate
            </h1>
            <p className="text-muted-foreground mt-1">Compliance gate for Tier 3-4 actions requiring licensed professional approval</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => reviews.refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Pending", val: reviews.data?.filter((r: any) => r.decision === "pending").length ?? 0, color: "text-amber-400", icon: Clock },
            { label: "Approved", val: reviews.data?.filter((r: any) => r.decision === "approved").length ?? 0, color: "text-emerald-400", icon: CheckCircle },
            { label: "Rejected", val: reviews.data?.filter((r: any) => r.decision === "rejected").length ?? 0, color: "text-red-400", icon: XCircle },
            { label: "Escalated", val: reviews.data?.filter((r: any) => r.decision === "escalated").length ?? 0, color: "text-orange-400", icon: AlertTriangle },
          ].map((s) => (
            <Card key={s.label} className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div><p className="text-2xl font-bold font-mono tabular-nums text-foreground">{s.val}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">{f}</Button>
          ))}
        </div>

        <div className="space-y-3">
          {reviews.isLoading && <div className="text-center py-12 text-muted-foreground">Loading reviews...</div>}
          {!reviews.isLoading && (!reviews.data || reviews.data.length === 0) && (
            <Card className="bg-card/30 border-dashed"><CardContent className="p-12 text-center text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No reviews matching this filter</p>
            </CardContent></Card>
          )}
          {reviews.data?.map((review: any) => (
            <Card key={review.id} className="bg-card/50 border-border/50 hover:border-border transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {statusIcons[review.decision] || statusIcons.pending}
                      <span className="font-medium text-foreground truncate">{review.actionType}</span>
                      <Badge variant="outline" className={tierColors[String(review.complianceTier)] || ""}>Tier {review.complianceTier}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{review.classificationRationale || "No description"}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span>ID: {String(review.id)}</span>
                      {review.createdAt && <span>Created: {new Date(review.createdAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  {review.decision === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        onClick={() => decide.mutate({ gateReviewId: review.id, decision: "approved", complianceNotes: "Approved via dashboard" })}
                        disabled={decide.isPending}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                        onClick={() => decide.mutate({ gateReviewId: review.id, decision: "rejected", complianceNotes: "Rejected via dashboard" })}
                        disabled={decide.isPending}>
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   G1. Agent Operations — /agent-operations
   ═══════════════════════════════════════════════════════════════════════ */
export function AgentOperations() {
  // Backend: agentRouter.list({ limit })
  const agents = trpc.agentic.agent.list.useQuery({ limit: 50 }, { refetchInterval: 10000 });
  // Backend: agentRouter.spawn({ workflowType, deploymentMode, runtimeLimitMinutes, ... })
  const spawn = trpc.agentic.agent.spawn.useMutation({
    onSuccess: () => { agents.refetch(); toast.success("Agent spawned"); },
    onError: (e: any) => toast.error(e.message),
  });

  const statusColors: Record<string, string> = {
    running: "bg-emerald-500/10 text-emerald-400", idle: "bg-blue-500/10 text-blue-400",
    paused: "bg-amber-500/10 text-amber-400", terminated: "bg-zinc-500/10 text-zinc-400",
    error: "bg-red-500/10 text-red-400",
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-2"><Link href="/chat"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1"><ArrowLeft className="h-4 w-4" /> Back to Chat</Button></Link></div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bot className="h-7 w-7 text-violet-400" /> Agent Operations Center
            </h1>
            <p className="text-muted-foreground mt-1">Monitor and manage autonomous agent instances</p>
          </div>
          <Button onClick={() => spawn.mutate({ workflowType: "general_research", deploymentMode: "local", runtimeLimitMinutes: 60 })} disabled={spawn.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Spawn Agent
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active", val: agents.data?.filter((a: any) => a.status === "running").length ?? 0, icon: Play, color: "text-emerald-400" },
            { label: "Idle", val: agents.data?.filter((a: any) => a.status === "idle").length ?? 0, icon: Pause, color: "text-blue-400" },
            { label: "Total", val: agents.data?.length ?? 0, icon: Bot, color: "text-violet-400" },
            { label: "Terminated", val: agents.data?.filter((a: any) => a.status === "terminated").length ?? 0, icon: XCircle, color: "text-zinc-400" },
          ].map((s) => (
            <Card key={s.label} className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div><p className="text-2xl font-bold font-mono tabular-nums text-foreground">{s.val}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          {agents.isLoading && <div className="text-center py-12 text-muted-foreground">Loading agents...</div>}
          {!agents.isLoading && (!agents.data || agents.data.length === 0) && (
            <Card className="bg-card/30 border-dashed"><CardContent className="p-12 text-center text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No agent instances. Spawn one to get started.</p>
            </CardContent></Card>
          )}
          {agents.data?.map((agent: any) => (
            <Card key={agent.id} className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-violet-400" />
                  <div>
                    <p className="font-medium text-foreground">{agent.workflowType?.replace(/_/g, " ")} Agent</p>
                    <p className="text-xs text-muted-foreground">ID: {String(agent.id)} | Mode: {agent.deploymentMode}</p>
                  </div>
                </div>
                <Badge className={statusColors[agent.status] || statusColors.idle}>{agent.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   G2. Insurance Quotes — /insurance-quotes
   ═══════════════════════════════════════════════════════════════════════ */
export function InsuranceQuotes() {
  // Backend: quoteRouter.listByClient({ clientId, limit })
  const quotes = trpc.agentic.quote.listByClient.useQuery({ clientId: 0 });
  // Backend: quoteRouter.generateQuotes({ clientId, lineOfBusiness, coverageAmount, term })
  const gather = trpc.agentic.quote.generateQuotes.useMutation({
    onSuccess: () => { quotes.refetch(); toast.success("Quote request submitted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-2"><Link href="/chat"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1"><ArrowLeft className="h-4 w-4" /> Back to Chat</Button></Link></div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Search className="h-7 w-7 text-blue-400" /> Insurance Quote Engine
            </h1>
            <p className="text-muted-foreground mt-1">Multi-carrier quote comparison across all insurance lines</p>
          </div>
          <Button onClick={() => gather.mutate({ clientId: 0, productType: "term_life", faceAmount: 1000000 })} disabled={gather.isPending}>
            <Plus className="h-4 w-4 mr-1" /> New Quote Request
          </Button>
        </div>

        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200/80"><strong>Important:</strong> All quotes are estimates for comparison purposes only. Final rates are determined by the carrier after underwriting.</p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {quotes.isLoading && <div className="text-center py-12 text-muted-foreground">Loading quotes...</div>}
          {!quotes.isLoading && (!quotes.data || quotes.data.length === 0) && (
            <Card className="bg-card/30 border-dashed"><CardContent className="p-12 text-center text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No quotes yet. Start a new quote request to compare carriers.</p>
            </CardContent></Card>
          )}
          {quotes.data?.map((quote: any) => (
            <Card key={quote.id} className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-medium text-foreground capitalize">{quote.lineOfBusiness?.replace(/_/g, " ")}</p>
                  <p className="text-sm text-muted-foreground">Face Amount: ${(quote.faceAmount || 0).toLocaleString()} | Product: {quote.productType || "N/A"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={quote.status === "completed" ? "text-emerald-400" : "text-amber-400"}>{quote.status || "pending"}</Badge>
                  <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   G3. Insurance Applications — /insurance-applications
   ═══════════════════════════════════════════════════════════════════════ */
export function InsuranceApplications() {
  // Backend: applicationRouter.list({ limit })
  const apps = trpc.agentic.application.list.useQuery({ limit: 50 });
  const statusSteps = ["data_collection", "pre_underwriting", "compliance_check", "licensed_review", "submitted", "underwriting", "issued"];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-2"><Link href="/chat"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1"><ArrowLeft className="h-4 w-4" /> Back to Chat</Button></Link></div>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileCheck className="h-7 w-7 text-emerald-400" /> Insurance Applications
          </h1>
          <p className="text-muted-foreground mt-1">Track and manage regulated insurance application submissions</p>
        </div>

        <div className="space-y-3">
          {apps.isLoading && <div className="text-center py-12 text-muted-foreground">Loading applications...</div>}
          {!apps.isLoading && (!apps.data || apps.data.length === 0) && (
            <Card className="bg-card/30 border-dashed"><CardContent className="p-12 text-center text-muted-foreground">
              <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No applications yet. Applications are created from approved insurance quotes.</p>
            </CardContent></Card>
          )}
          {apps.data?.map((app: any) => {
            const currentStep = Math.max(statusSteps.indexOf(app.status || "data_collection"), 0);
            return (
              <Card key={app.id} className="bg-card/50 border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-medium text-foreground">{app.carrierName || "Carrier"} — {app.productType || "Insurance"}</p>
                      <p className="text-sm text-muted-foreground">ID: {String(app.id)}</p>
                    </div>
                    <Badge variant="outline" className={app.status === "issued" ? "text-emerald-400" : "text-blue-400"}>
                      {(app.status || "pending")?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    {statusSteps.map((step, i) => (
                      <div key={step} className={`h-1.5 flex-1 rounded-full ${i <= currentStep ? "bg-emerald-500" : "bg-border"}`} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Step {currentStep + 1} of {statusSteps.length}: {statusSteps[currentStep]?.replace(/_/g, " ")}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   G4. Advisory Execution — /advisory-execution
   ═══════════════════════════════════════════════════════════════════════ */
export function AdvisoryExecution() {
  // Backend: advisoryRouter.list({ limit })
  const executions = trpc.agentic.advisory.list.useQuery({ limit: 50 });

  const typeIcons: Record<string, React.ReactNode> = {
    account_opening: <Briefcase className="h-5 w-5 text-blue-400" />,
    portfolio_implementation: <TrendingUp className="h-5 w-5 text-emerald-400" />,
    rebalancing: <RefreshCw className="h-5 w-5 text-amber-400" />,
    tax_loss_harvesting: <DollarSign className="h-5 w-5 text-green-400" />,
    money_movement: <Send className="h-5 w-5 text-violet-400" />,
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-2"><Link href="/chat"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1"><ArrowLeft className="h-4 w-4" /> Back to Chat</Button></Link></div>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-7 w-7 text-blue-400" /> Advisory Execution Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Manage investment workflows: account opening, rebalancing, tax-loss harvesting, and money movement</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { type: "account_opening", label: "Account Opening", icon: Briefcase, color: "text-blue-400" },
            { type: "portfolio_implementation", label: "Portfolio Impl.", icon: TrendingUp, color: "text-emerald-400" },
            { type: "rebalancing", label: "Rebalancing", icon: RefreshCw, color: "text-amber-400" },
            { type: "tax_loss_harvesting", label: "Tax-Loss Harvest", icon: DollarSign, color: "text-green-400" },
            { type: "money_movement", label: "Money Movement", icon: Send, color: "text-violet-400" },
          ].map((wf) => (
            <Card key={wf.type} className="bg-card/50 border-border/50 cursor-pointer hover:border-border transition-colors">
              <CardContent className="p-4 text-center">
                <wf.icon className={`h-6 w-6 mx-auto mb-2 ${wf.color}`} />
                <p className="text-xs font-medium text-foreground">{wf.label}</p>
                <p className="text-lg font-bold text-foreground mt-1">{executions.data?.filter((e: any) => e.workflowType === wf.type).length ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          {executions.isLoading && <div className="text-center py-12 text-muted-foreground">Loading executions...</div>}
          {!executions.isLoading && (!executions.data || executions.data.length === 0) && (
            <Card className="bg-card/30 border-dashed"><CardContent className="p-12 text-center text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No advisory executions yet. Workflows are triggered from client planning actions.</p>
            </CardContent></Card>
          )}
          {executions.data?.map((exec: any) => (
            <Card key={exec.id} className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  {typeIcons[exec.workflowType] || <Briefcase className="h-5 w-5 text-muted-foreground" />}
                  <div>
                    <p className="font-medium text-foreground capitalize">{exec.workflowType?.replace(/_/g, " ")}</p>
                    <p className="text-sm text-muted-foreground">ID: {String(exec.id)} | {exec.createdAt ? new Date(exec.createdAt).toLocaleDateString() : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={exec.status === "completed" ? "text-emerald-400" : exec.status === "pending_approval" ? "text-amber-400" : "text-blue-400"}>
                    {(exec.status || "pending")?.replace(/_/g, " ")}
                  </Badge>
                  <Button variant="ghost" size="sm"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   G5. Estate Planning — /estate-planning
   ═══════════════════════════════════════════════════════════════════════ */
export function EstatePlanning() {
  // Backend: estateDocRouter.listByClient({ clientId, limit })
  const docs = trpc.agentic.estateDocs.listByClient.useQuery({ clientId: 0 });
  // Backend: estateDocRouter.generateDraft({ clientId, documentType, state, clientData })
  const generate = trpc.agentic.estateDocs.generateDraft.useMutation({
    onSuccess: () => { docs.refetch(); toast.success("Document generation started"); },
    onError: (e: any) => toast.error(e.message),
  });

  const docTypeIcons: Record<string, React.ReactNode> = {
    revocable_trust: <Home className="h-5 w-5 text-blue-400" />,
    will: <FileText className="h-5 w-5 text-amber-400" />,
    poa_financial: <Scale className="h-5 w-5 text-emerald-400" />,
    poa_healthcare: <Heart className="h-5 w-5 text-red-400" />,
    healthcare_directive: <Heart className="h-5 w-5 text-pink-400" />,
    beneficiary_audit: <Users className="h-5 w-5 text-violet-400" />,
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-2"><Link href="/chat"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1"><ArrowLeft className="h-4 w-4" /> Back to Chat</Button></Link></div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Scale className="h-7 w-7 text-emerald-400" /> Estate Planning Documents
            </h1>
            <p className="text-muted-foreground mt-1">Generate, review, and manage estate planning documents with state-specific templates</p>
          </div>
          <Button onClick={() => generate.mutate({ clientId: 0, documentType: "will", stateJurisdiction: "AZ" })} disabled={generate.isPending}>
            <Plus className="h-4 w-4 mr-1" /> New Document
          </Button>
        </div>

        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200/80"><strong>Legal Disclaimer:</strong> AI-generated estate documents are drafts for review purposes only. They do not constitute legal advice.</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { type: "revocable_trust", label: "Revocable Trust" },
            { type: "will", label: "Last Will & Testament" },
            { type: "poa_financial", label: "Financial POA" },
            { type: "poa_healthcare", label: "Healthcare POA" },
            { type: "healthcare_directive", label: "Healthcare Directive" },
            { type: "beneficiary_audit", label: "Beneficiary Audit" },
          ].map((dt) => (
            <Card key={dt.type} className="bg-card/50 border-border/50 cursor-pointer hover:border-border transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                {docTypeIcons[dt.type]}
                <div>
                  <p className="text-sm font-medium text-foreground">{dt.label}</p>
                  <p className="text-xs text-muted-foreground">{docs.data?.filter((d: any) => d.documentType === dt.type).length ?? 0} documents</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          {docs.isLoading && <div className="text-center py-12 text-muted-foreground">Loading documents...</div>}
          {!docs.isLoading && (!docs.data || docs.data.length === 0) && (
            <Card className="bg-card/30 border-dashed"><CardContent className="p-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No estate documents yet. Generate a new document to get started.</p>
            </CardContent></Card>
          )}
          {docs.data?.map((doc: any) => (
            <Card key={doc.id} className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  {docTypeIcons[doc.documentType] || <FileText className="h-5 w-5 text-muted-foreground" />}
                  <div>
                    <p className="font-medium text-foreground capitalize">{doc.documentType?.replace(/_/g, " ")}</p>
                    <p className="text-sm text-muted-foreground">{doc.state} | {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={doc.status === "final" ? "text-emerald-400" : "text-amber-400"}>{doc.status || "draft"}</Badge>
                  <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   G6. Premium Finance — /premium-finance
   ═══════════════════════════════════════════════════════════════════════ */
export function PremiumFinance() {
  // Backend: premiumFinanceRouter.list({ limit })
  const cases = trpc.agentic.premiumFinance.list.useQuery({ limit: 50 });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-2"><Link href="/chat"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1"><ArrowLeft className="h-4 w-4" /> Back to Chat</Button></Link></div>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-7 w-7 text-green-400" /> Premium Finance Engine
          </h1>
          <p className="text-muted-foreground mt-1">Qualification assessment, structure modeling, lender sourcing, and ongoing monitoring</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { stage: "qualification", label: "Qualification", color: "text-blue-400" },
            { stage: "modeling", label: "Structure Modeling", color: "text-violet-400" },
            { stage: "lender_sourcing", label: "Lender Sourcing", color: "text-amber-400" },
            { stage: "application", label: "Application", color: "text-emerald-400" },
            { stage: "monitoring", label: "Monitoring", color: "text-green-400" },
          ].map((s) => (
            <Card key={s.stage} className="bg-card/50 border-border/50">
              <CardContent className="p-4 text-center">
                <p className={`text-lg font-bold ${s.color}`}>{cases.data?.filter((c: any) => c.stage === s.stage).length ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          {cases.isLoading && <div className="text-center py-12 text-muted-foreground">Loading cases...</div>}
          {!cases.isLoading && (!cases.data || cases.data.length === 0) && (
            <Card className="bg-card/30 border-dashed"><CardContent className="p-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No premium finance cases yet. Cases are created from qualified insurance opportunities.</p>
            </CardContent></Card>
          )}
          {cases.data?.map((c: any) => (
            <Card key={c.id} className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-medium text-foreground">Case #{String(c.id)} — ${(c.premiumAmount || 0).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Collateral: ${(c.collateralValue || 0).toLocaleString()} | Net Worth: ${(c.netWorth || 0).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{(c.stage || "qualification")?.replace(/_/g, " ")}</Badge>
                  <Button variant="ghost" size="sm"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   G7. Carrier Connector — /carrier-connector
   ═══════════════════════════════════════════════════════════════════════ */
export function CarrierConnector() {
  // Backend: carrierRouter.listByFirm({ firmId })
  const carriers = trpc.agentic.carrier.listByFirm.useQuery({ firmId: 0 });
  // Backend: carrierRouter.register({ firmId, carrierName, carrierCode, apiEndpoint, linesOfBusiness })
  const register = trpc.agentic.carrier.register.useMutation({
    onSuccess: () => { carriers.refetch(); toast.success("Carrier registered"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-2"><Link href="/chat"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1"><ArrowLeft className="h-4 w-4" /> Back to Chat</Button></Link></div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-7 w-7 text-sky-400" /> Carrier Connector
            </h1>
            <p className="text-muted-foreground mt-1">Register and manage insurance carrier API integrations</p>
          </div>
          <Button onClick={() => register.mutate({ firmId: 0, carrierName: "Sample Carrier", connectionType: "api", apiEndpoint: "https://api.example.com", supportedOperations: ["quote", "application"] })} disabled={register.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Register Carrier
          </Button>
        </div>

        <div className="space-y-3">
          {carriers.isLoading && <div className="text-center py-12 text-muted-foreground">Loading carriers...</div>}
          {!carriers.isLoading && (!carriers.data || carriers.data.length === 0) && (
            <Card className="bg-card/30 border-dashed"><CardContent className="p-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No carriers registered. Register a carrier to enable quote and application workflows.</p>
            </CardContent></Card>
          )}
          {carriers.data?.map((carrier: any) => (
            <Card key={carrier.id} className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-sky-400" />
                  <div>
                    <p className="font-medium text-foreground">{carrier.carrierName}</p>
                    <p className="text-sm text-muted-foreground">Type: {carrier.connectionType} | Ops: {carrier.supportedOperationsJson ? JSON.stringify(carrier.supportedOperationsJson) : "N/A"}</p>
                  </div>
                </div>
                <Badge variant="outline" className={carrier.active ? "text-emerald-400" : "text-amber-400"}>
                  {carrier.active ? "Active" : "Inactive"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
