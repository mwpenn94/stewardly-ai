/**
 * ATLASGoalPanel — Visualizes ATLAS goal decomposition.
 * Absorbed from manus-next-app task planning pattern.
 *
 * Shows the decomposed sub-goals with progress tracking,
 * used in the WorkspaceArtifactsPanel during complex advisory tasks.
 */
import { Check, Circle, Loader2, Target, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface SubGoal {
  id: string;
  description: string;
  status: "pending" | "active" | "complete" | "blocked";
  priority: "high" | "medium" | "low";
  dependencies?: string[];
}

interface ATLASGoalPanelProps {
  goal: string;
  subGoals: SubGoal[];
  progress: number; // 0-100
  className?: string;
}

const STATUS_ICON: Record<SubGoal["status"], typeof Check> = {
  pending: Circle,
  active: Loader2,
  complete: Check,
  blocked: Circle,
};

const PRIORITY_COLOR: Record<SubGoal["priority"], string> = {
  high: "text-red-400 border-red-500/30",
  medium: "text-amber-400 border-amber-500/30",
  low: "text-muted-foreground border-border",
};

export function ATLASGoalPanel({
  goal,
  subGoals,
  progress,
  className = "",
}: ATLASGoalPanelProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Goal header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/30 border border-border/50 hover:bg-primary/50 transition-colors"
      >
        <Target className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium text-foreground flex-1 text-left truncate">{goal}</span>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
      </button>

      {/* Progress bar */}
      <div className="px-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Progress</span>
          <span className="text-[10px] font-medium text-primary">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-primary/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Sub-goals list */}
      {expanded && (
        <div className="space-y-1.5">
          {subGoals.map((sg) => {
            const StatusIcon = STATUS_ICON[sg.status];
            return (
              <div
                key={sg.id}
                className={`flex items-start gap-2 px-3 py-2 rounded-md border transition-all ${
                  sg.status === "active"
                    ? "border-primary/30 bg-primary/5"
                    : sg.status === "complete"
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : sg.status === "blocked"
                    ? "border-red-500/20 bg-red-500/5 opacity-60"
                    : "border-border/30"
                }`}
              >
                <StatusIcon
                  className={`w-3 h-3 mt-0.5 shrink-0 ${
                    sg.status === "active"
                      ? "text-primary animate-spin"
                      : sg.status === "complete"
                      ? "text-emerald-400"
                      : sg.status === "blocked"
                      ? "text-red-400"
                      : "text-muted-foreground/50"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${sg.status === "complete" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {sg.description}
                  </p>
                  {sg.dependencies && sg.dependencies.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Depends on: {sg.dependencies.join(", ")}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1 py-0 ${PRIORITY_COLOR[sg.priority]}`}
                >
                  {sg.priority}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
