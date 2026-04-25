/**
 * CascadeTrackingPanel — Tier 1 colleague auto-queue
 * Shows Tier 1 scored recruits with cascade potential ≥5,
 * indicating how many colleagues could be unlocked through each recruit.
 * Recruits who have completed their cadence are flagged as "ready for cascade."
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GitBranch, Users, Zap, ArrowRight, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function CascadeTrackingPanel() {
  const cascadeQ = trpc.cadenceEngine.getCascadeCandidates.useQuery();

  if (cascadeQ.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  const candidates = cascadeQ.data ?? [];
  const readyCount = candidates.filter(c => c.status === "ready_for_cascade").length;
  const totalColleagues = candidates.reduce((sum, c) => sum + c.cascadePotentialCount, 0);

  if (candidates.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <GitBranch className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            No Tier 1 recruits with cascade potential ≥5 yet.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Score recruits via the Cadences tab to populate this view.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <CardContent className="py-4">
            <p className="text-2xl font-bold text-foreground">{candidates.length}</p>
            <p className="text-xs text-muted-foreground">Tier 1 Cascade Candidates</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <p className="text-2xl font-bold text-emerald-400">{readyCount}</p>
            <p className="text-xs text-muted-foreground">Ready for Cascade</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <p className="text-2xl font-bold text-primary">{totalColleagues}</p>
            <p className="text-xs text-muted-foreground">Est. Colleagues Unlockable</p>
          </CardContent>
        </Card>
      </div>

      {/* Candidate List */}
      <div className="space-y-2">
        {candidates.map(c => (
          <Card key={c.id} className="overflow-hidden">
            <CardContent className="py-3 px-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-foreground truncate">{c.leadName}</span>
                    {c.leadCompany && (
                      <span className="text-xs text-muted-foreground truncate">@ {c.leadCompany}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Score: {c.compositeScore}/100
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {c.cascadePotentialCount} colleagues
                    </span>
                    {c.scoredAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(c.scoredAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {c.cascadeRationale && (
                    <p className="text-xs text-muted-foreground/80 line-clamp-2">{c.cascadeRationale}</p>
                  )}
                  {c.priorityActions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.priorityActions.slice(0, 3).map((action, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                          {action}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge
                    variant={c.status === "ready_for_cascade" ? "default" : "outline"}
                    className={c.status === "ready_for_cascade"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }
                  >
                    {c.status === "ready_for_cascade" ? (
                      <><CheckCircle2 className="w-3 h-3 mr-1" /> Ready</>
                    ) : (
                      <><Clock className="w-3 h-3 mr-1" /> In Cadence</>
                    )}
                  </Badge>
                  {c.status === "ready_for_cascade" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => toast.info(`Auto-queue ${c.cascadePotentialCount} colleagues from ${c.leadName}'s network — feature coming soon`)}
                    >
                      <ArrowRight className="w-3 h-3" /> Queue Colleagues
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Banner */}
      <Card className="border-dashed">
        <CardContent className="py-3 px-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">How Cascade Tracking Works</p>
            <p>
              When a Tier 1 recruit completes their cadence and has cascade potential ≥5,
              they appear here as "Ready for Cascade." The auto-queue feature will enroll
              their estimated colleagues into a COI maintenance cadence for warm introductions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
