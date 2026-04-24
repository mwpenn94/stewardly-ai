/**
 * MeddpiccScorecard — Visual MEDDPICC scorecard for lead detail.
 * GAP-A2-06: Shows 8 MEDDPICC fields with scores, tier, focus areas, stage recommendation.
 * Wires trpc.cadenceEngine.getMeddpicc, updateMeddpicc, getMeddpiccFocusAreas.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Target, TrendingUp, AlertTriangle, CheckCircle2, Edit3, Save } from "lucide-react";

interface MeddpiccScorecardProps {
  leadId: number;
}

const FIELDS = [
  { key: "metrics", label: "Metrics", abbr: "M", color: "bg-blue-500" },
  { key: "economicBuyer", label: "Economic Buyer", abbr: "E", color: "bg-emerald-500" },
  { key: "decisionCriteria", label: "Decision Criteria", abbr: "D", color: "bg-purple-500" },
  { key: "decisionProcess", label: "Decision Process", abbr: "D", color: "bg-indigo-500" },
  { key: "paperProcess", label: "Paper Process", abbr: "P", color: "bg-amber-500" },
  { key: "identifyPain", label: "Identify Pain", abbr: "I", color: "bg-red-500" },
  { key: "champion", label: "Champion", abbr: "C", color: "bg-cyan-500" },
  { key: "competition", label: "Competition", abbr: "C", color: "bg-orange-500" },
] as const;

const tierColors: Record<string, string> = {
  "Tier 1": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Tier 2": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Tier 3": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Hold: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function MeddpiccScorecard({ leadId }: MeddpiccScorecardProps) {
  const [editing, setEditing] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});

  const utils = trpc.useUtils();
  const meddpicc = trpc.cadenceEngine.getMeddpicc.useQuery({ leadId });
  const focusAreas = trpc.cadenceEngine.getMeddpiccFocusAreas.useQuery({ leadId });

  const updateMutation = trpc.cadenceEngine.updateMeddpicc.useMutation({
    onSuccess: (result) => {
      toast.success(`MEDDPICC updated — ${result.tier} (${result.composite}%)`);
      utils.cadenceEngine.getMeddpicc.invalidate({ leadId });
      utils.cadenceEngine.getMeddpiccFocusAreas.invalidate({ leadId });
      setEditing(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const data = meddpicc.data;
  const focus = focusAreas.data;

  const startEditing = () => {
    if (data) {
      const initial: Record<string, number> = {};
      FIELDS.forEach((f) => {
        initial[f.key] = Number((data as any)[f.key]) || 0;
      });
      setScores(initial);
    } else {
      const initial: Record<string, number> = {};
      FIELDS.forEach((f) => { initial[f.key] = 0; });
      setScores(initial);
    }
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      leadId,
      metrics: scores.metrics ?? 0,
      economicBuyer: scores.economicBuyer ?? 0,
      decisionCriteria: scores.decisionCriteria ?? 0,
      decisionProcess: scores.decisionProcess ?? 0,
      paperProcess: scores.paperProcess ?? 0,
      identifyPain: scores.identifyPain ?? 0,
      champion: scores.champion ?? 0,
      competition: scores.competition ?? 0,
    });
  };

  const compositeScore = useMemo(() => {
    if (!data) return 0;
    const sum = FIELDS.reduce((acc, f) => acc + (Number((data as any)[f.key]) || 0), 0);
    return Math.round((sum / 8) * 10);
  }, [data]);

  if (meddpicc.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">MEDDPICC Scorecard</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            MEDDPICC Scorecard
          </CardTitle>
          <div className="flex items-center gap-2">
            {data && (
              <Badge variant="outline" className={tierColors[(data as any).tier] ?? ""}>
                {(data as any).tier ?? "Unscored"}
              </Badge>
            )}
            {!editing ? (
              <Button variant="outline" size="sm" onClick={startEditing} className="h-7 text-xs gap-1">
                <Edit3 className="h-3 w-3" /> {data ? "Edit" : "Score"}
              </Button>
            ) : (
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="h-7 text-xs gap-1">
                {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Composite score */}
        {data && (
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold">{compositeScore}%</div>
            <Progress value={compositeScore} className="flex-1" />
          </div>
        )}

        {/* Field scores */}
        <div className="space-y-2">
          {FIELDS.map((field) => {
            const val = editing ? (scores[field.key] ?? 0) : (data ? Number((data as any)[field.key]) || 0 : 0);
            return (
              <div key={field.key} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white ${field.color}`}>
                  {field.abbr}
                </div>
                <span className="text-xs w-28 truncate">{field.label}</span>
                {editing ? (
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={scores[field.key] ?? 0}
                    onChange={(e) => setScores((prev) => ({ ...prev, [field.key]: Math.min(10, Math.max(0, Number(e.target.value))) }))}
                    className="h-7 w-16 text-xs text-center"
                  />
                ) : (
                  <>
                    <Progress value={val * 10} className="flex-1 h-1.5" />
                    <span className="text-xs font-medium w-6 text-right">{val}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Focus areas */}
        {focus && !editing && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Focus Areas</p>
            {(focus.focusAreas ?? []).map((area: any, i: number) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                <span>{typeof area === "string" ? area : area.field ?? area.recommendation ?? JSON.stringify(area)}</span>
              </div>
            ))}
            {focus.stageRecommendation && (
              <div className="flex items-center gap-1.5 text-xs mt-1">
                <TrendingUp className="h-3 w-3 text-primary" />
                <span className="font-medium">Stage: {focus.stageRecommendation}</span>
              </div>
            )}
          </div>
        )}

        {!data && !editing && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No MEDDPICC data yet. Click "Score" to begin.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
