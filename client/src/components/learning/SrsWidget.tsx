/**
 * §P0-1 FSRS-5 Spaced Repetition Widget
 * Compact widget showing SRS stats and next review due time.
 * Can be embedded in dashboard, learning home, or sidebar.
 */
import { trpc } from "@/lib/trpc";
import { Brain, Clock, Flame, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useMemo } from "react";

interface SrsWidgetProps {
  compact?: boolean;
  className?: string;
}

export function SrsWidget({ compact = false, className = "" }: SrsWidgetProps) {
  const [, navigate] = useLocation();
  const statsQ = trpc.learning.fsrs5.stats.useQuery(undefined, {
    retry: false,
    refetchInterval: 60_000,
  });

  const stats = statsQ.data;

  // @ts-expect-error — property access on loosely typed object
  const dueCount = stats?.dueCount ?? 0;
  // @ts-expect-error — property access on loosely typed object
  const totalCards = stats?.totalCards ?? 0;
  // @ts-expect-error — property access on loosely typed object
  const averageStability = stats?.averageStability ?? 0;
  // @ts-expect-error — strict mode fix
  const retentionRate = stats?.retentionRate ?? 0;

  const nextReviewLabel = useMemo(() => {
    // @ts-expect-error — property access on loosely typed object
    if (!stats?.nextReviewAt) return "No reviews scheduled";
    // @ts-expect-error — strict mode fix
    const diff = new Date(stats.nextReviewAt).getTime() - Date.now();
    if (diff <= 0) return "Reviews due now!";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return `Next review in ${Math.floor(hours / 24)}d`;
    if (hours > 0) return `Next review in ${hours}h ${mins}m`;
    return `Next review in ${mins}m`;
  // @ts-expect-error — property access on loosely typed object
  }, [stats?.nextReviewAt]);

  if (statsQ.isLoading) {
    return compact ? (
      <div className={`flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-sm animate-pulse ${className}`}>
        <Brain className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Loading...</span>
      </div>
    ) : (
      <Card className={`border-border/50 bg-card/80 backdrop-blur animate-pulse ${className}`}>
        <CardHeader className="pb-2"><CardTitle className="text-base text-muted-foreground">Loading SRS...</CardTitle></CardHeader>
      </Card>
    );
  }

  if (totalCards === 0 && !statsQ.isLoading) {
    return compact ? (
      <button onClick={() => navigate("/learning/flashcards")} className={`flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-sm transition-colors hover:bg-accent/50 ${className}`}>
        <Brain className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">No flashcards yet</span>
      </button>
    ) : (
      <Card className={`border-border/50 bg-card/80 backdrop-blur ${className}`}>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Brain className="h-5 w-5 text-purple-400" />Spaced Repetition</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">No flashcards yet. Start a learning track to begin reviewing cards.</p>
          <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => navigate("/learning")}>Browse Tracks</Button>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <button
        onClick={() => navigate("/learning/flashcards")}
        className={`flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-sm transition-colors hover:bg-accent/50 ${className}`}
      >
        <Brain className="h-4 w-4 text-purple-400" />
        <span className="font-medium">{dueCount} due</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground text-xs">{nextReviewLabel}</span>
      </button>
    );
  }

  return (
    <Card className={`border-border/50 bg-card/80 backdrop-blur ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-5 w-5 text-purple-400" />
          Spaced Repetition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            <div>
              <p className="text-lg font-bold">{dueCount}</p>
              <p className="text-xs text-muted-foreground">Cards Due</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <div>
              <p className="text-lg font-bold">{totalCards}</p>
              <p className="text-xs text-muted-foreground">Total Cards</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <div>
              <p className="text-lg font-bold">{(retentionRate * 100).toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Retention</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-400" />
            <div>
              <p className="text-lg font-bold">{averageStability.toFixed(1)}d</p>
              <p className="text-xs text-muted-foreground">Avg Stability</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{nextReviewLabel}</p>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate("/learning/flashcards")}
          disabled={dueCount === 0}
        >
          {dueCount > 0 ? `Review ${dueCount} Cards` : "All Caught Up!"}
        </Button>
      </CardContent>
    </Card>
  );
}
