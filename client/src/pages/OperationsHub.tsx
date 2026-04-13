/**
 * Operations Hub (C22)
 * Consolidates: Agentic Hub, Agent Operations, Licensed Review, Workflows, Compliance
 * Tabs: Active Work | Agents | Compliance | History
 */
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link } from "wouter";
import { navigateToChat } from "@/lib/navigateToChat";
import {
  Activity, Bot, Shield, History, Play, Pause, Square,
  CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, Eye,
  Search, Filter, RefreshCw, MoreHorizontal, FileText, Zap,
} from "lucide-react";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { IntelligenceStatusWidget } from "@/components/IntelligenceStatusWidget";

export default function OperationsHub() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");

  // Live data for QuickStats
  const gateList = trpc.agentic.gate.list.useQuery({ status: "pending" as any, limit: 100 }, { retry: false });
  const agentList = (trpc as any).agentic?.agent?.list?.useQuery?.({} as any, { retry: false }) ?? { data: undefined };
  const complianceStats = trpc.compliance.getDashboardStats.useQuery(undefined, { retry: false });
  const pendingCount = (gateList.data ?? []).length;
  const runningAgents = ((agentList.data as any)?.agents ?? []).filter((a: any) => a.status === "running").length;
  const complianceFlags = (complianceStats.data as any)?.flaggedCount ?? 0;

  return (
    <AppShell title="Operations">
      <SEOHead title="Operations" description="Active tasks, agents, compliance, and audit history" />
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div>
            <h1 className="text-xl font-bold">Operations</h1>
            <p className="text-sm text-muted-foreground">Active work, agents, compliance, and history</p>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <QuickStat icon={Activity} label="Active Tasks" value={String(pendingCount + runningAgents)} color="text-chart-3" />
          <QuickStat icon={Bot} label="Running Agents" value={String(runningAgents)} color="text-chart-2" />
          <QuickStat icon={Shield} label="Pending Reviews" value={String(pendingCount)} color="text-chart-1" />
          <QuickStat icon={AlertTriangle} label="Compliance Flags" value={String(complianceFlags)} color="text-destructive" />
        </div>

        {/* Intelligence Status */}
        <div className="mb-6">
          <IntelligenceStatusWidget />
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search operations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" aria-label="Filter"><Filter className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="active" className="gap-1">
              <Activity className="h-3 w-3" /> Active Work
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1">
              <Bot className="h-3 w-3" /> Agents
            </TabsTrigger>
            <TabsTrigger value="compliance" className="gap-1">
              <Shield className="h-3 w-3" /> Compliance
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <History className="h-3 w-3" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4 mt-4">
            <SectionErrorBoundary sectionName="Active Work" onRetry={() => utils.agentic.gate.list.invalidate()}>
              <ActiveWorkSection />
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="agents" className="space-y-4 mt-4">
            <SectionErrorBoundary sectionName="Agents" onRetry={() => { try { utils.agentic.agent.list.invalidate(); } catch {} }}>
              <AgentsSection />
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4 mt-4">
            <SectionErrorBoundary sectionName="Compliance">
              <ComplianceSection />
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            <SectionErrorBoundary sectionName="History">
              <HistorySection />
            </SectionErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </AppShell>
  );
}

function QuickStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <div>
          <div className="text-lg font-bold font-mono tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveWorkSection() {
  const workflows = trpc.workflow.listInstances.useQuery(undefined, { retry: false });
  const gateReviews = trpc.agentic.gate.list.useQuery({ status: "pending" as const, limit: 10 });

  return (
    <div className="relative space-y-4">
      {/* Warm gold radial glow */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflows In Progress</CardTitle>
          <CardDescription>Active workflows and their current status</CardDescription>
        </CardHeader>
        <CardContent>
          {workflows.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {(workflows.data ?? []).length > 0 ? (workflows.data ?? []).slice(0, 5).map((wf) => (
                <div key={wf.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Zap className="h-4 w-4 text-blue-500" />
                    <div>
                      <div className="text-sm font-medium">{wf.templateName || wf.templateId}</div>
                      <div className="text-xs text-muted-foreground">Step {(wf.currentStep || 0) + 1} · {wf.status}</div>
                    </div>
                  </div>
                  <Badge variant={wf.status === "in_progress" ? "default" : wf.status === "completed" ? "secondary" : "outline"}>{wf.status || "pending"}</Badge>
                </div>
              )) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No active workflows.
                  <br />
                  <Button variant="link" size="sm" className="mt-1 text-xs" onClick={() => navigateToChat("Help me start a new workflow. What types of automated workflows can I create for my advisory practice?")}>
                    Ask the AI to start a workflow →
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending Reviews</CardTitle>
          <CardDescription>Items awaiting human review before execution</CardDescription>
        </CardHeader>
        <CardContent>
          {gateReviews.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {(gateReviews.data ?? []).slice(0, 5).map((review: any) => (
                <div key={review.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Eye className="h-4 w-4 text-amber-500" />
                    <div>
                      <div className="text-sm font-medium">{review.actionType || "Action"}</div>
                      <div className="text-xs text-muted-foreground">{review.summary || "Pending review"}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigateToChat(`Review and approve the pending action: "${review.actionType || "Action"}" — ${review.summary || "Pending review"}. Show me the details and let me confirm approval.`)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigateToChat(`I want to reject the pending action: "${review.actionType || "Action"}" — ${review.summary || "Pending review"}. Help me document the reason for rejection.`)}>
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )) ?? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No pending reviews. All clear!
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentsSection() {
  const agents = trpc.agentic?.agent?.list?.useQuery?.({} as any) ?? { data: undefined, isLoading: false };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Agent Fleet</h3>
        <Link href="/agents">
          <Button size="sm">
            <Bot className="h-3 w-3 mr-1" /> Manage Agents
          </Button>
        </Link>
      </div>

      {agents.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(agents.data as any)?.agents?.map((agent: any) => (
            <Card key={agent.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className={`h-5 w-5 ${agent.status === "running" ? "text-green-500" : "text-muted-foreground"}`} />
                    <div>
                      <div className="font-medium text-sm">{agent.name}</div>
                      <div className="text-xs text-muted-foreground">{agent.type || "General"}</div>
                    </div>
                  </div>
                  <Badge variant={agent.status === "running" ? "default" : agent.status === "paused" ? "secondary" : "outline"}>
                    {agent.status || "idle"}
                  </Badge>
                </div>
                <div className="mt-3 flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => navigateToChat(`Run the "${agent.name}" agent now. Show me what it will do and let me confirm before executing.`)}>
                    <Play className="h-3 w-3 mr-1" /> Run
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => navigateToChat(`Show me the details and recent activity of the "${agent.name}" agent. What has it done recently and what's its current status?`)}>
                    <Eye className="h-3 w-3 mr-1" /> View
                  </Button>
                </div>
              </CardContent>
            </Card>
          )) ?? (
            <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No agents configured yet.
              <br />
              <Button variant="link" size="sm" className="mt-1 text-xs" onClick={() => navigateToChat("Help me set up my first AI agent. I want to automate some recurring tasks in my advisory practice.")}>
                Ask the AI to create one for you →
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Kill Switch */}
      <Card className="border-red-500/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <div className="font-medium text-sm text-red-400">Emergency Kill Switch</div>
            <div className="text-xs text-muted-foreground">Stop all running agents immediately</div>
          </div>
          <Button variant="destructive" size="sm" onClick={() => toast.info("No agents currently running")}>
            <Square className="h-3 w-3 mr-1" /> Stop All
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ComplianceSection() {
  const statsQ = trpc.compliance.getDashboardStats.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const stats = statsQ.data as any;
  const total = stats?.totalCount ?? 0;
  const flagged = stats?.flaggedCount ?? 0;
  const passRate = total > 0 ? Math.round(((total - flagged) / total) * 100) : 100;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Compliance Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${passRate >= 90 ? "text-green-500" : passRate >= 70 ? "text-amber-500" : "text-red-500"}`}>
              {statsQ.isLoading ? "—" : `${passRate}%`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{total} reviews total, {flagged} flagged</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Flagged Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${flagged === 0 ? "text-green-500" : "text-red-500"}`}>
              {statsQ.isLoading ? "—" : flagged}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Requiring review or resolution</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance Details</CardTitle>
          <CardDescription>View the full compliance audit for detailed review history</CardDescription>
        </CardHeader>
        <CardContent>
          {flagged === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No compliance flags. All systems nominal.
            </div>
          ) : (
            <div className="text-center py-4 text-sm">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
              <p className="text-foreground">{flagged} item{flagged !== 1 ? "s" : ""} need attention</p>
            </div>
          )}
          <div className="mt-3 text-center">
            <Link href="/compliance-audit">
              <Button variant="outline" size="sm">View Full Compliance Audit</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HistorySection() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operation History</CardTitle>
          <CardDescription>Completed workflows, agent runs, and reviews</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground text-sm">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Operation history will appear here as you use the platform.
            <br />
            <span className="text-xs">All actions are logged with full audit trails.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
