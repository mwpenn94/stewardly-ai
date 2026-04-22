/**
 * §P1-2 Lesson Graph + Mastery Gating — UI Visualization
 * Renders a visual graph of chapters showing prerequisites and mastery gates.
 * Locked chapters are grayed out; completed chapters show green checkmarks.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Lock, CheckCircle2, Circle, ChevronRight, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

interface LessonGraphViewProps {
  trackId: number;
  className?: string;
}

interface ChapterNode {
  id: number;
  title: string;
  orderIndex: number;
  mastered: boolean;
  locked: boolean;
  prerequisites: number[];
  masteryScore?: number;
}

export function LessonGraphView({ trackId, className = "" }: LessonGraphViewProps) {
  const [, navigate] = useLocation();
  const graphQ = trpc.learning.lessonGraph.getGraph.useQuery({ trackId }, { retry: false });

  // Graph data includes chapter nodes with locked/mastered state from the server
  const chapters: ChapterNode[] = useMemo(() => {
    if (!graphQ.data?.chapters) return [];

    return graphQ.data.chapters.map((ch: any) => ({
      id: ch.id,
      title: ch.title,
      orderIndex: ch.orderIndex ?? 0,
      mastered: ch.mastered ?? false,
      locked: ch.locked ?? false,
      prerequisites: ch.prerequisites ?? [],
      masteryScore: ch.masteryScore,
    }));
  }, [graphQ.data]);

  if (graphQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <BookOpen className="h-12 w-12 mb-3 opacity-40" />
        <p>No chapters available for this track.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {chapters.map((chapter, idx) => {
        const isLast = idx === chapters.length - 1;

        return (
          <div key={chapter.id} className="relative">
            {/* Connector line */}
            {!isLast && (
              <div className="absolute left-6 top-14 h-4 w-0.5 bg-border" />
            )}

            <button
              onClick={() => !chapter.locked && navigate(`/learning/chapter/${chapter.id}`)}
              disabled={chapter.locked}
              className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                chapter.locked
                  ? "border-border/30 bg-muted/20 opacity-60 cursor-not-allowed"
                  : chapter.mastered
                    ? "border-green-500/30 bg-green-500/5 hover:bg-green-500/10"
                    : "border-border/50 bg-card/80 hover:bg-accent/30 hover:border-primary/30"
              }`}
            >
              {/* Status icon */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                chapter.locked
                  ? "bg-muted text-muted-foreground"
                  : chapter.mastered
                    ? "bg-green-500/20 text-green-400"
                    : "bg-primary/10 text-primary"
              }`}>
                {chapter.locked ? (
                  <Lock className="h-5 w-5" />
                ) : chapter.mastered ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </div>

              {/* Chapter info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-medium truncate">{chapter.title}</h3>
                </div>
                {chapter.prerequisites.length > 0 && chapter.locked && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Requires: {chapter.prerequisites.length} prerequisite{chapter.prerequisites.length > 1 ? "s" : ""}
                  </p>
                )}
                {chapter.masteryScore !== undefined && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mastery: {Math.round(chapter.masteryScore * 100)}%
                  </p>
                )}
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 shrink-0">
                {chapter.mastered && (
                  <Badge variant="outline" className="border-green-500/30 text-green-400 text-xs">
                    Mastered
                  </Badge>
                )}
                {chapter.locked && (
                  <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">
                    Locked
                  </Badge>
                )}
                {!chapter.locked && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
