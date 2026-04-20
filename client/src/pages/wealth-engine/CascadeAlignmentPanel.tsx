/**
 * CascadeAlignmentPanel — Visualizes cascading planning alignment across hierarchies.
 * Shows forward/backward cascade flows, cross-hierarchy alignment, gap analysis,
 * goal-strategy matrix, and execution order.
 */
import { useState, useMemo } from "react";
import { useCascadingPlanning } from "@/hooks/usePlanningHierarchy";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown, ArrowUp, ArrowRight, Target, Layers, AlertTriangle,
  CheckCircle2, XCircle, TrendingUp, TrendingDown, Zap, BarChart3,
  GitBranch, ListOrdered, Shield, ChevronRight, Activity, Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { fmtSm } from "@/lib/format";

interface CascadeAlignmentPanelProps {
  clientId?: number;
  rootNodeId?: number;
}

const HEALTH_COLORS = {
  healthy: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  warning: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  critical: "text-rose-400 bg-rose-500/10 border-rose-500/30",
};

const HEALTH_ICONS = {
  healthy: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
};


export default function CascadeAlignmentPanel({ clientId, rootNodeId }: CascadeAlignmentPanelProps) {
  const [activeTab, setActiveTab] = useState("alignment");
  const {
    alignment, snapshot, goalStrategyMatrix, gapAnalysis, executionOrder,
    isLoading, forwardCascade, deepForwardCascade, backwardCascade, isCascading,
  } = useCascadingPlanning(clientId, rootNodeId);

  if (!clientId && !rootNodeId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Workflow className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Select a client or planning node to view cascading alignment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Health Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <HealthCard
          label="Alignment Score"
          value={alignment?.score ?? 0}
          suffix="/100"
          health={
            (alignment?.score ?? 0) >= 80 ? "healthy"
            : (alignment?.score ?? 0) >= 50 ? "warning" : "critical"
          }
          icon={Target}
        />
        <HealthCard
          label="Cascade Health"
          value={snapshot?.alignmentScore ?? 0}
          suffix="/100"
          health={snapshot?.overallHealth ?? "healthy"}
          icon={Activity}
        />
        <HealthCard
          label="Goals Addressed"
          value={goalStrategyMatrix?.fullyAddressed ?? 0}
          suffix={`/${goalStrategyMatrix?.totalGoals ?? 0}`}
          health={
            (goalStrategyMatrix?.unaddressed ?? 0) === 0 ? "healthy"
            : (goalStrategyMatrix?.unaddressed ?? 0) <= 2 ? "warning" : "critical"
          }
          icon={CheckCircle2}
        />
        <HealthCard
          label="Gap %"
          value={Math.abs(gapAnalysis?.overallGapPercentage ?? 0)}
          suffix="%"
          health={
            Math.abs(gapAnalysis?.overallGapPercentage ?? 0) <= 10 ? "healthy"
            : Math.abs(gapAnalysis?.overallGapPercentage ?? 0) <= 30 ? "warning" : "critical"
          }
          icon={BarChart3}
        />
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="alignment" className="gap-1">
            <GitBranch className="h-3.5 w-3.5" /> Alignment
          </TabsTrigger>
          <TabsTrigger value="cascade" className="gap-1">
            <ArrowDown className="h-3.5 w-3.5" /> Cascade
          </TabsTrigger>
          <TabsTrigger value="matrix" className="gap-1">
            <Layers className="h-3.5 w-3.5" /> Goal Matrix
          </TabsTrigger>
          <TabsTrigger value="gaps" className="gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Gap Analysis
          </TabsTrigger>
          <TabsTrigger value="execution" className="gap-1">
            <ListOrdered className="h-3.5 w-3.5" /> Execution Order
          </TabsTrigger>
        </TabsList>

        {/* Alignment Tab */}
        <TabsContent value="alignment" className="space-y-4">
          <AlignmentView alignment={alignment} />
        </TabsContent>

        {/* Cascade Tab */}
        <TabsContent value="cascade" className="space-y-4">
          <CascadeView
            snapshot={snapshot}
            onForwardCascade={forwardCascade}
            onDeepForwardCascade={deepForwardCascade}
            onBackwardCascade={backwardCascade}
            isCascading={isCascading}
          />
        </TabsContent>

        {/* Goal-Strategy Matrix Tab */}
        <TabsContent value="matrix" className="space-y-4">
          <GoalStrategyMatrixView matrix={goalStrategyMatrix} />
        </TabsContent>

        {/* Gap Analysis Tab */}
        <TabsContent value="gaps" className="space-y-4">
          <GapAnalysisView gapAnalysis={gapAnalysis} />
        </TabsContent>

        {/* Execution Order Tab */}
        <TabsContent value="execution" className="space-y-4">
          <ExecutionOrderView executionOrder={executionOrder} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── HEALTH CARD ────────────────────────────────────────────────────────
function HealthCard({ label, value, suffix, health, icon: Icon }: {
  label: string; value: number; suffix: string;
  health: "healthy" | "warning" | "critical"; icon: React.ElementType;
}) {
  const HealthIcon = HEALTH_ICONS[health];
  return (
    <Card className={`border ${HEALTH_COLORS[health]}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium">{label}</span>
          </div>
          <HealthIcon className="h-3.5 w-3.5" />
        </div>
        <p className="text-2xl font-bold mt-1">
          {value}<span className="text-sm font-normal text-muted-foreground">{suffix}</span>
        </p>
      </CardContent>
    </Card>
  );
}

// ─── ALIGNMENT VIEW ─────────────────────────────────────────────────────
function AlignmentView({ alignment }: { alignment: any }) {
  if (!alignment) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No alignment data available. Create client goals and strategies first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alignment Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cross-Hierarchy Alignment</CardTitle>
          <CardDescription>How well goals, strategies, and implementations are connected</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <Progress value={alignment.score} className="h-2" />
            </div>
            <span className="text-lg font-bold">{alignment.score}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Issues Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {alignment.unaddressedGoals?.length > 0 && (
          <IssueCard
            title="Unaddressed Goals"
            icon={Target}
            color="rose"
            items={alignment.unaddressedGoals.map((g: any) => `${g.goalName} (${g.category})`)}
          />
        )}
        {alignment.orphanedStrategies?.length > 0 && (
          <IssueCard
            title="Orphaned Strategies"
            icon={Zap}
            color="amber"
            items={alignment.orphanedStrategies.map((s: any) => s.label)}
          />
        )}
        {alignment.disconnectedImplementations?.length > 0 && (
          <IssueCard
            title="Disconnected Implementations"
            icon={AlertTriangle}
            color="amber"
            items={alignment.disconnectedImplementations.map((i: any) => i.label)}
          />
        )}
        {alignment.underfundedGoals?.length > 0 && (
          <IssueCard
            title="Underfunded Goals"
            icon={TrendingDown}
            color="rose"
            items={alignment.underfundedGoals.map((g: any) =>
              `${g.goalName}: gap ${fmtSm(g.gap)}`
            )}
          />
        )}
        {alignment.conflictingGoals?.length > 0 && (
          <IssueCard
            title="Conflicting Goals"
            icon={XCircle}
            color="rose"
            items={alignment.conflictingGoals.map((c: any) =>
              `${c.goalA.name} ↔ ${c.goalB.name}`
            )}
          />
        )}
      </div>

      {/* Recommendations */}
      {alignment.recommendations?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alignment.recommendations.map((rec: string, i: number) => (
              <div key={i} className="flex gap-2 text-sm">
                <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-muted-foreground">{rec}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All clear state */}
      {alignment.score >= 90 && alignment.recommendations?.length === 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-emerald-400">All goals, strategies, and implementations are well-aligned.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function IssueCard({ title, icon: Icon, color, items }: {
  title: string; icon: React.ElementType; color: string; items: string[];
}) {
  const colorClasses = color === "rose"
    ? "border-rose-500/30 bg-rose-500/5"
    : "border-amber-500/30 bg-amber-500/5";
  const iconColor = color === "rose" ? "text-rose-400" : "text-amber-400";
  return (
    <Card className={colorClasses}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="outline" className="ml-auto text-xs">{items.length}</Badge>
        </div>
        <ul className="space-y-1">
          {items.slice(0, 5).map((item, i) => (
            <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
              <span className="text-muted-foreground/50">•</span> {item}
            </li>
          ))}
          {items.length > 5 && (
            <li className="text-xs text-muted-foreground/50">+{items.length - 5} more</li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── CASCADE VIEW ───────────────────────────────────────────────────────
function CascadeView({ snapshot, onForwardCascade, onDeepForwardCascade, onBackwardCascade, isCascading }: {
  snapshot: any;
  onForwardCascade: (input: any) => Promise<any>;
  onDeepForwardCascade: (input: any) => Promise<any>;
  onBackwardCascade: (input: any) => Promise<any>;
  isCascading: boolean;
}) {
  const [cascadeTarget, setCascadeTarget] = useState("");
  const [cascadeStrategy, setCascadeStrategy] = useState("proportional");

  if (!snapshot) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <ArrowDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a root planning node to view cascade structure.</p>
        </CardContent>
      </Card>
    );
  }

  const handleForwardCascade = async () => {
    const target = parseFloat(cascadeTarget);
    if (isNaN(target) || target <= 0) {
      toast.error("Enter a valid target amount.");
      return;
    }
    try {
      const result = await onDeepForwardCascade({
        rootNodeId: snapshot.root.id,
        newTarget: target,
        allocationStrategy: cascadeStrategy,
      });
      toast.success(`Cascaded to ${result.totalNodesUpdated} nodes across ${result.levelsProcessed} levels.`);
    } catch (err: any) {
      toast.error(err.message ?? "Cascade failed.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Root Node */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Hierarchy Root</CardTitle>
            <Badge className={HEALTH_COLORS[snapshot.overallHealth as keyof typeof HEALTH_COLORS]}>
              {snapshot.overallHealth}
            </Badge>
          </div>
          <CardDescription>
            {snapshot.totalNodes} nodes | Alignment: {snapshot.alignmentScore}%
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CascadeNodeCard node={snapshot.root} isRoot />
        </CardContent>
      </Card>

      {/* Forward Cascade Controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowDown className="h-4 w-4 text-blue-400" /> Forward Cascade (Roll-Down)
          </CardTitle>
          <CardDescription>
            Set a target at the root and distribute proportionally to all descendants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label htmlFor="cascade-target" className="text-xs">New Target ($)</Label>
              <Input
                id="cascade-target"
                type="number"
                placeholder="e.g., 10000000"
                value={cascadeTarget}
                onChange={(e) => setCascadeTarget(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
              <Label htmlFor="cascade-strategy" className="text-xs">Strategy</Label>
              <Select value={cascadeStrategy} onValueChange={setCascadeStrategy}>
                <SelectTrigger id="cascade-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proportional">Proportional</SelectItem>
                  <SelectItem value="equal">Equal</SelectItem>
                  <SelectItem value="weighted">Performance-Weighted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleForwardCascade} disabled={isCascading} className="gap-1">
                <ArrowDown className="h-3.5 w-3.5" />
                {isCascading ? "Cascading..." : "Cascade Down"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Children */}
      {snapshot.children?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Direct Children ({snapshot.children.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.children.map((child: any) => (
              <CascadeNodeCard key={child.id} node={child} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CascadeNodeCard({ node, isRoot }: { node: any; isRoot?: boolean }) {
  const HealthIcon = HEALTH_ICONS[node.cascadeHealth as keyof typeof HEALTH_ICONS] ?? CheckCircle2;
  const progressPct = node.forwardTarget > 0
    ? Math.min(100, (node.currentValue / node.forwardTarget) * 100) : 0;

  return (
    <div className={`rounded-lg border p-3 ${isRoot ? "bg-muted/30" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize">{node.level}</Badge>
          <span className="text-sm font-medium">{node.label ?? "Unnamed"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={HEALTH_COLORS[node.cascadeHealth as keyof typeof HEALTH_COLORS] ?? ""}>
            <HealthIcon className="h-3 w-3 mr-1" />
            {node.cascadeHealth}
          </Badge>
          <Badge variant="outline" className={`text-xs capitalize ${
            node.alignmentStatus === "aligned" ? "text-emerald-400"
            : node.alignmentStatus === "under_allocated" ? "text-amber-400"
            : "text-rose-400"
          }`}>
            {node.alignmentStatus?.replace("_", " ")}
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Target</span>
          <p className="font-medium">{fmtSm(node.forwardTarget)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Current</span>
          <p className="font-medium">{fmtSm(node.currentValue)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Gap</span>
          <p className={`font-medium ${node.gap > 0 ? "text-rose-400" : "text-emerald-400"}`}>
            {node.gap > 0 ? "-" : "+"}{fmtSm(Math.abs(node.gap))}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Children</span>
          <p className="font-medium">{node.childCount}</p>
        </div>
      </div>
      <div className="mt-2">
        <Progress value={progressPct} className="h-1.5" />
        <p className="text-xs text-muted-foreground mt-1">{Math.round(progressPct)}% of target</p>
      </div>
    </div>
  );
}

// ─── GOAL-STRATEGY MATRIX VIEW ──────────────────────────────────────────
function GoalStrategyMatrixView({ matrix }: { matrix: any }) {
  if (!matrix || matrix.totalGoals === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No goals defined yet. Create client goals to see the strategy matrix.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{matrix.fullyAddressed}</p>
            <p className="text-xs text-muted-foreground">Fully Addressed</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{matrix.partiallyAddressed}</p>
            <p className="text-xs text-muted-foreground">Partially Addressed</p>
          </CardContent>
        </Card>
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-rose-400">{matrix.unaddressed}</p>
            <p className="text-xs text-muted-foreground">Unaddressed</p>
          </CardContent>
        </Card>
      </div>

      {/* Goal Cards with Strategy Nesting */}
      {matrix.goals.map((goal: any) => (
        <Card key={goal.id} className={
          goal.coveragePercent >= 90 ? "border-emerald-500/20"
          : goal.coveragePercent > 0 ? "border-amber-500/20"
          : "border-rose-500/20"
        }>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{goal.name}</span>
                <Badge variant="outline" className="text-xs capitalize">{goal.category}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {fmtSm(goal.current)} / {fmtSm(goal.target)}
                </span>
                <Badge className={
                  goal.coveragePercent >= 90 ? "bg-emerald-500/20 text-emerald-400"
                  : goal.coveragePercent > 0 ? "bg-amber-500/20 text-amber-400"
                  : "bg-rose-500/20 text-rose-400"
                }>
                  {goal.coveragePercent}%
                </Badge>
              </div>
            </div>
            <Progress value={goal.coveragePercent} className="h-1.5 mb-3" />

            {/* Strategies */}
            {goal.strategies.length > 0 ? (
              <div className="space-y-2 ml-4 border-l border-border pl-3">
                {goal.strategies.map((strategy: any) => (
                  <div key={strategy.nodeId}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ArrowRight className="h-3 w-3 text-indigo-400" />
                        <span className="text-xs font-medium">{strategy.label}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{strategy.status}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{fmtSm(strategy.contribution)}</span>
                    </div>
                    {/* Implementations */}
                    {strategy.implementations.length > 0 && (
                      <div className="ml-4 mt-1 space-y-1">
                        {strategy.implementations.map((impl: any) => (
                          <div key={impl.nodeId} className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <ChevronRight className="h-2.5 w-2.5" />
                              <span>{impl.label}</span>
                            </div>
                            <span>{fmtSm(impl.value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground ml-4 italic">No strategies linked to this goal.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── GAP ANALYSIS VIEW ─────────────────────────────────────────────────
function GapAnalysisView({ gapAnalysis }: { gapAnalysis: any }) {
  if (!gapAnalysis || gapAnalysis.levels?.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No gap analysis data. Build a planning hierarchy first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Multi-Level Gap Analysis</CardTitle>
          <CardDescription>
            Overall gap: {fmtSm(gapAnalysis.overallGap)} ({gapAnalysis.overallGapPercentage}%)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress
            value={Math.max(0, 100 - Math.abs(gapAnalysis.overallGapPercentage))}
            className="h-2"
          />
        </CardContent>
      </Card>

      {/* Per-Level Breakdown */}
      {gapAnalysis.levels.map((level: any) => (
        <Card key={level.level}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs capitalize">{level.level}</Badge>
                <span className="text-sm font-medium">{level.nodeCount} node{level.nodeCount !== 1 ? "s" : ""}</span>
              </div>
              <span className={`text-sm font-medium ${
                level.gapPercentage <= 10 ? "text-emerald-400"
                : level.gapPercentage <= 30 ? "text-amber-400"
                : "text-rose-400"
              }`}>
                {level.gapPercentage > 0 ? "-" : ""}{Math.abs(level.gapPercentage)}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs mb-2">
              <div>
                <span className="text-muted-foreground">Target</span>
                <p className="font-medium">{fmtSm(level.totalTarget)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Current</span>
                <p className="font-medium">{fmtSm(level.totalCurrent)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Gap</span>
                <p className={`font-medium ${level.totalGap > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {fmtSm(Math.abs(level.totalGap))}
                </p>
              </div>
            </div>
            {/* Health Distribution */}
            <div className="flex gap-1 mt-1">
              {level.healthDistribution.healthy > 0 && (
                <div
                  className="h-1.5 rounded-full bg-emerald-500"
                  style={{ flex: level.healthDistribution.healthy }}
                  title={`${level.healthDistribution.healthy} healthy`}
                />
              )}
              {level.healthDistribution.warning > 0 && (
                <div
                  className="h-1.5 rounded-full bg-amber-500"
                  style={{ flex: level.healthDistribution.warning }}
                  title={`${level.healthDistribution.warning} warning`}
                />
              )}
              {level.healthDistribution.critical > 0 && (
                <div
                  className="h-1.5 rounded-full bg-rose-500"
                  style={{ flex: level.healthDistribution.critical }}
                  title={`${level.healthDistribution.critical} critical`}
                />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── EXECUTION ORDER VIEW ───────────────────────────────────────────────
function ExecutionOrderView({ executionOrder }: { executionOrder: any }) {
  if (!executionOrder || executionOrder.orderedGoals?.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <ListOrdered className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No goals to order. Create client goals with dependencies to see execution phases.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Phase Timeline */}
      {executionOrder.phases.map((phase: any) => (
        <Card key={phase.phase}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/20 text-primary">Phase {phase.phase}</Badge>
              <CardTitle className="text-base">{phase.goalIds.length} Goal{phase.goalIds.length !== 1 ? "s" : ""}</CardTitle>
            </div>
            <CardDescription>{phase.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {executionOrder.orderedGoals
              .filter((g: any) => g.phase === phase.phase)
              .map((goal: any) => (
                <div key={goal.id} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{goal.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{goal.category} • {goal.estimatedDuration}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {goal.dependencies.length > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {goal.dependencies.length} dep{goal.dependencies.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {goal.conflicts.length > 0 && (
                      <Badge variant="outline" className="text-[10px] text-rose-400 border-rose-500/30">
                        {goal.conflicts.length} conflict{goal.conflicts.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">P{goal.priority}</Badge>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
