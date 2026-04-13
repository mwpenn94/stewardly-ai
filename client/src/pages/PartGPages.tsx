/**
 * PartGPages.tsx — Agentic workflow pages
 *
 * Contains: InsuranceApplications, AdvisoryExecution, CarrierConnector
 * (routes: /insurance-applications, /advisory-execution, /carrier-connector)
 *
 * Historical note: this file previously also exported LicensedReview,
 * AgentOperations, InsuranceQuotes, EstatePlanning, PremiumFinance.
 * Those routes now redirect (see App.tsx), and the functions were removed
 * as dead code in Pass 3.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import {
  DollarSign, Building2, Briefcase,
  FileCheck, TrendingUp,
  RefreshCw, ChevronRight, Send, Plus, ArrowLeft
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════
   G3. Insurance Applications — /insurance-applications
   ═══════════════════════════════════════════════════════════════════════ */
export function InsuranceApplications() {
  // Backend: applicationRouter.list({ limit })
  const apps = trpc.agentic.application.list.useQuery({ limit: 50 });
  const statusSteps = ["data_collection", "pre_underwriting", "compliance_check", "licensed_review", "submitted", "underwriting", "issued"];

  return (
    <AppShell title="Insurance Applications">
    <SEOHead title="Insurance Applications" description="Track and manage regulated insurance application submissions" />
    <div className="bg-background p-6">
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
    </AppShell>
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
    <AppShell title="Advisory Execution">
    <SEOHead title="Advisory Execution" description="Execute and track advisory workflow steps" />
    <div className="bg-background p-6">
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
    </AppShell>
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
    <AppShell title="Carrier Connector">
    <SEOHead title="Carrier Connector" description="Connect with insurance carriers and manage submissions" />
    <div className="bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-2"><Link href="/chat"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1"><ArrowLeft className="h-4 w-4" /> Back to Chat</Button></Link></div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-7 w-7 text-accent" /> Carrier Connector
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
                  <Building2 className="h-5 w-5 text-accent" />
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
    </AppShell>
  );
}
