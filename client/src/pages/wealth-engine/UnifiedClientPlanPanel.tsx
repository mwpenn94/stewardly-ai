/**
 * UnifiedClientPlanPanel — Holistic client planning view that cascades across
 * all 15 client calculator domains and 12 advanced strategy panels.
 * Forward/back planning, practice-to-client income roll-up, cross-hierarchy alignment.
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, Layers, ArrowRight, ArrowLeft, TrendingUp, Target, AlertTriangle, CheckCircle2, DollarSign, BarChart3, Shield, Zap } from "lucide-react";

const fmt = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};

export default function UnifiedClientPlanPanel() {
  const [activeTab, setActiveTab] = useState("overview");
  const [clientId, setClientId] = useState("");
  const cid = parseInt(clientId) || 0;

  const planQ = trpc.planningHierarchy.getUnifiedClientPlan.useQuery(
    { clientId: cid },
    { enabled: cid > 0 }
  );
  const forwardQ = trpc.planningHierarchy.runClientForwardPlan.useQuery(
    { clientId: cid },
    { enabled: cid > 0 && activeTab === "forward" }
  );
  const backwardQ = trpc.planningHierarchy.runClientBackwardPlan.useQuery(
    { clientId: cid },
    { enabled: cid > 0 && activeTab === "backward" }
  );
  const rollUpQ = trpc.planningHierarchy.rollPracticeIncomeToClient.useMutation();
  const alignQ = trpc.planningHierarchy.cascadeClientPlanAlignment.useMutation();

  const plan = planQ.data;

  // Auto-trigger mutations when tabs are selected
  useEffect(() => {
    if (cid > 0 && activeTab === "rollup" && !rollUpQ.data && !rollUpQ.isPending) {
      rollUpQ.mutate({ clientId: cid, rollUpType: "percentage", rollUpValue: 100 });
    }
  }, [activeTab, cid]);

  useEffect(() => {
    if (cid > 0 && activeTab === "alignment" && !alignQ.data && !alignQ.isPending) {
      alignQ.mutate({ clientId: cid });
    }
  }, [activeTab, cid]);

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Layers className="w-5 h-5 text-accent" /> Unified Client Plan
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Holistic view across all client planning domains and advanced strategies with forward/back planning,
          practice-to-client income roll-up, and cross-hierarchy alignment.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Enter Client ID"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          className="w-40 h-8 text-xs"
        />
        {planQ.isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {plan && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="overview" className="gap-1 text-xs"><Layers className="w-3 h-3" /> Overview</TabsTrigger>
            <TabsTrigger value="forward" className="gap-1 text-xs"><ArrowRight className="w-3 h-3" /> Forward Plan</TabsTrigger>
            <TabsTrigger value="backward" className="gap-1 text-xs"><ArrowLeft className="w-3 h-3" /> Back Plan</TabsTrigger>
            <TabsTrigger value="rollup" className="gap-1 text-xs"><DollarSign className="w-3 h-3" /> Income Roll-Up</TabsTrigger>
            <TabsTrigger value="alignment" className="gap-1 text-xs"><Target className="w-3 h-3" /> Alignment</TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW TAB ── */}
          <TabsContent value="overview" className="space-y-4">
            {/* Health Score */}
            <Card className="bg-card/60 border-accent/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-lg font-bold">{plan.clientName}</p>
                    <p className="text-xs text-muted-foreground">Unified Plan Health</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${plan.overallHealth >= 80 ? "text-emerald-400" : plan.overallHealth >= 60 ? "text-amber-400" : "text-red-400"}`}>
                      {plan.overallHealth}
                    </p>
                    <p className="text-[10px] text-muted-foreground">/ 100</p>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-background/50 overflow-hidden">
                  <div className={`h-full rounded-full ${plan.overallHealth >= 80 ? "bg-emerald-500" : plan.overallHealth >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${plan.overallHealth}%` }} />
                </div>
              </CardContent>
            </Card>

            {/* Domain Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {plan.domainSummaries.map(d => (
                <Card key={d.domain} className="bg-card/60 border-accent/10">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium capitalize">{d.domain.replace(/_/g, " ")}</span>
                      <Badge variant={d.status === "on_track" ? "default" : d.status === "at_risk" ? "outline" : "secondary"}
                        className="text-[9px]">
                        {d.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <p className="text-muted-foreground">Current</p>
                        <p className="font-semibold">{fmt(d.currentValue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Target</p>
                        <p className="font-semibold">{fmt(d.targetValue)}</p>
                      </div>
                    </div>
                    <div className="w-full h-1 rounded-full bg-background/50 mt-2 overflow-hidden">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(d.completionPct, 100)}%` }} />
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-1">{d.completionPct.toFixed(0)}% complete • {d.goalCount} goals • {d.strategyCount} strategies</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Gaps & Recommendations */}
            {plan.gaps.length > 0 && (
              <Card className="bg-card/60 border-amber-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Identified Gaps ({plan.gaps.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {plan.gaps.map((g, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px]">
                        <Badge variant="outline" className={`text-[8px] shrink-0 ${g.severity === "critical" ? "border-red-400 text-red-400" : g.severity === "high" ? "border-orange-400 text-orange-400" : "border-amber-400 text-amber-400"}`}>
                          {g.severity}
                        </Badge>
                        <div>
                          <p className="font-medium">{g.domain}: {g.description}</p>
                          <p className="text-muted-foreground">{g.recommendation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── FORWARD PLAN TAB ── */}
          <TabsContent value="forward" className="space-y-4">
            {forwardQ.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Building forward plan...</div>
            ) : forwardQ.data ? (
              <div className="space-y-4">
                <Card className="bg-card/60 border-accent/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Forward Planning — Goal-to-Strategy Cascade</CardTitle>
                    <CardDescription className="text-[11px]">
                      Starting from current state, projects forward across all domains to show what strategies
                      and implementations are needed to reach each goal.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {forwardQ.data.cascadeSteps.map((step, i) => (
                        <div key={i} className="rounded-lg bg-background/50 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-[9px]">Step {i + 1}</Badge>
                            <span className="text-xs font-medium capitalize">{step.domain.replace(/_/g, " ")}</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-accent">{step.targetGoal}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                            <div><p className="text-muted-foreground">Current</p><p className="font-semibold">{fmt(step.currentValue)}</p></div>
                            <div><p className="text-muted-foreground">Target</p><p className="font-semibold">{fmt(step.targetValue)}</p></div>
                            <div><p className="text-muted-foreground">Gap</p><p className="font-semibold text-amber-400">{fmt(step.gap)}</p></div>
                          </div>
                          {step.strategies.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {step.strategies.map(s => (
                                <Badge key={s} variant="secondary" className="text-[8px]">{s}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card/60 border-accent/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Recommended Channel Mix</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {forwardQ.data.channelMix.map(ch => (
                        <div key={ch.channel} className="rounded bg-background/50 p-2 text-center">
                          <p className="text-[10px] text-muted-foreground capitalize">{ch.channel.replace(/_/g, " ")}</p>
                          <p className="text-sm font-bold text-accent">{ch.allocation.toFixed(0)}%</p>
                          <p className="text-[9px] text-muted-foreground">{fmt(ch.projectedValue)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* ── BACKWARD PLAN TAB ── */}
          <TabsContent value="backward" className="space-y-4">
            {backwardQ.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Building backward plan...</div>
            ) : backwardQ.data ? (
              <div className="space-y-4">
                <Card className="bg-card/60 border-accent/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Backward Planning — Required Inputs per Goal</CardTitle>
                    <CardDescription className="text-[11px]">
                      Starting from target goals, works backward to determine what inputs, contributions,
                      and milestones are required at each stage.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {backwardQ.data.requiredInputs.map((req, i) => (
                        <div key={i} className="rounded-lg bg-background/50 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="w-3.5 h-3.5 text-accent" />
                            <span className="text-xs font-medium">{req.goalName}</span>
                            <Badge variant="outline" className="text-[9px] capitalize">{req.domain.replace(/_/g, " ")}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div><p className="text-muted-foreground">Required Monthly</p><p className="font-semibold">{fmt(req.requiredMonthly)}</p></div>
                            <div><p className="text-muted-foreground">Years to Goal</p><p className="font-semibold">{req.yearsToGoal}</p></div>
                          </div>
                          {req.milestones.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {req.milestones.map((m, j) => (
                                <div key={j} className="flex items-center gap-1 text-[10px]">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span className="text-muted-foreground">Year {m.year}:</span>
                                  <span>{m.description}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card/60 border-accent/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Required Contributions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center">
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Monthly Total</p>
                        <p className="text-lg font-bold text-accent">{fmt(backwardQ.data.totalMonthlyRequired)}</p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Annual Total</p>
                        <p className="text-lg font-bold">{fmt(backwardQ.data.totalAnnualRequired)}</p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Feasibility</p>
                        <p className={`text-lg font-bold ${backwardQ.data.feasibilityScore >= 70 ? "text-emerald-400" : "text-amber-400"}`}>
                          {backwardQ.data.feasibilityScore}/100
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* ── INCOME ROLL-UP TAB ── */}
          <TabsContent value="rollup" className="space-y-4">
            {rollUpQ.isPending ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Computing roll-up...</div>
            ) : rollUpQ.data ? (
              <div className="space-y-4">
                <Card className="bg-card/60 border-accent/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Practice-to-Client Income Roll-Up</CardTitle>
                    <CardDescription className="text-[11px]">
                      How practice income flows into this client's planning — fee allocations,
                      strategy funding, and revenue attribution.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-4">
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Client Revenue</p>
                        <p className="text-lg font-bold text-accent">{fmt(rollUpQ.data.clientRevenue)}</p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">% of Practice</p>
                        <p className="text-lg font-bold">{rollUpQ.data.pctOfPractice.toFixed(1)}%</p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Strategy Funding</p>
                        <p className="text-lg font-bold">{fmt(rollUpQ.data.strategyFunding)}</p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Net to Client</p>
                        <p className="text-lg font-bold text-emerald-400">{fmt(rollUpQ.data.netToClient)}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {rollUpQ.data.channels.map(ch => (
                        <div key={ch.channel} className="flex items-center justify-between rounded bg-background/50 p-2">
                          <span className="text-xs capitalize">{ch.channel.replace(/_/g, " ")}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground">{ch.allocation.toFixed(0)}%</span>
                            <span className="text-xs font-semibold">{fmt(ch.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* ── ALIGNMENT TAB ── */}
          <TabsContent value="alignment" className="space-y-4">
            {alignQ.isPending ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Checking alignment...</div>
            ) : alignQ.data ? (
              <div className="space-y-4">
                <Card className="bg-card/60 border-accent/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cross-Hierarchy Alignment</CardTitle>
                    <CardDescription className="text-[11px]">
                      How this client's plan aligns across practice, client, and advanced strategy hierarchies.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center mb-4">
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Overall Score</p>
                        <p className={`text-2xl font-bold ${alignQ.data.overallScore >= 80 ? "text-emerald-400" : alignQ.data.overallScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                          {alignQ.data.overallScore}
                        </p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Aligned Items</p>
                        <p className="text-2xl font-bold text-emerald-400">{alignQ.data.alignedCount}</p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Misaligned</p>
                        <p className="text-2xl font-bold text-amber-400">{alignQ.data.misalignedCount}</p>
                      </div>
                    </div>
                    {alignQ.data.misalignments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-amber-400">Misalignment Details</p>
                        {alignQ.data.misalignments.map((m, i) => (
                          <div key={i} className="flex items-start gap-2 rounded bg-background/50 p-2 text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium">{m.source} → {m.target}</p>
                              <p className="text-muted-foreground">{m.description}</p>
                              <p className="text-accent text-[10px]">Fix: {m.resolution}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      )}

      {!cid && (
        <Card className="bg-card/60 border-accent/10">
          <CardContent className="p-6 text-center">
            <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Enter a Client ID to view their unified plan across all planning domains.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
