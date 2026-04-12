/**
 * RunTimelinePanel — modal showing every calculator run in the
 * user's current session. Auto-populates from the useRunTimeline
 * hook. Each entry is clickable and navigates back to the
 * calculator's route.
 *
 * Pass 11 history: ships the UI layer for gap G11.
 */

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ArrowRight,
  Clock,
  History,
  Trash2,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { useRunTimeline } from "@/hooks/useRunTimeline";
import type { TimelineEntry } from "@/stores/runTimeline";

interface RunTimelinePanelProps {
  open: boolean;
  onClose: () => void;
}

export function RunTimelinePanel({ open, onClose }: RunTimelinePanelProps) {
  const [, navigate] = useLocation();
  const { timeline, stats, removeRun, clearRuns } = useRunTimeline();

  const sortedEntries = useMemo(() => {
    return [...timeline.entries];
  }, [timeline]);

  // Esc-to-close
  if (!open) return null;

  const handleReopen = (entry: TimelineEntry) => {
    // Emit a custom event so the destination calculator can
    // rehydrate its local state from entry.inputs if it wants.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("stewardly-timeline-reopen", {
          detail: { entry },
        }),
      );
    }
    if (entry.route) {
      navigate(entry.route);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="run-timeline-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-accent" />
            <h2 id="run-timeline-title" className="text-base font-semibold">
              Run Timeline
            </h2>
            {stats.totalRuns > 0 && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">
                {stats.totalRuns} runs
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {stats.totalRuns > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm("Clear all run history?")) clearRuns();
                }}
                aria-label="Clear run history"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close run timeline"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Stats strip */}
          {stats.totalRuns > 0 && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <StatBox label="Total runs" value={stats.totalRuns} />
              <StatBox label="Tools used" value={stats.uniqueTools} />
              <StatBox
                label="Avg confidence"
                value={
                  stats.avgConfidence > 0
                    ? `${Math.round(stats.avgConfidence * 100)}%`
                    : "—"
                }
              />
            </div>
          )}

          {/* Timeline list */}
          {sortedEntries.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No runs recorded yet.</p>
              <p className="text-xs mt-1">
                Run any calculator and it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedEntries.map((entry) => (
                <Card key={entry.id} className="group">
                  <CardContent className="pt-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate" title={entry.label}>
                            {entry.label}
                          </p>
                          {typeof entry.confidence === "number" && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-4 px-1 font-mono tabular-nums ${
                                entry.confidence >= 0.7
                                  ? "border-emerald-500/40 text-emerald-500"
                                  : entry.confidence >= 0.4
                                    ? "border-amber-500/40 text-amber-500"
                                    : "border-destructive/40 text-destructive"
                              }`}
                            >
                              {Math.round(entry.confidence * 100)}% conf
                            </Badge>
                          )}
                        </div>
                        {entry.inputSummary && (
                          <p className="text-[11px] text-muted-foreground mt-1 truncate">
                            in: {entry.inputSummary}
                          </p>
                        )}
                        {entry.outputSummary && (
                          <p className="text-[11px] mt-0.5 truncate">
                            <span className="text-muted-foreground">out:</span>{" "}
                            <span className="text-accent font-mono tabular-nums">
                              {entry.outputSummary}
                            </span>
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {entry.route && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReopen(entry)}
                            aria-label={`Reopen ${entry.label}`}
                          >
                            Reopen <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeRun(entry.id)}
                          aria-label={`Delete run ${entry.label}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md border p-2 space-y-0.5">
      <p className="text-[9px] uppercase text-muted-foreground tracking-wide">
        {label}
      </p>
      <p className="text-sm font-mono tabular-nums">{value}</p>
    </div>
  );
}
