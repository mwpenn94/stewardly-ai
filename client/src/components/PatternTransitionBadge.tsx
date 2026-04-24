/**
 * PatternTransitionBadge — Shows current pattern, readiness score, and transition recommendation.
 * GAP-A2-08: Wires trpc.cadenceEngine.assessTransition and pipelineCoverage.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, TrendingUp, ArrowRight, Target, CheckCircle2, AlertTriangle, BarChart3 } from "lucide-react";

interface PatternTransitionBadgeProps {
  embedded?: boolean;
}

const patternLabels: Record<string, string> = {
  "Pattern 1": "Individual Contributor",
  "Pattern 2": "Team Builder",
  "Pattern 3": "Enterprise Leader",
  "Pattern 4": "Platform Architect",
};

const healthColors: Record<string, string> = {
  healthy: "bg-emerald-500/10 text-emerald-400",
  at_risk: "bg-amber-500/10 text-amber-400",
  critical: "bg-red-500/10 text-red-400",
};

export function PatternTransitionBadge({ embedded }: PatternTransitionBadgeProps) {
  const [assessOpen, setAssessOpen] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [metrics, setMetrics] = useState({
    aumSignedThisMonth: 0,
    dealsAbove500K: 0,
    activeAffiliates: 0,
    newProducersOnboarded: 0,
    totalPipelineValue: 0,
    conversionRate: 0,
    avgDealSize: 0,
    monthlyRecurringRevenue: 0,
  });
  const [coverageInput, setCoverageInput] = useState({
    discoveryValue: 0,
    solutionDesignValue: 0,
    validationValue: 0,
    commitValue: 0,
    targetQuotaValue: 0,
  });

  const assessMutation = trpc.cadenceEngine.assessTransition.useMutation({
    onSuccess: (result) => {
      setLastResult(result);
      toast.success(`Pattern assessment complete: ${result.currentPattern}`);
      setAssessOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const coverage = trpc.cadenceEngine.pipelineCoverage.useQuery(coverageInput, {
    enabled: coverageInput.targetQuotaValue > 0,
  });

  const handleAssess = () => {
    assessMutation.mutate(metrics);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Pattern Transition
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setAssessOpen(true)} className="h-7 text-xs gap-1">
            <Target className="h-3 w-3" /> Assess
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {lastResult ? (
          <>
            <div className="flex items-center gap-3">
              <div>
                <Badge variant="outline" className="text-xs">
                  {lastResult.currentPattern}
                </Badge>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {patternLabels[lastResult.currentPattern] ?? ""}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Readiness: {lastResult.readinessScore}%</p>
                <Progress value={lastResult.readinessScore} className="w-24 h-1.5 mt-1" />
              </div>
            </div>

            <div className="bg-muted/50 rounded-md p-2.5 space-y-1.5">
              <p className="text-xs font-medium">{lastResult.recommendation}</p>
              <p className="text-[10px] text-muted-foreground">{lastResult.rationale}</p>
              {lastResult.nextReviewDate && (
                <p className="text-[10px] text-muted-foreground">
                  Next review: {new Date(lastResult.nextReviewDate).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Gating factors */}
            {lastResult.gatingFactors && lastResult.gatingFactors.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium">Gating Factors</p>
                {lastResult.gatingFactors.map((g: any, i: number) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    {g.met ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{g.factor ?? g.name ?? JSON.stringify(g)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Pipeline coverage */}
            {coverage.data && (
              <div className="pt-2 border-t space-y-1">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-medium">Pipeline Coverage</span>
                  <Badge variant="outline" className={`text-[10px] ${healthColors[coverage.data.coverageHealth] ?? ""}`}>
                    {coverage.data.coverageHealth}
                  </Badge>
                </div>
                <p className="text-xs">
                  Ratio: {coverage.data.coverageRatio?.toFixed(1) ?? "N/A"}x
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-3">
            Click "Assess" to evaluate your pattern transition readiness.
          </p>
        )}
      </CardContent>

      {/* Assessment Dialog */}
      <Dialog open={assessOpen} onOpenChange={setAssessOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pattern Transition Assessment</DialogTitle>
            <DialogDescription>Enter your current metrics to assess transition readiness</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Business Metrics</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["aumSignedThisMonth", "AUM Signed ($)"],
                ["dealsAbove500K", "Deals > $500K"],
                ["activeAffiliates", "Active Affiliates"],
                ["newProducersOnboarded", "New Producers"],
                ["totalPipelineValue", "Pipeline Value ($)"],
                ["conversionRate", "Conversion Rate (%)"],
                ["avgDealSize", "Avg Deal Size ($)"],
                ["monthlyRecurringRevenue", "MRR ($)"],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-0.5">
                  <Label className="text-[10px]">{label}</Label>
                  <Input
                    type="number"
                    value={(metrics as any)[key]}
                    onChange={(e) => setMetrics((p) => ({ ...p, [key]: Number(e.target.value) }))}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground font-medium pt-2">Pipeline Coverage</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["discoveryValue", "Discovery ($)"],
                ["solutionDesignValue", "Solution Design ($)"],
                ["validationValue", "Validation ($)"],
                ["commitValue", "Commit ($)"],
                ["targetQuotaValue", "Target Quota ($)"],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-0.5">
                  <Label className="text-[10px]">{label}</Label>
                  <Input
                    type="number"
                    value={(coverageInput as any)[key]}
                    onChange={(e) => setCoverageInput((p) => ({ ...p, [key]: Number(e.target.value) }))}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssessOpen(false)}>Cancel</Button>
            <Button onClick={handleAssess} disabled={assessMutation.isPending}>
              {assessMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Assess
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
