/**
 * RecruitScoringPanel — 6-dimension recruit scoring form + radar visualization.
 * GAP-A2-10: Wires trpc.cadenceEngine.scoreRecruit.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Users, Target, TrendingUp, Star, Shield, Zap } from "lucide-react";

interface RecruitScoringPanelProps {
  embedded?: boolean;
}

const DIMENSIONS = [
  { key: "productionFit", label: "Production Fit", icon: TrendingUp, color: "#3b82f6" },
  { key: "culturalFit", label: "Cultural Fit", icon: Users, color: "#8b5cf6" },
  { key: "geographicFit", label: "Geographic Fit", icon: Target, color: "#10b981" },
  { key: "networkLeverage", label: "Network Leverage", icon: Zap, color: "#f59e0b" },
  { key: "compliancePosture", label: "Compliance Posture", icon: Shield, color: "#ef4444" },
  { key: "engagementSignal", label: "Engagement Signal", icon: Star, color: "#06b6d4" },
] as const;

const tierColors: Record<string, string> = {
  "Tier 1": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Tier 2": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Tier 3": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Hold: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function RecruitScoringPanel({ embedded }: RecruitScoringPanelProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [form, setForm] = useState({
    leadId: 0,
    candidateName: "",
    candidateCurrentFirm: "",
    candidateCredentials: "",
    candidateGeography: "",
    candidateLinkedinData: "",
    candidateBrokercheckData: "",
    candidateEngagementHistory: "",
    candidateReferralSource: "",
  });

  const scoreMutation = trpc.cadenceEngine.scoreRecruit.useMutation({
    onSuccess: (result) => {
      setResults((prev) => [{ ...result, candidateName: form.candidateName, timestamp: Date.now() }, ...prev]);
      toast.success(`${form.candidateName} scored: ${result.tier} (${result.compositeScore}%)`);
      setFormOpen(false);
      setForm((p) => ({ ...p, candidateName: "", candidateCurrentFirm: "" }));
    },
    onError: (err) => toast.error(err.message),
  });

  const handleScore = () => {
    if (!form.candidateName.trim()) {
      toast.error("Please enter candidate name");
      return;
    }
    scoreMutation.mutate({
      ...form,
      leadId: form.leadId || 0,
    });
  };

  // SVG radar chart
  const RadarChart = ({ scores }: { scores: Record<string, { score: number }> }) => {
    const size = 120;
    const center = size / 2;
    const radius = 45;
    const dims = DIMENSIONS.map((d, i) => {
      const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
      const val = (scores[d.key]?.score ?? 0) / 10;
      return {
        ...d,
        angle,
        x: center + Math.cos(angle) * radius * val,
        y: center + Math.sin(angle) * radius * val,
        labelX: center + Math.cos(angle) * (radius + 12),
        labelY: center + Math.sin(angle) * (radius + 12),
      };
    });
    const points = dims.map((d) => `${d.x},${d.y}`).join(" ");

    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[180px] mx-auto">
        {/* Grid circles */}
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <circle key={r} cx={center} cy={center} r={radius * r} fill="none" stroke="currentColor" strokeOpacity={0.1} />
        ))}
        {/* Grid lines */}
        {dims.map((d, i) => (
          <line key={i} x1={center} y1={center} x2={center + Math.cos(d.angle) * radius} y2={center + Math.sin(d.angle) * radius} stroke="currentColor" strokeOpacity={0.1} />
        ))}
        {/* Data polygon */}
        <polygon points={points} fill="hsl(var(--primary))" fillOpacity={0.15} stroke="hsl(var(--primary))" strokeWidth={1.5} />
        {/* Data points */}
        {dims.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={2.5} fill={d.color} />
        ))}
      </svg>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Recruit Scoring
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)} className="h-7 text-xs gap-1">
            <Target className="h-3 w-3" /> Score Candidate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.length > 0 ? (
          <div className="space-y-3">
            {results.slice(0, 3).map((r, idx) => (
              <div key={idx} className="bg-muted/50 rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{r.candidateName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{r.compositeScore}%</span>
                    <Badge variant="outline" className={tierColors[r.tier] ?? ""}>
                      {r.tier}
                    </Badge>
                  </div>
                </div>
                {r.scores && <RadarChart scores={r.scores} />}
                <div className="grid grid-cols-3 gap-1.5">
                  {DIMENSIONS.map((d) => {
                    const val = r.scores?.[d.key]?.score ?? 0;
                    return (
                      <div key={d.key} className="text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="text-muted-foreground truncate">{d.label}</span>
                        </div>
                        <Progress value={val * 10} className="h-1 mt-0.5" />
                      </div>
                    );
                  })}
                </div>
                {r.cascadePotential && (
                  <div className="text-xs text-muted-foreground pt-1 border-t">
                    <span className="font-medium">Cascade: </span>
                    {r.cascadePotential.estimatedColleaguesUnlockable ?? 0} colleagues unlockable
                  </div>
                )}
                {r.priorityActions && r.priorityActions.length > 0 && (
                  <div className="text-xs space-y-0.5">
                    <span className="text-muted-foreground font-medium">Priority Actions:</span>
                    {r.priorityActions.slice(0, 3).map((a: string, i: number) => (
                      <p key={i} className="text-muted-foreground">• {a}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-3">
            No candidates scored yet. Click "Score Candidate" to begin.
          </p>
        )}
      </CardContent>

      {/* Scoring Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Score Recruit Candidate</DialogTitle>
            <DialogDescription>Enter candidate data for 6-dimension scoring</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Candidate Name *</Label>
                <Input
                  value={form.candidateName}
                  onChange={(e) => setForm((p) => ({ ...p, candidateName: e.target.value }))}
                  placeholder="Full name"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Current Firm</Label>
                <Input
                  value={form.candidateCurrentFirm}
                  onChange={(e) => setForm((p) => ({ ...p, candidateCurrentFirm: e.target.value }))}
                  placeholder="Firm name"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Geography</Label>
                <Input
                  value={form.candidateGeography}
                  onChange={(e) => setForm((p) => ({ ...p, candidateGeography: e.target.value }))}
                  placeholder="City, State"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Credentials</Label>
                <Input
                  value={form.candidateCredentials}
                  onChange={(e) => setForm((p) => ({ ...p, candidateCredentials: e.target.value }))}
                  placeholder="CFP, CFA, Series 7, etc."
                  className="text-sm"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Referral Source</Label>
                <Input
                  value={form.candidateReferralSource}
                  onChange={(e) => setForm((p) => ({ ...p, candidateReferralSource: e.target.value }))}
                  placeholder="How did you find this candidate?"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">LinkedIn Data</Label>
                <Textarea
                  value={form.candidateLinkedinData}
                  onChange={(e) => setForm((p) => ({ ...p, candidateLinkedinData: e.target.value }))}
                  placeholder="Paste LinkedIn profile summary..."
                  rows={2}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">BrokerCheck Data</Label>
                <Textarea
                  value={form.candidateBrokercheckData}
                  onChange={(e) => setForm((p) => ({ ...p, candidateBrokercheckData: e.target.value }))}
                  placeholder="Paste BrokerCheck info..."
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleScore} disabled={scoreMutation.isPending}>
              {scoreMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Score Candidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
