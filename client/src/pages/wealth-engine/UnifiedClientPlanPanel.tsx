/**
 * UnifiedClientPlanPanel — Holistic client planning view.
 *
 * Backend data shapes (from unifiedClientPlan.ts):
 *   getUnifiedClientPlan → UnifiedClientPlanSummary { clientId, clientName, lastUpdated, overallScore, categories[], cascadeHealth, recommendations[] }
 *   generateForwardPlan → ForwardPlanResult { clientId, currentState, recommendedMix[], projectedOutcome, cascadeNodes[] }
 *   generateBackPlan → BackPlanResult { clientId, goals[], totalGap, overallFeasibility, cascadeAlignment }
 *   getPracticeToClientRollup → PracticeToClientRollup { clientId, practiceIncome, clientAllocation, strategyFunding[] }
 *   cascadeClientPlan → { propagated[], conflicts[] } (requires sourceDomain + changes)
 */
import { useState, useEffect, useMemo } from "react";
import { useWealthEngine } from "@/contexts/WealthEngineContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Loader2, Layers, ArrowRight, ArrowLeft, TrendingUp, Target,
  AlertTriangle, CheckCircle2, DollarSign, BarChart3, Shield, Zap
} from "lucide-react";
import { fmt } from '@/lib/format';
export default function UnifiedClientPlanPanel() {
  const { user } = useAuth();
  const we = useWealthEngine();
  const [activeTab, setActiveTab] = useState("overview");
  const [clientId, setClientId] = useState("");
  const cid = parseInt(clientId) || 0;

  const planQ = trpc.planningHierarchy.getUnifiedClientPlan.useQuery(
    { clientId: cid },
    { enabled: !!user && cid > 0, retry: false }
  );
  const forwardQ = trpc.planningHierarchy.runClientForwardPlan.useQuery(
    { clientId: cid },
    { enabled: !!user && cid > 0 && activeTab === "forward", retry: false }
  );
  const backwardQ = trpc.planningHierarchy.runClientBackwardPlan.useQuery(
    { clientId: cid },
    { enabled: !!user && cid > 0 && activeTab === "backward", retry: false }
  );
  const rollUpQ = trpc.planningHierarchy.rollPracticeIncomeToClient.useMutation();

  const plan = planQ.data;

  // Auto-trigger roll-up mutation when tab is selected
  useEffect(() => {
    if (user && cid > 0 && activeTab === "rollup" && !rollUpQ.data && !rollUpQ.isPending) {
      rollUpQ.mutate({ clientId: cid, rollUpType: "percentage", rollUpValue: 100 });
    }
  }, [activeTab, cid, user]);

  if (!user) {
    return (
      <div className="space-y-6 p-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> Unified Client Plan
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to access holistic client planning across all domains.
          </p>
        </div>
        <Card className="bg-card/60 border-accent/10">
          <CardContent className="p-8 text-center">
            <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Authentication Required</p>
            <p className="text-xs text-muted-foreground mt-1">This feature requires sign-in to access client data.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" /> Unified Client Plan
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Holistic view across all client planning domains and advanced strategies with forward/back planning,
          practice-to-client income roll-up, and cross-hierarchy alignment.
        </p>
      </div>

      {/* Live Session Cascade Summary */}
      {we.scorecard.pctScore > 0 && (
        <Card className="bg-card/60 border-primary/15">
          <CardContent className="p-3">
            <p className="text-[10px] font-medium text-primary mb-2">Live Session Data (from Calculator)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-center text-[10px]">
              <div className="rounded bg-background/50 p-1.5">
                <p className="text-muted-foreground">Health</p>
                <p className={`font-bold ${we.scorecard.pctScore >= 70 ? 'text-emerald-400' : we.scorecard.pctScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{Math.round(we.scorecard.pctScore)}%</p>
              </div>
              <div className="rounded bg-background/50 p-1.5">
                <p className="text-muted-foreground">Net Cash Flow</p>
                <p className={`font-bold ${we.cfResult.netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(we.cfResult.netCashFlow)}/mo</p>
              </div>
              <div className="rounded bg-background/50 p-1.5">
                <p className="text-muted-foreground">Protection Gap</p>
                <p className={`font-bold ${we.prResult.gap > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{fmt(we.prResult.gap)}</p>
              </div>
              <div className="rounded bg-background/50 p-1.5">
                <p className="text-muted-foreground">Retirement Gap</p>
                <p className={`font-bold ${we.rtResult.gap > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{fmt(we.rtResult.gap)}/mo</p>
              </div>
              <div className="rounded bg-background/50 p-1.5">
                <p className="text-muted-foreground">Tax Savings</p>
                <p className="font-bold text-primary">{fmt(we.txResult.totalSavings)}</p>
              </div>
              <div className="rounded bg-background/50 p-1.5">
                <p className="text-muted-foreground">Estate Tax</p>
                <p className={`font-bold ${we.esResult.estateTax > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(we.esResult.estateTax)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Input
          placeholder="Enter Client ID"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          className="w-40 h-8 text-xs"
        />
        {planQ.isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        {planQ.isError && (
          <span className="text-xs text-red-400">Error: {planQ.error?.message}</span>
        )}
      </div>

      {plan && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="overview" className="gap-1 text-xs"><Layers className="w-3 h-3" /> Overview</TabsTrigger>
            <TabsTrigger value="forward" className="gap-1 text-xs"><ArrowRight className="w-3 h-3" /> Forward Plan</TabsTrigger>
            <TabsTrigger value="backward" className="gap-1 text-xs"><ArrowLeft className="w-3 h-3" /> Back Plan</TabsTrigger>
            <TabsTrigger value="rollup" className="gap-1 text-xs"><DollarSign className="w-3 h-3" /> Income Roll-Up</TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW TAB ── */}
          <TabsContent value="overview" className="space-y-4">
            {/* Overall Score */}
            <Card className="bg-card/60 border-primary/15">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-lg font-bold">{plan.clientName}</p>
                    <p className="text-xs text-muted-foreground">Unified Plan Health</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${plan.overallScore >= 80 ? "text-emerald-400" : plan.overallScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                      {plan.overallScore}
                    </p>
                    <p className="text-[10px] text-muted-foreground">/ 100</p>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-background/50 overflow-hidden">
                  <div className={`h-full rounded-full ${plan.overallScore >= 80 ? "bg-emerald-500" : plan.overallScore >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${plan.overallScore}%` }} />
                </div>
              </CardContent>
            </Card>

            {/* Cascade Health */}
            {plan.cascadeHealth && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <Card className="bg-card/60"><CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground">Total Nodes</p>
                  <p className="text-lg font-bold">{plan.cascadeHealth.totalNodes}</p>
                </CardContent></Card>
                <Card className="bg-card/60"><CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground">Aligned</p>
                  <p className="text-lg font-bold text-emerald-400">{plan.cascadeHealth.alignedNodes}</p>
                </CardContent></Card>
                <Card className="bg-card/60"><CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground">Misaligned</p>
                  <p className="text-lg font-bold text-amber-400">{plan.cascadeHealth.misalignedNodes}</p>
                </CardContent></Card>
                <Card className="bg-card/60"><CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground">Health Score</p>
                  <p className={`text-lg font-bold ${plan.cascadeHealth.healthScore >= 80 ? "text-emerald-400" : "text-amber-400"}`}>{plan.cascadeHealth.healthScore}</p>
                </CardContent></Card>
              </div>
            )}

            {/* Category Summary Grid */}
            {plan.categories && plan.categories.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {plan.categories.map((cat: any) => (
                  <Card key={cat.domain} className="bg-card/60 border-accent/10">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium">{cat.label}</span>
                        <Badge variant={cat.status === "complete" ? "default" : cat.status === "partial" ? "outline" : "secondary"}
                          className={`text-[9px] ${cat.status === "complete" ? "bg-emerald-500/20 text-emerald-400" : cat.status === "partial" ? "border-amber-400 text-amber-400" : ""}`}>
                          {cat.status?.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div><p className="text-muted-foreground">Score</p><p className="font-semibold">{cat.score}/100</p></div>
                        <div><p className="text-muted-foreground">Current</p><p className="font-semibold">{fmt(cat.currentValue)}</p></div>
                        <div><p className="text-muted-foreground">Gap</p><p className="font-semibold text-amber-400">{fmt(cat.gap)}</p></div>
                      </div>
                      <div className="w-full h-1 rounded-full bg-background/50 mt-2 overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(cat.score, 100)}%` }} />
                      </div>
                      {cat.recommendations && cat.recommendations.length > 0 && (
                        <p className="text-[9px] text-muted-foreground mt-1 truncate">{cat.recommendations[0]}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {plan.recommendations && plan.recommendations.length > 0 && (
              <Card className="bg-card/60 border-accent/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1">
                    <Zap className="w-4 h-4 text-primary" /> Prioritized Recommendations ({plan.recommendations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {plan.recommendations.map((r: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-[11px]">
                        <Badge variant="outline" className={`text-[8px] shrink-0 ${r.priority === "critical" ? "border-red-400 text-red-400" : r.priority === "high" ? "border-orange-400 text-orange-400" : "border-amber-400 text-amber-400"}`}>
                          {r.priority}
                        </Badge>
                        <div>
                          <p className="font-medium capitalize">{r.domain?.replace(/_/g, " ")}: {r.action}</p>
                          <p className="text-muted-foreground">Impact: {r.impact} · Effort: {r.effort}</p>
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
            ) : forwardQ.isError ? (
              <Card className="bg-card/60 border-red-500/20"><CardContent className="p-4 text-center">
                <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-400">Failed to generate forward plan</p>
                <p className="text-xs text-muted-foreground mt-1">{forwardQ.error?.message}</p>
              </CardContent></Card>
            ) : forwardQ.data ? (
              <div className="space-y-4">
                {/* Current State Snapshot */}
                <Card className="bg-card/60 border-primary/15">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Current Financial State</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center">
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Net Worth</p>
                        <p className="text-lg font-bold text-primary">{fmt(forwardQ.data.currentState?.netWorth ?? 0)}</p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Annual Income</p>
                        <p className="text-lg font-bold">{fmt(forwardQ.data.currentState?.annualIncome ?? 0)}</p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Savings Rate</p>
                        <p className="text-lg font-bold">{(forwardQ.data.currentState?.savingsRate ?? 0).toFixed(0)}%</p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Retirement Readiness</p>
                        <p className="text-lg font-bold">{(forwardQ.data.currentState?.retirementReadiness ?? 0).toFixed(0)}%</p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Protection Score</p>
                        <p className="text-lg font-bold">{(forwardQ.data.currentState?.protectionScore ?? 0).toFixed(0)}%</p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Tax Efficiency</p>
                        <p className="text-lg font-bold">{(forwardQ.data.currentState?.taxEfficiency ?? 0).toFixed(0)}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recommended Strategy Mix */}
                <Card className="bg-card/60 border-accent/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Recommended Strategy Mix</CardTitle>
                    <CardDescription className="text-[11px]">
                      Priority-weighted allocation across planning domains based on current gaps.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(forwardQ.data.recommendedMix ?? []).map((mix: any, i: number) => (
                        <div key={i} className="rounded bg-background/50 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium capitalize">{mix.label || mix.domain?.replace(/_/g, " ")}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-[8px] ${
                                mix.priority === "critical" ? "border-red-400 text-red-400" :
                                mix.priority === "high" ? "border-orange-400 text-orange-400" :
                                mix.priority === "medium" ? "border-amber-400 text-amber-400" :
                                "border-blue-400 text-blue-400"
                              }`}>{mix.priority}</Badge>
                              <span className="text-xs font-bold text-primary">{mix.allocation}%</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{mix.rationale}</p>
                          <div className="w-full h-1 rounded-full bg-background/50 mt-1.5 overflow-hidden">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${mix.allocation}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Projected Outcomes */}
                {forwardQ.data.projectedOutcome && (
                  <Card className="bg-card/60 border-accent/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Projected Outcomes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center">
                        <div className="rounded bg-background/50 p-2">
                          <p className="text-[10px] text-muted-foreground">Net Worth @ 5yr</p>
                          <p className="text-lg font-bold text-primary">{fmt(forwardQ.data.projectedOutcome.netWorthAt5)}</p>
                        </div>
                        <div className="rounded bg-background/50 p-2">
                          <p className="text-[10px] text-muted-foreground">Net Worth @ 10yr</p>
                          <p className="text-lg font-bold">{fmt(forwardQ.data.projectedOutcome.netWorthAt10)}</p>
                        </div>
                        <div className="rounded bg-background/50 p-2">
                          <p className="text-[10px] text-muted-foreground">Net Worth @ 20yr</p>
                          <p className="text-lg font-bold">{fmt(forwardQ.data.projectedOutcome.netWorthAt20)}</p>
                        </div>
                        <div className="rounded bg-background/50 p-2">
                          <p className="text-[10px] text-muted-foreground">Retirement Readiness</p>
                          <p className="text-lg font-bold text-emerald-400">{forwardQ.data.projectedOutcome.retirementReadiness}%</p>
                        </div>
                        <div className="rounded bg-background/50 p-2">
                          <p className="text-[10px] text-muted-foreground">Protection Gap</p>
                          <p className="text-lg font-bold text-amber-400">{fmt(forwardQ.data.projectedOutcome.protectionGap)}</p>
                        </div>
                        <div className="rounded bg-background/50 p-2">
                          <p className="text-[10px] text-muted-foreground">Tax Savings</p>
                          <p className="text-lg font-bold text-emerald-400">{fmt(forwardQ.data.projectedOutcome.taxSavings)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Cascade Nodes */}
                {forwardQ.data.cascadeNodes && forwardQ.data.cascadeNodes.length > 0 && (
                  <Card className="bg-card/60 border-accent/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Cascade Nodes ({forwardQ.data.cascadeNodes.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {forwardQ.data.cascadeNodes.map((node: any, i: number) => (
                          <div key={i} className="flex items-center justify-between rounded bg-background/50 p-2 text-[11px]">
                            <span>{node.label}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[8px]">{node.level}</Badge>
                              <span className="font-semibold">{fmt(node.value)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : null}
          </TabsContent>

          {/* ── BACKWARD PLAN TAB ── */}
          <TabsContent value="backward" className="space-y-4">
            {backwardQ.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Building backward plan...</div>
            ) : backwardQ.isError ? (
              <Card className="bg-card/60 border-red-500/20"><CardContent className="p-4 text-center">
                <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-400">Failed to generate backward plan</p>
                <p className="text-xs text-muted-foreground mt-1">{backwardQ.error?.message}</p>
              </CardContent></Card>
            ) : backwardQ.data ? (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <Card className="bg-card/60"><CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground">Total Gap</p>
                    <p className="text-lg font-bold text-amber-400">{fmt(backwardQ.data.totalGap)}</p>
                  </CardContent></Card>
                  <Card className="bg-card/60"><CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground">Overall Feasibility</p>
                    <p className={`text-lg font-bold ${backwardQ.data.overallFeasibility >= 70 ? "text-emerald-400" : "text-amber-400"}`}>
                      {backwardQ.data.overallFeasibility}/100
                    </p>
                  </CardContent></Card>
                  <Card className="bg-card/60"><CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground">Cascade Alignment</p>
                    <p className="text-lg font-bold">
                      <span className="text-emerald-400">{backwardQ.data.cascadeAlignment?.aligned ?? 0}</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="text-amber-400">{backwardQ.data.cascadeAlignment?.misaligned ?? 0}</span>
                    </p>
                  </CardContent></Card>
                </div>

                {/* Goals */}
                <Card className="bg-card/60 border-primary/15">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Goal-Based Backward Planning</CardTitle>
                    <CardDescription className="text-[11px]">
                      Starting from target goals, works backward to determine required inputs, contributions, and milestones.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(backwardQ.data.goals ?? []).map((goal: any, i: number) => (
                        <div key={i} className="rounded-lg bg-background/50 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Target className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-medium">{goal.label}</span>
                            </div>
                            <Badge variant="outline" className={`text-[9px] ${goal.feasibility >= 70 ? "border-emerald-400 text-emerald-400" : "border-amber-400 text-amber-400"}`}>
                              {goal.feasibility}% feasible
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                            <div><p className="text-muted-foreground">Target</p><p className="font-semibold">{fmt(goal.targetValue)}</p></div>
                            <div><p className="text-muted-foreground">Current</p><p className="font-semibold">{fmt(goal.currentValue)}</p></div>
                            <div><p className="text-muted-foreground">Gap</p><p className="font-semibold text-amber-400">{fmt(goal.gap)}</p></div>
                            <div><p className="text-muted-foreground">Timeline</p><p className="font-semibold">{goal.timelineMonths} months</p></div>
                          </div>
                          {goal.requiredActions && goal.requiredActions.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {goal.requiredActions.map((action: any, j: number) => (
                                <div key={j} className="flex items-start gap-1 text-[10px]">
                                  <ArrowRight className="w-2.5 h-2.5 text-primary mt-0.5 shrink-0" />
                                  <span className="capitalize">{action.domain?.replace(/_/g, " ")}: {action.action}</span>
                                  <Badge variant="outline" className="text-[7px] ml-auto">{action.priority}</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Cascade Alignment Gaps */}
                {backwardQ.data.cascadeAlignment?.gaps && backwardQ.data.cascadeAlignment.gaps.length > 0 && (
                  <Card className="bg-card/60 border-amber-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-amber-400" /> Alignment Gaps
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {backwardQ.data.cascadeAlignment.gaps.map((gap: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-[11px]">
                            <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                            <span>{gap}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : null}
          </TabsContent>

          {/* ── INCOME ROLL-UP TAB ── */}
          <TabsContent value="rollup" className="space-y-4">
            {rollUpQ.isPending ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Computing roll-up...</div>
            ) : rollUpQ.data ? (
              <div className="space-y-4">
                {/* Practice Income */}
                <Card className="bg-card/60 border-primary/15">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Practice Income</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-center mb-4">
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Total GDC</p>
                        <p className="text-lg font-bold text-primary">{fmt(rollUpQ.data.practiceIncome?.totalGDC ?? 0)}</p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Net Income</p>
                        <p className="text-lg font-bold">{fmt(rollUpQ.data.practiceIncome?.totalNetIncome ?? 0)}</p>
                      </div>
                    </div>
                    {rollUpQ.data.practiceIncome?.byChannel && rollUpQ.data.practiceIncome.byChannel.length > 0 && (
                      <div className="space-y-1">
                        {rollUpQ.data.practiceIncome.byChannel.map((ch: any, i: number) => (
                          <div key={i} className="flex items-center justify-between rounded bg-background/50 p-2 text-[11px]">
                            <span className="capitalize">{ch.channel?.replace(/_/g, " ")}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground">{ch.margin}% margin</span>
                              <span className="font-semibold">{fmt(ch.net)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Client Allocation */}
                <Card className="bg-card/60 border-accent/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Client Allocation</CardTitle>
                    <CardDescription className="text-[11px]">
                      How practice income is allocated to this client's planning strategies.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-center mb-4">
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Method</p>
                        <p className="text-sm font-bold capitalize">{rollUpQ.data.clientAllocation?.method ?? "—"}</p>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Allocated Amount</p>
                        <p className="text-lg font-bold text-emerald-400">{fmt(rollUpQ.data.clientAllocation?.allocatedAmount ?? 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Strategy Funding */}
                {rollUpQ.data.strategyFunding && rollUpQ.data.strategyFunding.length > 0 && (
                  <Card className="bg-card/60 border-accent/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Strategy Funding Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {rollUpQ.data.strategyFunding.map((sf: any, i: number) => (
                          <div key={i} className="rounded bg-background/50 p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium capitalize">{sf.domain?.replace(/_/g, " ")}</span>
                              <span className="text-xs font-bold">{fmt(sf.fundedAmount)} / {fmt(sf.requiredAmount)}</span>
                            </div>
                            <div className="w-full h-1 rounded-full bg-background/50 overflow-hidden">
                              <div className="h-full rounded-full bg-accent" style={{ width: `${sf.requiredAmount > 0 ? Math.min(100, sf.fundedAmount / sf.requiredAmount * 100) : 0}%` }} />
                            </div>
                            {sf.gap > 0 && <p className="text-[9px] text-amber-400 mt-0.5">Gap: {fmt(sf.gap)}</p>}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      )}

      {!plan && cid > 0 && !planQ.isLoading && !planQ.isError && (
        <Card className="bg-card/60 border-accent/10">
          <CardContent className="p-6 text-center">
            <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No plan data found for Client #{cid}.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
