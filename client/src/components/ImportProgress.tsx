/**
 * ImportProgress — Real-time progress display for data import jobs.
 * Shows row counts, errors, stage progression, and estimated time remaining.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Loader2, Clock, FileSpreadsheet, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportProgressProps {
  status: "pending" | "parsing" | "validating" | "importing" | "complete" | "failed";
  totalRows: number;
  processedRows: number;
  errorCount: number;
  warnings?: string[];
  errors?: string[];
  startedAt?: number;
  className?: string;
}

const stageOrder = ["pending", "parsing", "validating", "importing", "complete"] as const;

function getStageIndex(status: string): number {
  const idx = stageOrder.indexOf(status as any);
  return idx >= 0 ? idx : 0;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function ImportProgress({
  status, totalRows, processedRows, errorCount, warnings = [], errors = [], startedAt, className,
}: ImportProgressProps) {
  const percent = totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0;
  const elapsed = startedAt ? Date.now() - startedAt : 0;
  const currentStage = getStageIndex(status);
  const isFailed = status === "failed";
  const isDone = status === "complete";

  return (
    <Card className={cn(isFailed && "border-red-500/30", isDone && "border-emerald-500/30", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Data Import
          </CardTitle>
          <Badge variant="outline" className={cn(
            "text-xs capitalize",
            isFailed && "border-red-500/30 text-red-400",
            isDone && "border-emerald-500/30 text-emerald-400",
          )}>
            {status === "importing" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{processedRows.toLocaleString()} / {totalRows.toLocaleString()} rows</span>
            <span>{percent}%</span>
          </div>
          <Progress value={percent} className="h-2" />
        </div>

        {/* Stage indicators */}
        <div className="flex items-center justify-between">
          {stageOrder.map((stage, i) => {
            const isActive = i === currentStage && !isFailed;
            const isComplete = i < currentStage || isDone;
            return (
              <div key={stage} className="flex flex-col items-center gap-1">
                <div className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-xs",
                  isComplete ? "bg-emerald-500/20 text-emerald-400" :
                  isActive ? "bg-primary/20 text-primary" :
                  "bg-muted/50 text-muted-foreground",
                )}>
                  {isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                   isActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                   <span>{i + 1}</span>}
                </div>
                <span className="text-[10px] capitalize text-muted-foreground">{stage}</span>
              </div>
            );
          })}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs">
          {elapsed > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" /> {formatDuration(elapsed)}
            </span>
          )}
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <XCircle className="h-3 w-3" /> {errorCount} errors
            </span>
          )}
          {warnings.length > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3 w-3" /> {warnings.length} warnings
            </span>
          )}
        </div>

        {/* Error details */}
        {errors.length > 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-md p-2 max-h-24 overflow-y-auto">
            {errors.slice(0, 5).map((err, i) => (
              <p key={i} className="text-xs text-red-400">{err}</p>
            ))}
            {errors.length > 5 && (
              <p className="text-xs text-red-400/70 mt-1">...and {errors.length - 5} more</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
