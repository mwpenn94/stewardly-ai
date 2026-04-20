/**
 * PlanningHierarchyPanel — Unified hierarchical planning view for the Wealth Engine.
 * Displays the forward/backward, roll-up/roll-down planning tree with gap analysis,
 * goal management, PFR lifecycle, and rich references.
 */
import { useState, useMemo } from "react";
import {
  usePlanningHierarchy,
  useAdvisorPlanning,
  type PlanningLevel,
  type GoalCategory,
} from "@/hooks/usePlanningHierarchy";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ChevronRight, ChevronLeft, Home, Target, TrendingUp, TrendingDown,
  Minus, FileText, BookOpen, Settings2, Plus, ArrowUpRight, ArrowDownRight,
  Layers, Users, Building2, User, Crosshair, Lightbulb, Wrench,
  Shield, GraduationCap, Heart, DollarSign, Briefcase, GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { fmt, pct } from "@/lib/format";
import CascadeAlignmentPanel from "./CascadeAlignmentPanel";

const LEVEL_ICONS: Record<PlanningLevel, React.ElementType> = {
  platform: Building2,
  region: Layers,
  team: Users,
  advisor: User,
  client: User,
  goal: Target,
  strategy: Lightbulb,
  implementation: Wrench,
};

const LEVEL_COLORS: Record<PlanningLevel, string> = {
  platform: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  region: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  team: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  advisor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  client: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  goal: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  strategy: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  implementation: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

const GOAL_ICONS: Partial<Record<GoalCategory, React.ElementType>> = {
  protection: Shield,
  retirement: TrendingUp,
  estate: Building2,
  tax: DollarSign,
  education: GraduationCap,
  healthcare: Heart,
  business: Briefcase,
};

const TREND_ICON: Record<string, React.ElementType> = {
  improving: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
};

const TREND_COLOR: Record<string, string> = {
  improving: "text-emerald-400",
  stable: "text-slate-400",
  declining: "text-rose-400",
};

// formatCurrency → fmt(), formatPct → pctVal() from @/lib/format
// PlanningHierarchy passes string|number|null so we wrap with coercion
const fmtVal = (val: string | number | null | undefined) =>
  fmt(val == null ? null : typeof val === 'string' ? parseFloat(val) : val);
const pctVal = (val: string | number | null | undefined) => {
  if (val == null) return '—';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(n) ? '—' : `${n.toFixed(1)}%`;
};

// ─── Node Card ──────────────────────────────────────────────────────────

function NodeCard({
  node,
  onDrillDown,
  compact = false,
}: {
  node: any;
  onDrillDown: (id: number) => void;
  compact?: boolean;
}) {
  const level = node.level as PlanningLevel;
  const Icon = LEVEL_ICONS[level] ?? Layers;
  const colorClass = LEVEL_COLORS[level] ?? LEVEL_COLORS.implementation;
  const trend = node.nodeTrend ?? "stable";
  const TrendIcon = TREND_ICON[trend] ?? Minus;
  const trendColor = TREND_COLOR[trend] ?? "text-slate-400";

  const current = Number(node.currentValue ?? 0);
  const target = Number(node.forwardTarget ?? 0);
  const progressPct = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <Card
      className={`cursor-pointer hover:border-primary/40 transition-all group ${compact ? "p-3" : ""}`}
      onClick={() => onDrillDown(node.id)}
    >
      <CardContent className={compact ? "p-0" : "pt-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-md border ${colorClass}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{node.label || `${level} node`}</p>
              <p className="text-xs text-muted-foreground capitalize">{level}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TrendIcon className={`h-4 w-4 ${trendColor}`} />
            <Badge variant="outline" className="text-xs">
              {node.nodeStatus ?? "draft"}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {!compact && target > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{fmtVal(current)} current</span>
              <span>{fmtVal(target)} target</span>
            </div>
            <Progress value={progressPct} className="h-1.5" />
            <div className="flex justify-between text-xs">
              <span className={progressPct >= 80 ? "text-emerald-400" : progressPct >= 50 ? "text-amber-400" : "text-rose-400"}>
                {progressPct.toFixed(0)}% funded
              </span>
              {node.probabilityOfSuccess && (
                <span className="text-muted-foreground">
                  {pctVal(node.probabilityOfSuccess)} probability
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Gap Analysis Card ──────────────────────────────────────────────────

function GapAnalysisCard({ gapAnalysis }: { gapAnalysis: NonNullable<ReturnType<typeof usePlanningHierarchy>["gapAnalysis"]> }) {
  const { current, target, gap, percentage, trend } = gapAnalysis;
  const isPositive = gap <= 0;
  const TrendIcon = TREND_ICON[trend ?? "stable"] ?? Minus;
  const trendColor = TREND_COLOR[trend ?? "stable"] ?? "text-slate-400";

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Gap Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-lg font-semibold">{fmtVal(current)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Target</p>
            <p className="text-lg font-semibold">{fmtVal(target)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gap</p>
            <p className={`text-lg font-semibold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
              {isPositive ? (
                <span className="flex items-center justify-center gap-1">
                  <ArrowUpRight className="h-4 w-4" />
                  Funded
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1">
                  <ArrowDownRight className="h-4 w-4" />
                  {fmtVal(Math.abs(gap))}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendIcon className={`h-3 w-3 ${trendColor}`} />
            {trend ?? "stable"} trend
          </span>
          <span>{pctVal(percentage)} gap ratio</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Roll-Up Summary Card ───────────────────────────────────────────────

function RollUpCard({ rollUp }: { rollUp: { total: number; count: number } }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Roll-Up Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Aggregated Value</p>
            <p className="text-lg font-semibold">{fmtVal(rollUp.total)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Child Nodes</p>
            <p className="text-lg font-semibold">{rollUp.count}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────────

export default function PlanningHierarchyPanel() {
  const {
    selectedNodeId, breadcrumb, isLoading, currentLevel, gapAnalysis,
    rootNodes, selectedNode, childNodes, rollUp,
    drillDown, drillUp, jumpTo, createNode,
  } = usePlanningHierarchy();

  const { goals, pfrs } = useAdvisorPlanning();
  const [activeTab, setActiveTab] = useState("tree");

  // Build breadcrumb labels
  const breadcrumbLabels = useMemo(() => {
    const labels: { id: number | null; label: string }[] = [{ id: null, label: "Root" }];
    // We only have IDs in breadcrumb, so show level abbreviations
    for (const id of breadcrumb) {
      labels.push({ id, label: `Node ${id}` });
    }
    if (selectedNodeId && selectedNode) {
      labels.push({ id: selectedNodeId, label: selectedNode.label || `${selectedNode.level}` });
    }
    return labels;
  }, [breadcrumb, selectedNodeId, selectedNode]);

  const handleCreateRootNode = async () => {
    try {
      await createNode({
        level: "advisor",
        entityType: "advisor",
        entityId: 0,
        label: "My Practice Plan",
        status: "draft",
      });
      toast.success("Planning node created — your practice plan root node is ready.");
    } catch {
      toast.error("Failed to create planning node.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1 text-sm flex-wrap">
        {breadcrumbLabels.map((item, idx) => (
          <span key={idx} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <button
              onClick={() => jumpTo(item.id)}
              className={`hover:text-primary transition-colors ${
                idx === breadcrumbLabels.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              {idx === 0 ? <Home className="h-3.5 w-3.5" /> : item.label}
            </button>
          </span>
        ))}
      </div>

      {/* Back Button */}
      {selectedNodeId && (
        <Button variant="ghost" size="sm" onClick={drillUp} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
      )}

      {/* Selected Node Detail */}
      {selectedNode && (
        <div className="space-y-4">
          <Card className="border-primary/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = LEVEL_ICONS[currentLevel ?? "implementation"];
                    const colorClass = LEVEL_COLORS[currentLevel ?? "implementation"];
                    return (
                      <div className={`p-2 rounded-lg border ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    );
                  })()}
                  <div>
                    <CardTitle>{selectedNode.label || "Untitled Node"}</CardTitle>
                    <CardDescription className="capitalize">{currentLevel} level</CardDescription>
                  </div>
                </div>
                <Badge variant="outline">{selectedNode.nodeStatus ?? "draft"}</Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Gap Analysis + Roll-Up */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gapAnalysis && <GapAnalysisCard gapAnalysis={gapAnalysis} />}
            {rollUp && <RollUpCard rollUp={rollUp} />}
          </div>
        </div>
      )}

      {/* Tabs: Tree / Goals / PFRs / Assumptions */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tree" className="gap-1">
            <Layers className="h-3.5 w-3.5" /> Tree
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-1">
            <Target className="h-3.5 w-3.5" /> Goals
          </TabsTrigger>
          <TabsTrigger value="pfrs" className="gap-1">
            <FileText className="h-3.5 w-3.5" /> PFRs
          </TabsTrigger>
          <TabsTrigger value="assumptions" className="gap-1">
            <Settings2 className="h-3.5 w-3.5" /> Assumptions
          </TabsTrigger>
          <TabsTrigger value="cascade" className="gap-1">
            <GitBranch className="h-3.5 w-3.5" /> Cascade
          </TabsTrigger>
        </TabsList>

        {/* Tree Tab */}
        <TabsContent value="tree" className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : selectedNodeId ? (
            childNodes.length > 0 ? (
              <div className="space-y-2">
                {childNodes.map(node => (
                  <NodeCard key={node.id} node={node} onDrillDown={drillDown} />
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p className="text-sm">No child nodes yet.</p>
                  <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={() => {
                    toast.info("Add child node wizard is under development.");
                  }}>
                    <Plus className="h-3.5 w-3.5" /> Add Child Node
                  </Button>
                </CardContent>
              </Card>
            )
          ) : rootNodes.length > 0 ? (
            <div className="space-y-2">
              {rootNodes.map(node => (
                <NodeCard key={node.id} node={node} onDrillDown={drillDown} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  No planning hierarchy yet. Create your first practice plan node to get started.
                </p>
                <Button onClick={handleCreateRootNode} className="gap-1">
                  <Plus className="h-4 w-4" /> Create Practice Plan
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals" className="space-y-3">
          {goals.length > 0 ? (
            goals.map((goal: any) => {
              const GoalIcon = GOAL_ICONS[goal.goalCategory as GoalCategory] ?? Target;
              return (
                <Card key={goal.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <GoalIcon className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{goal.goalName}</p>
                          <p className="text-xs text-muted-foreground capitalize">{goal.goalCategory?.replace("_", " ")}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {goal.goalStatus?.replace("_", " ") ?? "identified"}
                      </Badge>
                    </div>
                    {(goal.targetAmount || goal.currentAmount) && (
                      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                        <span>Current: {fmtVal(goal.currentAmount)}</span>
                        <span>Target: {fmtVal(goal.targetAmount)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No client goals defined yet.</p>
                <p className="text-xs mt-1">Goals are created through the client planning workflow.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* PFRs Tab */}
        <TabsContent value="pfrs" className="space-y-3">
          {pfrs.length > 0 ? (
            pfrs.map((pfr: any) => (
              <Card key={pfr.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium capitalize">{pfr.reviewType?.replace("_", " ")} Review</p>
                        <p className="text-xs text-muted-foreground">
                          {pfr.reviewDate ? new Date(pfr.reviewDate).toLocaleDateString() : "No date"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        pfr.complianceReviewStatus === "approved" ? "text-emerald-400 border-emerald-500/30" :
                        pfr.complianceReviewStatus === "flagged" ? "text-rose-400 border-rose-500/30" :
                        "text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {pfr.complianceReviewStatus ?? "pending"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No Personal Financial Reviews yet.</p>
                <p className="text-xs mt-1">PFRs are generated during client annual reviews.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Assumptions Tab */}
        <TabsContent value="assumptions">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                Planning Assumptions
              </CardTitle>
              <CardDescription>
                Assumptions cascade: Platform → Firm → Advisor → Client.
                Lower-scope values override higher-scope defaults.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Inflation Rate</p>
                  <p className="font-medium">3.0% <span className="text-xs text-muted-foreground">(platform default)</span></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Equity Return</p>
                  <p className="font-medium">7.0% <span className="text-xs text-muted-foreground">(platform default)</span></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bond Return</p>
                  <p className="font-medium">4.0% <span className="text-xs text-muted-foreground">(platform default)</span></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Risk-Free Rate</p>
                  <p className="font-medium">4.5% <span className="text-xs text-muted-foreground">(FRED API)</span></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estate Exemption</p>
                  <p className="font-medium">$13.61M <span className="text-xs text-muted-foreground">(2024)</span></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">SOFR Rate</p>
                  <p className="font-medium">5.33% <span className="text-xs text-muted-foreground">(FRED API)</span></p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-4 gap-1" onClick={() => {
                toast.info("Assumption editor with FRED API auto-refresh is under development.");
              }}>
                <Settings2 className="h-3.5 w-3.5" /> Edit Assumptions
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cascade Alignment Tab */}
        <TabsContent value="cascade">
          <CascadeAlignmentPanel clientId={undefined} rootNodeId={selectedNodeId ?? undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
